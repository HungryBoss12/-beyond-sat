# BeyondSAT system health log

Automated cron notes from site health / security rechecks.

## 2026-11-03 (UTC)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`, `/join/*` | HTTP 200 |
| `/api/health` | 404 (no dedicated route; expected) |
| Security headers on `/` | CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| Unauth APIs (sample) | `create-user`, `import/vision`, `ai/chat`, `telegram/webhook` → 401; `forgot-password` → 400; `preview-invite` GET → 405; `claim-invite` POST `{}` → 404 |
| P1A unauth pentest (`scripts/pentest/p1a-unauth.mjs`) | **P1A_DONE** — no `[!]` flags (route list synced with `src/server.ts`) |

**Repo / CI-style checks**

| Check | Result |
| --- | --- |
| `npm ci` | OK after lockfile resync (`lru-cache@11.5.3` was missing) |
| `npm run typecheck` | OK after fixes (see below) |
| `npm run test` | 278/278 passed |
| `npm run build` | OK |
| `npm run lint` | Fails (large pre-existing Prettier/eslint backlog; not touched this run) |
| `npm audit` (high+) | 32 reported; safe `npm audit fix` applied — do **not** `audit fix --force` without review |

**Changes this run**

- Removed unreachable `variant === "sqb"` branches in `DraftEditor` ordinary layout (TypeScript TS2367; SQB still uses early return).
- Typed orphan grouping test rows so `source_month: 6` is valid (`load-existing-orphans.test.ts`).
- Extended P1A route list: admin reset/invite, auth preview/claim/forgot-password.
- Resynced `package-lock.json` (`npm install` + safe audit fix).

**Not run (needs local secrets)**

- `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs` — no `.dev.vars` in this environment.

**Security notes (static review)**

- `MathText` escapes HTML and only re-emits balanced `<u>` tags; KaTeX for math — no new XSS findings.
- No `.dev.vars` in agent env; no secrets logged.

**Branch:** `cursor/system-health-and-security-e5a4`
