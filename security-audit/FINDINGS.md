# BeyondSAT Security Assessment — Running Notes (`FINDINGS.md`)

> **Rules of Engagement:** Authorised grey-box assessment of local repository and localhost runtime only. Zero traffic to production, hosted Supabase (`qlzvngegsemrzmyxwykl`), Cloudflare edge, Google/YouTube, OpenRouter, or Telegram. No secret values are recorded here. Do not commit this file.

## Status Summary

- **Completed Phases:**
  - Phase 0: Preflight & Threat Model
  - Phase 1: Attack Surface & Trust Boundary Map
  - Phase 2: Static Analysis, Git History Secret Scan, Build & Dependency Audit
  - Phase 3: Local Dynamic Verification (compiled `.output/server/index.mjs` Worker + `127.0.0.1` mock upstream + outbound egress firewall; **0 external network requests**)
  - Phase 4: Attack Chain Analysis
  - Phase 5: False-Positive Pruning & Confidence Validation
  - Phase 6: Full Gate 2 Security Report
- **Current Gate:** **Remediations Complete & Verified Locally** (`PT-01`..`PT-07` + `H-01`..`H-07` + `S-01`..`S-03`)
- **Next Step:** Apply `supabase/migrations/20261115000002_security_audit_remediation.sql` to Supabase and deploy the Worker when ready, plus confirm the owner checklist items below.

---

## Threat Model

