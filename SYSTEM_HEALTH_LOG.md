# BeyondSAT system health log

Cron audit run: **2026-09-21** (UTC).

## Live site (`https://beyond-sat-v0.javazbek80.workers.dev`)

| Check | Result |
| --- | --- |
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /reset-password` | **404** (fixed in repo; needs deploy) |
| Security headers | CSP report-only, `nosniff`, `referrer-policy` present |

## API auth smoke (unauthenticated POST)

| Route | Expected | Live |
| --- | --- | --- |
| `/api/import/vision` | 401 | 401 |
| `/api/import/fix` | 401 | 401 |
| `/api/import/figure` | 401 | 401 |
| `/api/ai/uinfo` | 401 | 401 |
| `/api/telegram/ensure-webhook` | 401 | 401 |
| `/api/admin/create-user` | 401 | 401 |

## Codebase checks

| Area | Status |
| --- | --- |
| `requireStaff` on import vision/fix/figure | OK |
| `requireAdmin` on `/api/admin/create-user` | OK |
| `/api/ai/uinfo` wired in `server.ts` | OK |
| Telegram `ensure-webhook` `callRpc(config, fn, token, {})` order | OK |
| `slugUsernameFromName` numeric names (`user12` pattern) | OK (tests) |
| Committed `.env` | Public Supabase + `VITE_APP_URL` only (no secrets) |
| `npm test` | **136/136** passed |
| `npm run build` | OK |
| `npm audit` | 2 moderate (`vitest` / `@vitest/mocker` dev-only); do **not** `audit fix --force` |
| `npm run lint` | Prettier noise on marketing routes (pre-existing); not auto-fixed this run |
| `scripts/verify-phase1-security.mjs` | Skipped (no `.dev.vars` in agent env) |

## Changes this run

- **Added** `src/routes/reset-password.tsx` — password recovery page for Supabase email reset links (missing on `main`, live 404).
- **Regenerated** `src/routeTree.gen.ts` after route restore.
- **Added** this log file.

## Removed

- Nothing removed.

## Not changed (known follow-ups)

- **Deploy** required for reset-password fix to reach production.
- **Supabase migrations** on production DB should be verified separately (`grade_answer`, profile security, vocab quiz answer protection, `tests.published` RLS) — run `node scripts/verify-phase1-security.mjs` locally with `.dev.vars` when DB password is available.
- **CSP enforcement**: still report-only until `CSP_ENFORCE=1` on the Worker after clean reports.

## Prior recurring regressions (watch list)

These have reappeared on `main` in past cron runs; all **currently OK** in tree except reset-password route (fixed above):

- Import APIs missing `requireStaff`
- Missing `/api/ai/uinfo` route
- Wrong `callRpc` argument order in telegram ensure-webhook
- Missing reset-password route / route tree entry
- `slugUsernameFromName` producing invalid numeric-only usernames
