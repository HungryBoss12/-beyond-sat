# BeyondSAT system health log

Automated cron checks (site liveness, security spot-checks, CI-equivalent gates). Newest entries first.

## 2026-11-28

| Check | Result |
| --- | --- |
| Live worker | **UP** — `https://beyond-sat-v0.javazbek80.workers.dev` |
| Routes | `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password` → HTTP 200 |
| Title | `BeyondSAT — Master the Digital SAT` |
| `/api/health` | 404 (no dedicated route) |
| Security headers | CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| Auth surface | `preview-invite` POST `{}` → 404; `forgot-password` → 400; `claim-invite` GET → 405; `username-login` 2MB → 413; `telegram/webhook` → 401 |
| P1A unauth pentest | **P1A_DONE** — no `[!]` flags |
| `npm run test` | 348/348 passed |
| `npm run typecheck` | OK (after fixes below) |
| `npm run build` | OK |
| `npm audit` | 12 vulns (10 moderate, 2 critical); no `--force` fix |
| DB scripts | Skipped — no `.dev.vars` in this environment |

### Changes this run

- **Fixed** `draft-editor.tsx`: removed dead `sqb` branches after early return (TS2367).
- **Fixed** `load-existing-orphans.test.ts`: explicit row typing for `source_month`.
- **Fixed** `analysis.session.$id.tsx`: `activeSection` / `activeModule` for `openPart` when search params optional.
- **Added** `package-lock.json` resync (`lru-cache` / `npm ci` alignment).
- **Added** this log file on branch `cursor/system-health-check-f033`.