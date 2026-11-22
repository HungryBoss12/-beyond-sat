# BeyondSAT system health log

Rolling log from automated site-health / security cron runs.

## 2026-11-10

**Live (https://beyond-sat-v0.javazbek80.workers.dev)**  
- `/`, `/signin`, `/signup`, `/dashboard`, `/reset-password`, `/join/test` → HTTP 200  
- `/api/health` → 404 (no dedicated health route; expected)  
- Security headers on `/`: CSP enforced, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`

**Unauthenticated API spot-check**  
- Admin/import/telegram routes → 401 on empty POST  
- `POST /api/auth/forgot-password` → 400 (validation)  
- `GET /api/auth/preview-invite` → 405; `POST` without token → 404 (invalid invite)  
- `POST /api/auth/claim-invite` without token → 404 (short token gate)

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`)**  
- `P1A_DONE` — no `[!]` flags  
- Extended route list: admin delete/reset/invite, auth preview/claim/forgot-password (aligned with `src/server.ts`)

**Build / CI locally**  
- `npm ci` was broken (missing `lru-cache@11.5.3` in lockfile) → resynced with `npm install`  
- `npm test`: 282/282 passed  
- `npm run typecheck` + `npm run build`: OK after fixes below  
- `npm audit`: 12 vulnerabilities; safe `npm audit fix` applied where non-breaking; no `--force`

**Fixed this run**  
- Removed unreachable `variant === "sqb"` branches in ordinary `DraftEditor` path (TS2367 regression)  
- `load-existing-orphans.test.ts`: explicit row typing for mixed `source_month`  
- Restored `SYSTEM_HEALTH_LOG.md` on branch  
- P1A route list sync

**Not run (no `.dev.vars` in agent env)**  
- `scripts/verify-phase1-security.mjs`  
- `scripts/verify-homepage-anon.mjs`

**Lint**  
- Pre-existing prettier/eslint drift; not addressed in cron.
