# BeyondSAT system health log

Nightly cron notes for live checks, CI-equivalent gates, and security probes.

---

## 2026-11-01 (UTC)

**Live site** (`https://beyond-sat-v0.javazbek80.workers.dev`)

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password` | HTTP 200 |
| `/join/*` (sample token) | HTTP 200 |
| `/api/health` | 404 (no dedicated route; unchanged) |
| Security headers on `/` | HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |

**Unauthenticated API spot checks**

| Endpoint | POST `{}` |
| --- | --- |
| `/api/admin/*` | 401 |
| `/api/auth/preview-invite`, `/api/auth/claim-invite` | 404 (generic) |
| `/api/auth/forgot-password` | 400 |
| `/api/telegram/webhook` | 401 |

**P1A pentest** (`node scripts/pentest/p1a-unauth.mjs`): `P1A_DONE` — no `[!]` flags.

**Repo gates**

| Gate | Result |
| --- | --- |
| `npm test` | 269/269 passed |
| `npm run typecheck` | pass (after orphan test typing fix) |
| `npm run build` | pass (after `npm install` lockfile resync) |
| `npm audit fix` (safe) | 26 vulns remain; no `--force` (zod/vitest tooling) |

**Changes this run**

- Synced `package-lock.json` with `package.json` (`lru-cache` / install drift blocked `npm ci`).
- Fixed `load-existing-orphans.test.ts` inference so `source_month: 6` typechecks.
- Expanded P1A route list: admin reset/invite + auth preview/claim/forgot-password (aligned with `src/server.ts`).

**Not run (no `.dev.vars` in agent env)**

- `scripts/verify-phase1-security.mjs`
- `scripts/verify-homepage-anon.mjs`

**Branch:** `cursor/site-health-security-check-d9ab`
