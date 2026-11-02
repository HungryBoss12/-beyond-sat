# BeyondSAT system health log

Automated cron reviews. Newest entries first.

## 2026-11-02 (UTC)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`, `/join/*` | HTTP 200 |
| `/api/health` | 404 (no dedicated route; expected) |
| Security headers on `/` | CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |

**Unauthenticated API spot checks**

| Endpoint | POST `{}` |
| --- | --- |
| `/api/import/vision`, `/api/admin/create-user`, `/api/ai/chat`, `/api/telegram/webhook` | 401 |
| `/api/admin/student-invite` | 401 |
| `/api/auth/forgot-password` | 400 (validation before auth) |
| `/api/auth/preview-invite` | 404 (generic, no leak) |
| `/api/auth/claim-invite` (invalid token) | 404 |

**P1A harness** (`node scripts/pentest/p1a-unauth.mjs`): `P1A_DONE` — no `[!]` flags.

**Repo / CI**

| Step | Result |
| --- | --- |
| `npm ci` | OK after lockfile resync |
| `npm run typecheck` | OK (fixed regressions — see changes) |
| `npm test` | 278 / 278 passed |
| `npm run build` | OK |
| `npm audit fix` (safe) | 26 vulns remain (mostly dev/tooling); no `--force` |

**Changes this run**

- Resynced `package-lock.json` (was out of sync with `package.json`; `npm ci` failed on `lru-cache` and optional Cloudflare/sharp peers).
- Extended `scripts/pentest/p1a-unauth.mjs` route list to match `src/server.ts` (admin reset/invite + auth invite/forgot-password).
- Removed dead SQB branches in `DraftEditor` ordinary path (unreachable after early `variant === "sqb"` return; fixed TypeScript TS2367 errors).
- Typed orphan-math test rows via `Parameters<typeof groupOrphanMathQuestions>[0]`.

**Not verified (needs `.dev.vars` / DB in agent env)**

- `node scripts/verify-phase1-security.mjs`
- `node scripts/verify-homepage-anon.mjs`
- Authenticated pentest phases P1B–P3

**Branch:** `cursor/site-health-security-check-9128`

---

## Prior runs (summary)

See automation memory / earlier PRs (#53–#56) for 2026-10-27 through 2026-11-01 entries. Recurring notes: production worker healthy; unauth surface clean; DB verification scripts require local secrets.
