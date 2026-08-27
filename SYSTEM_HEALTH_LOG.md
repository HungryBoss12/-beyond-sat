# BeyondSAT System Health Log

Dated audit entries, newest first.

---

## 2026-08-27 — Cron integrity audit (`cursor/system-integrity-audit-23d6`)

### Live site — **DOWN**
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** **404 on every route** — `/`, `/signin`, `/signup`, `/dashboard`, `/practice`, `/banned`, `/favicon.svg`, `/auth/callback`, `/onboarding`, `/beyond-ai`, `/admin`, `/reset-password`
- **API routes:** `/api/import/vision`, `/api/ai/chat` also return **404** (Worker appears missing or undeployed — not an app-level auth failure)
- **Regression:** Site was HTTP 200 on 2026-08-26; now fully unreachable. **Requires manual `npm run deploy` / Cloudflare dashboard check** — cron cannot fix deployment from CI alone.

### Security — fixed (11th occurrence of same regression)
- **Issue:** `/api/import/vision`, `/api/import/fix`, `/api/import/figure` only checked `verifySupabaseUser()` — any signed-in student could burn Gemini/OpenRouter quota. Staff guard (`verifyStaffUser()` + `bs_is_staff` RPC) was present on prior health branches but never merged to `main`.
- **Fix:** Re-added `verifyStaffUser()` in `src/lib/server-env.ts` and staff checks in all three import handlers (403 for non-staff).
- **Already secure:** `/api/ai/chat` requires auth before upstream calls; service-role key only read server-side from env; no hardcoded API secrets in source (tracked `.env` holds anon-role Supabase keys only).

### Bugs fixed
- **Missing `/reset-password` route:** Added `src/routes/reset-password.tsx` — handles PKCE `?code=` and hash recovery sessions, lets users set a new password via `supabase.auth.updateUser()`. Synced `src/routeTree.gen.ts`.
- **Lint error:** Removed unnecessary escape in `src/lib/classes/uploads.ts` (`no-useless-escape`).

### Build & quality
- **Tests:** 30/30 passed (4 files)
- **Build:** Production build succeeded
- **Lint:** Prettier formatting auto-fixed across ~158 files with `eslint --fix`; 2 remaining warnings (pre-existing `react-refresh/only-export-components`, `react-hooks/exhaustive-deps`)
- **npm ci:** `package-lock.json` refreshed — `npm ci` now succeeds (was failing on missing `lru-cache@11.5.2`)
- **npm audit:** 9 vulnerabilities (5 moderate, 4 high) in transitive deps (`undici` via nitro/miniflare, `brace-expansion`, `js-yaml`, `nanoid`) — do **not** run `audit fix --force` (would break nitro)

### Changes in this run
- Added `verifyStaffUser()` + staff guards on import API routes
- Added `/reset-password` page for password-reset email links
- Fixed `uploads.ts` lint error
- Auto-formatted ~158 source files (Prettier)
- Synced `package-lock.json` and `routeTree.gen.ts`

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
1. **Restore deployment** — redeploy Worker to Cloudflare; verify HTTP 200 on key routes.
2. **Merge staff guards to `main`** — this regression has recurred on eleven cron runs because fixes land on health branches only.
3. **Harden `grade_answer` and profile UPDATE policies** — top DB-level security gaps.

---

## 2026-08-26 — Cron integrity audit (`cursor/system-integrity-audit-bf76`)

### Live site
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** Alive — HTTP 200 on `/`, `/signin`, `/signup`, `/dashboard`, `/practice`, `/banned`, `/favicon.svg`, `/auth/callback`, `/onboarding`, `/beyond-ai`, `/admin`
- **Import APIs (GET):** 405 Method Not Allowed (expected — POST-only)
- **Import APIs (POST, no auth):** 401 Unauthorized (live; staff guard still missing until deploy)
- **AI chat (POST, no auth):** 401 Unauthorized
- **`/reset-password` (live, pre-deploy):** 404 — fixed in this branch

### Security — fixed (10th occurrence of same regression)
- Re-added `verifyStaffUser()` + staff guards on `/api/import/*`.

### Bugs fixed
- Added `/reset-password` route; fixed `uploads.ts` lint error.

### Build & quality
- Tests 30/30; build OK; lint auto-fixed; npm ci refreshed; 9 audit vulns (do not force-fix).
