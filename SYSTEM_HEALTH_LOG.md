# BeyondSAT System Health Log

Dated audit entries, newest first.

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

### Follow-up
- **Merge staff guards to `main`** — this regression has recurred on ten cron runs because fixes land on health branches only.
- **Deploy** — live site still serves pre-fix build until Workers deploy runs.

---

## 2026-08-25 — Cron integrity audit (`cursor/system-integrity-audit-b677`)

### Live site
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** Alive — HTTP 200 on `/`, `/signin`, `/signup`, `/dashboard`, `/practice`, `/practice/math`, `/banned`, `/favicon.svg`, `/auth/callback`, `/onboarding`, `/beyond-ai`, `/admin`
- **Import APIs (GET):** 405 Method Not Allowed (expected — POST-only)
- **Import APIs (POST, no auth):** 401 Unauthorized (live; staff guard still missing until deploy)
- **AI chat (POST, no auth):** 401 Unauthorized
- **`/reset-password` (live, pre-deploy):** 404 — fixed in this branch

### Security — fixed (9th occurrence of same regression)
- **Issue:** `/api/import/vision`, `/api/import/fix`, `/api/import/figure` only checked `verifySupabaseUser()` — any signed-in student could burn Gemini/OpenRouter quota. Staff guard (`verifyStaffUser()` + `bs_is_staff` RPC) was present on prior health branches but never merged to `main`.
- **Fix:** Re-added `verifyStaffUser()` in `src/lib/server-env.ts` and staff checks in all three import handlers (403 for non-staff).
- **Already secure:** `/api/ai/chat` requires auth before upstream calls; service-role key only read server-side from env; no hardcoded API secrets in source (tracked `.env` holds anon-role Supabase keys only).

### Bugs fixed
- **Missing `/reset-password` route:** Added `src/routes/reset-password.tsx` — handles PKCE `?code=` and hash recovery sessions, lets users set a new password via `supabase.auth.updateUser()`. Synced `src/routeTree.gen.ts`.
- **Lint error:** Removed unnecessary escape in `src/lib/classes/uploads.ts` (`no-useless-escape`).

### Build & quality
- **Tests:** 30/30 passed (4 files)
- **Build:** Production build succeeded
- **Lint:** Prettier formatting auto-fixed across ~50 files with `eslint --fix`; 2 remaining warnings (pre-existing `react-refresh/only-export-components`, `react-hooks/exhaustive-deps`)
- **npm ci:** `package-lock.json` refreshed — `npm ci` now succeeds (was failing on missing `lru-cache@11.5.2`)
- **npm audit:** 9 vulnerabilities (5 moderate, 4 high) in transitive deps (`undici` via nitro/miniflare, `brace-expansion`, `js-yaml`, `nanoid`) — do **not** run `audit fix --force` (would break nitro)

### Changes in this run
- Added `verifyStaffUser()` + staff guards on import API routes
- Added `/reset-password` page for password-reset email links
- Fixed `uploads.ts` lint error
- Auto-formatted ~50 source files (Prettier)
- Synced `package-lock.json` and `routeTree.gen.ts`

### Follow-up
- **Merge staff guards to `main`** — this regression has recurred on nine cron runs because fixes land on health branches only.
- **Deploy** — live site still serves pre-fix build until Workers deploy runs.
