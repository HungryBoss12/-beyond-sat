# BeyondSAT system health log

Cron automation entries (newest first).

## 2026-10-28 — system integrity audit

**Live:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/signup`, `/dashboard`, `/reset-password` | HTTP 200 |
| `/join/*` (invalid token) | HTTP 200 (SSR page; expected) |
| `/api/health` | HTTP 404 (no dedicated health route) |
| Security headers (CSP enforced, HSTS, X-Frame-Options, nosniff) | Present on `/` |
| Sensitive APIs unauthenticated (`import`, `ai/uinfo`, `admin/*`) | 401 + generic JSON |
| Invite preview/claim (`/api/auth/preview-invite`, `claim-invite`) | 404 + generic error for invalid token |
| Forgot password empty body | 400 + generic validation message |
| P1A unauth pentest (`scripts/pentest/p1a-unauth.mjs`) | **P1A_DONE** (no `[!]` flags) |

**CI-local (this run):**

- `npm test`: 246/246 passed (39 files)
- `npm run typecheck`: pass
- `npm run build`: pass
- `npm run lint`: 2988 issues (mostly Prettier drift; pre-existing, not fixed this run)
- `npm audit` after safe `npm audit fix`: 4 vulns remain (zod high in nested deps + dev tooling; do not `audit fix --force` without review)
- `package-lock.json` was out of sync with `package.json` (`npm ci` failed until `npm install`)

**Changes this run:**

- Synced `package-lock.json` (`npm install` + safe `npm audit fix`)
- Restored full P1A route list (admin reset/invite, forgot-password, preview/claim-invite) to match `src/server.ts`
- Added this health log entry

**Not verified (no `.dev.vars` in agent env):**

- `scripts/verify-phase1-security.mjs` (DB RLS cross-role probes)
- `scripts/verify-homepage-anon.mjs` (anon read of `homepage_sections`)
- Production migration parity (`supabase db push` / pending migrations)

**Notes:**

- No application code defects found requiring a hotfix this run.
- Live worker matches expected auth boundaries on all registered API routes.
