# BeyondSAT System Health Log

Dated audit entries, newest first.

---

## 2026-08-31 — Cron integrity audit (`cursor/system-integrity-audit-c215`)

### Live site — **UP**
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** HTTP **200** on `/`, `/signin`, `/signup`, `/dashboard`, `/practice`, `/vocab`, `/classes`, `/banned`, `/onboarding`, `/beyond-ai`, `/admin`, `/auth/callback`, `/favicon.ico`
- **404:** `/reset-password` on deployed build (route re-added in this run — needs deploy)
- **Import APIs (GET):** 405 Method Not Allowed (expected — POST-only)
- **Import APIs (POST, no auth):** 401 Unauthorized (auth gate works; staff guard was missing until this fix)
- **AI chat (POST, no auth):** 401 Unauthorized

### Security — fixed (15th occurrence of same regression)
- **Issue:** `/api/import/vision`, `/api/import/fix`, `/api/import/figure` only checked `verifySupabaseUser()` — any signed-in student could burn Gemini/OpenRouter quota. Staff guard (`verifyStaffUser()` + `bs_is_staff` RPC) was present on prior health branches but never merged to `main`.
- **Fix:** Re-added `verifyStaffUser()` in `src/lib/server-env.ts` and staff checks in all three import handlers (403 for non-staff).
- **Already secure:** `/api/ai/chat` requires auth before upstream calls; service-role key only read server-side from env; no hardcoded API secrets in source.

### Bugs fixed
- **Missing `/reset-password` route:** Re-added `src/routes/reset-password.tsx` — handles PKCE `?code=` and hash recovery sessions, lets users set a new password via `supabase.auth.updateUser()`. `routeTree.gen.ts` already includes the route.
- **Lint errors:** Removed unnecessary escape in `src/lib/classes/uploads.ts` (`no-useless-escape`); replaced control-character regex in `src/lib/vocab/anki-html.ts` with `replaceAll` on a string constant.

### Build & quality
- **Tests:** 63/63 passed (9 files)
- **Build:** Production build succeeded
- **Lint:** Prettier formatting auto-fixed across ~630 files with `eslint --fix`; 6 remaining warnings (pre-existing `react-refresh/only-export-components`, `react-hooks/exhaustive-deps`)
- **npm ci:** Succeeds
- **npm audit:** 9 vulnerabilities (5 moderate, 4 high) in transitive deps — do **not** run `audit fix --force` (would break nitro)

### Changes in this run
- Added `verifyStaffUser()` + staff guards on import API routes
- Re-added `/reset-password` page for password-reset email links
- Fixed `uploads.ts` and `anki-html.ts` lint errors
- Auto-formatted ~630 source files (Prettier)

### Known issues — not fixed (require DB migrations or larger refactors)
| Severity | Issue | Location |
|---|---|---|
| Critical | `grade_answer` RPC is an answer-key oracle — any authenticated user can probe correct answers without a session | `supabase/migrations/20260721232119_*.sql` |
| Critical | Ban bypass via profile self-update (`banned` column not protected on UPDATE) | `profiles` RLS policies |
| High | Session marked complete even when attempt inserts fail | `src/components/TestPlayer.tsx` |
| High | Onboarding bypass via profile self-update (`intro_completed`) | `profiles` RLS + `_authenticated/route.tsx` |
| High | TypeScript errors in vision chat path (build passes via Vite) | `src/lib/gemini/chat-vision.ts`, `src/lib/ai/handler.ts` |
| Medium | Banned users can still call Worker APIs (`/api/ai/chat`, import routes) | Worker handlers |
| Medium | Daily test date uses client local timezone | `src/lib/session.ts`, practice routes |
| Medium | Duplicate attempts possible (no unique on session+question) | `attempts` table |
| Medium | Over-broad profile read for chat directory | classes migration RLS |

### Follow-up
1. **Deploy this branch** — redeploy Worker so `/reset-password` and staff guards go live.
2. **Merge staff guards to `main`** — this regression has recurred on fifteen cron runs because fixes land on health branches only.
3. **Harden `grade_answer` and profile UPDATE policies** — top DB-level security gaps.

---

## 2026-08-30 — Cron integrity audit (`cursor/system-integrity-audit-41ae`)

### Live site — **UP**
- Same fixes applied on health branch; not merged to `main`.
- Security regression fixed (14th occurrence); `/reset-password` route added.

---

## 2026-08-29 — Cron integrity audit (`cursor/system-integrity-audit-2a9d`)

### Live site — **UP**
- Same fixes applied on health branch; not merged to `main`.
- Security regression fixed (13th occurrence); `/reset-password` route added.

---

## 2026-08-28 — Cron integrity audit (`cursor/system-integrity-audit-6c33`)

### Live site — **DOWN**
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** **404 on every route**

---

## 2026-08-27 — Cron integrity audit (`cursor/system-integrity-audit-23d6`)

### Live site — **DOWN**
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** **404 on every route**
- PR: https://github.com/HungryBoss12/-beyond-sat/pull/12
