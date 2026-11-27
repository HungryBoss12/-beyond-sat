# BeyondSAT system health log

Nightly cron notes: live probes, test/build gates, unauth pentest (P1A), and repo fixes.

## 2026-11-27

- **Live site:** `https://beyond-sat-v0.javazbek80.workers.dev` — HTTP **200** on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated route)
- **Auth surface probes:** forgot-password `{}` → 400; claim-invite GET → 405; preview-invite POST `{}` → 404; preview-invite empty body → 400; username-login ~2MB → 413 (expected via P1A); `/api/telegram/webhook` → 401
- **P1A unauth pentest:** `P1A_DONE` (no `[!]` flags)
- **Tests:** 348/348 pass (`vitest run`)
- **Typecheck / build:** pass after re-applying typecheck fixes (regressed on branch before this run)
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical); no `npm audit fix --force`
- **npm ci:** lockfile resynced via `npm install` (`lru-cache` missing on lockfile)
- **DB scripts:** `verify-phase1-security` / homepage anon checks skipped — no `.dev.vars` in cron env
- **Security spot-check:** no `eval()` in `src/`; `dangerouslySetInnerHTML` limited to KaTeX (`MathText`), chart helper, and root boot script
- **Fixed (typecheck):** removed dead SQB branches in `draft-editor.tsx` ordinary path; orphan test row typing; `analysis.session.$id` `activeSection` / `activeModule` after search-params guard
- **Added/restored:** `SYSTEM_HEALTH_LOG.md` with this entry
- **Branch:** `cursor/site-health-security-check-653c`

## 2026-11-26

- **Live site:** `https://beyond-sat-v0.javazbek80.workers.dev` — HTTP **200** on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP, HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated route)
- **Auth surface probes:** forgot-password `{}` → 400; claim-invite GET → 405; preview-invite POST `{}` → 404; username-login ~2MB → 413 (expected via P1A); `/api/telegram/webhook` → 401
- **P1A unauth pentest:** `P1A_DONE` (no `[!]` flags)
- **Tests:** 348/348 pass (`vitest run`)
- **Typecheck / build:** pass after re-applying typecheck fixes (regressed on branch before this run)
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical); no `npm audit fix --force`
- **npm ci:** lockfile resynced via `npm install` (`lru-cache` missing on `main`)
- **DB scripts:** `verify-phase1-security` / homepage anon checks skipped — no `.dev.vars` in cron env
- **Security spot-check:** no `eval()` in `src/`; `dangerouslySetInnerHTML` limited to KaTeX (`MathText`), chart helper, and root boot script
- **Fixed (typecheck):** removed dead SQB branches in `draft-editor.tsx` ordinary path; orphan test row typing; `analysis.session.$id` `activeSection` / `activeModule` for narrowed review UI
- **Added/restored:** `SYSTEM_HEALTH_LOG.md` with this entry (absent on `main`)
- **Branch:** `cursor/site-health-security-check-e325`