- **Persona A — Anonymous Internet User:** Unauthenticated requests to SSR documents, static assets, `/api/*`, and anon PostgREST RPCs (`public_submit_lid`, `get_maintenance_state`, `get_registration_state`).
- **Persona B — Authenticated Low-Privilege User (`student`, `held/banned student`, `editor`, or `teacher`):** Holds a valid Supabase user JWT; calls PostgREST, RPCs, Storage APIs, and `/api/*` directly.
- **Persona C — Public Bundle & Anon Key Holder:** Knows `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, compiled client bundles, and all RPC signatures in `src/integrations/supabase/types.ts`.
- **Persona D — Single-Secret Compromise:** Possesses one leaked credential (`TELEGRAM_WEBHOOK_SECRET`, an invite token, or a stolen browser token).
- **Persona E — Supply Chain / Untrusted Archive:** Malicious `.apkg` / `.docx` archive or vulnerable npm package.

---

## Attack Surface Map

| Entry Point | Auth Gate | Rate Limit | Inputs | Data / Upstreams |
| --- | --- | --- | --- | --- |
| `POST /api/ai/chat` | Bearer JWT + `userIsBanned` | `ai-chat` (20/6pm), `ai-vision` (8/2pm), `bs_take_ai_quota` | JSON (12 MB cap): `messages`, `model`, `task`, `surface`, `stream` | `profiles`, `app_settings`, `ai_usage_daily`, `uinfo`, `youtube_rec_cache`, Storage; OpenRouter, Gemini, YouTube |
| `POST /api/ai/uinfo` | Bearer JWT + `userIsBanned` (`bs_is_admin` for foreign `userId`) | `uinfo-flush` (1/10m) | Optional JSON `{ userId }` (16 KB cap) | `uinfo_log`, `uinfo` (service role); OpenRouter |
| `GET /api/ai/youtube-recs` | Bearer JWT + `userIsBanned` | `youtube-recs` (10/2pm) + `youtube-upstream` (4/0.5pm) | Query `section` (`rw` \| `math`) | `uinfo`, `youtube_rec_cache`, `lesson_video_catalog`, `app_settings`; YouTube Data API v3 |
| `POST /api/import/{vision,fix,figure}` | `requireStaff` | `import-ai` (30/10pm) | JSON (512 KB–16 MB caps): base64 page image / draft | `profiles`, `user_roles`; Gemini, OpenRouter |
| `GET /api/vocab/session` | `requireUser` | `vocab-session` (30/10pm) | Query `deckId` | `user_card_states`, `vocab_cards`, `vocab_decks` |
| `POST /api/vocab/review` | `requireUser` | `vocab-review` (120/60pm) | JSON `{ cardId, rating }` (16 KB cap) | `user_card_states`, `vocab_activity_logs`, `student_profiles` |
| `POST /api/vocab/quiz/submit` | `requireUser` | `vocab-quiz` (20/6pm) + DB 10s/25d | JSON `{ quizId, answers }` (64 KB cap) | `submit_vocab_quiz` RPC (`vocab_quiz_questions`, `vocab_quiz_attempts`, `vocab_homework_completions`) |
| `POST /api/vocab/generate` | `requireStaff` | `vocab-generate` (15/4pm) | JSON `{ words, topic, count }` (64 KB cap) | OpenRouter |
| `POST /api/vocab/admin/save` | `requireStaff` | `vocab-admin` (60/20pm) | JSON (4 MB cap): `items`, `deckTree`, `quizTitle` | `vocab_decks`, `vocab_cards`, `vocab_quizzes`, `vocab_quiz_questions` |
| `PATCH\|DELETE /api/vocab/admin/{decks,cards}/:id` | `requireStaff` | `vocab-admin` (60/20pm) | JSON (64 KB cap) | `vocab_decks`, `vocab_cards` |
| `POST /api/admin/{create-user,delete-student,reset-student-password,student-invite}` | `requireAdmin` (12h fresh) | — | JSON (16–64 KB caps) | GoTrue Admin API, `profiles`, `user_roles`, `students`, `student_invites`, `class_memberships` |
| `POST /api/auth/{preview-invite,claim-invite}` | Public (256-bit invite token) | `invite-preview` (40/10pm), `invite-claim` (20/5pm) | JSON (16 KB cap) | `student_invites`, `students`, `profiles`, GoTrue Admin API |
| `POST /api/auth/{username-login,forgot-password}` | Public | `bs_take_login_attempt` + `login-acct` + `login-ip` | JSON (16 KB cap) | `login_attempt_buckets`, `profiles`, GoTrue |
| `POST /api/auth/complete-first-login` | `requireUser` | `first-login` (10/2pm) | JSON (16 KB cap) | `profiles`, GoTrue Admin API, `bs_complete_first_login` |
| `POST /api/telegram/webhook` | `X-Telegram-Bot-Api-Secret-Token` | `tg-link` (5/1pm) on `/link` | JSON (64 KB cap) | `admin_telegram_link_codes`, `profiles`, `test_sessions`, GoTrue logout, Telegram Bot API |
| `POST /api/telegram/ensure-webhook` | `X-Telegram-Setup-Token` or `bs_is_admin` | `tg-ensure` (10/2pm) | None | Telegram Bot API |
| Crons (`*/5 * * * *`, `0 * * * *`) | Cloudflare scheduled hook | Platform | Cron schedule | `support_notify_starting_soon`, `billing_apply_recurring_fees_system`, `purge_settled_student_accounts`, Storage |
| Direct Browser → Supabase | Anon / User JWT + RLS | RPC-specific | PostgREST / RPC / Storage | All `public.*` tables/views/RPCs + 6 Storage buckets |

---

## Validated Findings (Phases 2–5)

| ID | Title | Severity | Status | Confidence | Location |
| --- | --- | --- | --- | --- | --- |
| `PT-01` | Cross-user private file read via `chat_message_attachments` and `homework_submission_files` `storage_path` forgery | High | FIXED LOCALLY | High | `supabase/migrations/20261115000002_security_audit_remediation.sql`, `src/lib/classes/uploads.ts` |
| `PT-02` | `bs_test_sessions_guard` permits un-completing finished exams, resetting `started_at`, and lacks server-side mock timer enforcement | High | FIXED LOCALLY | High | `supabase/migrations/20261115000002_security_audit_remediation.sql` |
| `PT-03` | `/api/vocab/quiz/submit` and `submit_vocab_quiz` accept duplicate `questionId`s (200% score dynamically proven, auto-completes homework) and skip quiz visibility check | Medium | FIXED & RETESTED (`400`) | High | `src/lib/vocab/handlers/quiz-submit.ts`, `supabase/migrations/20261115000002_security_audit_remediation.sql` |
| `PT-04` | Client-callable `bs_bump_vocab_homework` and `bs_record_vocab_activity` forge streaks, activity logs, and class VAR homework marks without reviewing due cards | Medium | FIXED & RETESTED (`409`) | High | `src/lib/vocab/activity.ts`, `src/lib/vocab/handlers/session.ts`, `src/lib/vocab/homework.ts`, `supabase/migrations/20261115000002_security_audit_remediation.sql` |
| `PT-05` | Staff role boundary drift: `editor` can read student/parent phones (`student_contacts`, `students`), read/poison `uinfo`, and `editor`/other-class `teacher` can read/write `payment_collect_notes` | Medium | FIXED LOCALLY | High | `supabase/migrations/20261115000002_security_audit_remediation.sql` |
| `PT-06` | `student_book_support_window` regressed `bs_is_self_banned()` check and `"threads insert direct"` allows orphan `chat_threads` rows | Low | FIXED LOCALLY | High | `supabase/migrations/20261115000002_security_audit_remediation.sql` |
| `PT-07` | Authenticated `/api/*` JSON responses omit `Cache-Control: no-store` (dynamically proven); `.apkg`/`.docx` parsers lack decompressed byte limits | Low | FIXED & RETESTED (`no-store`) | High | `src/lib/security-headers.ts`, `src/lib/vocab/parse-apkg.ts`, `src/lib/vocab/anki-zstd.ts`, `src/lib/import/docx.ts` |
| `LV-01` | Uncommitted working-tree security fixes (`20261115000002_security_audit_remediation.sql` + 38 Worker/client files) not yet deployed to live Supabase/Cloudflare | Info / Operational | NEEDS-LIVE-VERIFICATION | High | Working tree (`git status`) |

### Discarded / Disproven Hypotheses (Phase 5 Validation)

- **Protocol-relative / Host-header Open Redirect (`//evil.example/`, `X-Forwarded-Host: evil.example`):** Tested dynamically on `.output/server/index.mjs`; Nitro/TanStack Router normalizes `//evil.example/` to same-origin `308 http://<worker-host>/evil.example/` and ignores `Host`/`X-Forwarded-Host` overrides. **NOT EXPLOITABLE.**
- **Trailing-slash Auth Bypass (`POST /api/ai/chat/`):** Tested dynamically; returns `307 Location: /api/ai/chat`, which then hits `handleAiChat` and returns `401`. **NOT EXPLOITABLE.**
- **Maintenance Page Stored XSS (`maintenance_message`):** Tested dynamically with `<script>alert(1)</script>`; `escapeHtml` encodes it to `&lt;script&gt;...` and enforced CSP + `frame-ancestors 'none'` is attached. **NOT EXPLOITABLE.**
- **`.dev.vars` Traversal on Production Worker (`/.dev.vars`, `/..%2f.dev.vars`):** Tested dynamically; returns `404` with zero secret disclosure. **NOT EXPLOITABLE.**

---

## Open Questions / Owner Actions Needed

1. Confirm post-Nov-9 rotation of all secrets in `.dev.vars` (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`).
2. Check Supabase Dashboard → Authentication → Rate Limits, URL Configuration (Redirect URLs), and Email ("Secure email change").
3. Review Gate 2 Report and approve specific findings (`PT-01`..`PT-07`) for implementation.
