# BeyondSAT System Health Log

Dated audit entries, newest first.

---

## 2026-08-21 — Cron integrity audit (`cursor/system-integrity-audit-2fa1`)

### Live site
- **URL:** https://beyond-sat-v0.javazbek80.workers.dev
- **Status:** Alive — HTTP 200 on `/`, `/signin`, `/signup`, `/dashboard`, `/practice`, `/banned`, `/favicon.svg`, `/auth/callback`, `/onboarding`, `/beyond-ai`, `/admin`
- **Import APIs (GET):** 405 Method Not Allowed (expected — POST-only)
- **Import APIs (POST, no auth):** 401 Unauthorized
- **Import APIs (POST, fake token):** 401 Unauthorized
- **AI chat (GET):** 405 Method Not Allowed (expected)
- **`/reset-password` (live, pre-deploy):** 404 — fixed in this branch

### Security — fixed (5th occurrence of same regression)
- **Issue:** `/api/import/vision`, `/api/import/fix`, `/api/import/figure` only checked `verifySupabaseUser()` — any signed-in student could burn Gemini/OpenRouter quota. Staff guard (`verifyStaffUser()` + `bs_is_staff` RPC) was present on prior health branches but never merged to `main`.
- **Fix:** Re-added `verifyStaffUser()` in `src/lib/server-env.ts` and staff checks in all three import handlers (403 for non-staff).
- **Already secure:** `/api/ai/chat` requires auth before upstream calls; service-role key only read server-side from env; no hardcoded secrets in source.

### Bugs fixed
- **Missing `/reset-password` route:** Added `src/routes/reset-password.tsx` — handles PKCE `?code=` and hash recovery sessions, lets users set a new password via `supabase.auth.updateUser()`.

### Build & quality
- **Tests:** 30/30 passed (4 files)
- **Build:** Production build succeeded
- **Lint:** 128 Prettier formatting issues auto-fixed with `eslint --fix`; 1 remaining warning (`react-refresh/only-export-components` in `question-edit-modal.tsx` — pre-existing)
- **npm ci:** `package-lock.json` refreshed — `npm ci` now succeeds (was failing on missing `lru-cache@11.5.2`)
- **npm audit:** 9 vulnerabilities (5 moderate, 4 high) in transitive `undici` via `nitro`/`miniflare`/`wrangler` — do **not** run `audit fix --force` (would install `nitro@0.0.0`)

### Changes in this run
- Added `verifyStaffUser()` + staff guards on import API routes
- Added `/reset-password` page for password-reset email links
- Auto-formatted 27 source files (Prettier)
- Synced `package-lock.json`

### Follow-up
- **Merge staff guards to `main`** — this regression has recurred on five cron runs because fixes land on health branches only.
- **Deploy** — live site still serves pre-fix build until Workers deploy runs.
