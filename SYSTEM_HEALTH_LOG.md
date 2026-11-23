# BeyondSAT system health log

Nightly cron notes: live probes, test/build gates, unauth pentest (P1A), and repo fixes.

## 2026-11-23

- **Live site:** `https://beyond-sat-v0.javazbek80.workers.dev` — HTTP **200** on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated route)
- **Auth surface probes:** forgot-password `{}` → 400; claim-invite GET → 405; preview-invite POST `{}` → 404; username-login ~2MB → 413 (expected); `/api/telegram/webhook` → 401 via P1A (bare `/api/telegram` → 404)
- **P1A unauth pentest:** `P1A_DONE` (no `[!]` flags)
- **Tests:** 348/348 pass (`vitest run`)
- **Typecheck / build:** pass after re-applying typecheck fixes (again regressed on `main`)
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical); no `npm audit fix --force`
- **npm ci:** lockfile resynced via `npm install` on branch
- **DB scripts:** `verify-phase1-security` / homepage anon checks skipped — no `.dev.vars` in cron env
- **Security spot-check:** no `eval()` in `src/`; `dangerouslySetInnerHTML` limited to KaTeX (`MathText`), chart helper, and root boot script
- **Fixed (typecheck):** removed dead SQB branches in `draft-editor.tsx` ordinary path; orphan test row typing; `analysis.session.$id` `activeSection` / `activeModule` for narrowed review UI
- **Added/restored:** `SYSTEM_HEALTH_LOG.md` on branch (absent on `main`)
- **Branch:** `cursor/system-health-and-security-4659`

## 2026-11-22

- **Live site:** `https://beyond-sat-v0.javazbek80.workers.dev` — HTTP **200** on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated route)
- **Auth surface probes:** forgot-password `{}` → 400; telegram webhook → 401; claim-invite GET → 405; preview-invite POST `{}` → 404; username-login ~2MB → 413 (expected via P1A)
- **P1A unauth pentest:** `P1A_DONE` (no `[!]` flags)
- **Tests:** 348/348 pass (`vitest run`)
- **Typecheck / build:** pass after fixes (regressed on `main` before this run)
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical); no `npm audit fix --force`
- **npm ci:** lockfile out of sync (`lru-cache`); resynced via `npm install`
- **DB scripts:** `verify-phase1-security` / homepage anon checks skipped — no `.dev.vars` in cron env
- **Fixed (typecheck):** removed dead SQB branches in `draft-editor.tsx` ordinary path; orphan test row typing; `analysis.session.$id` `activeSection` / `activeModule` for narrowed review UI
- **Branch:** `cursor/site-health-security-check-9ca3`

## 2026-11-21

- **Live site:** `https://beyond-sat-v0.javazbek80.workers.dev` — HTTP **200** on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated route)
- **Auth surface probes:** forgot-password `{}` → 400; telegram webhook → 401; claim-invite GET → 405; preview-invite POST `{}` → 404; username-login ~2MB → 413 (expected)
- **P1A unauth pentest:** `P1A_DONE` (no `[!]` flags); username-login 2MB classified ODD/413 (acceptable body limit)
- **Tests:** 348/348 pass (`vitest run`)
- **Typecheck / build:** pass after fixes (regressed on branch before this run)
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical); no `npm audit fix --force`
- **npm ci:** lockfile out of sync (`lru-cache`); resynced via `npm install`
- **DB scripts:** `verify-phase1-security` / homepage anon checks skipped — no `.dev.vars` in cron env
- **Fixed (typecheck):** removed dead SQB branches in `draft-editor.tsx` ordinary path; orphan test row typing; `analysis.session.$id` `activeSection` / `activeModule` for narrowed review UI
- **Branch:** `cursor/system-health-and-security-903e`