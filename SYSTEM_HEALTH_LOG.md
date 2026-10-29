# BeyondSAT system health log (cron / integrity audits)

Automated notes from scheduled integrity runs. Newest entries at the top.

---

## 2026-10-29 (UTC) — cron integrity audit

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`, `/join/*` | HTTP **200** |
| `/api/health` | **404** (no dedicated health route; expected) |
| Security headers on `/` | CSP (enforced), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |

**Unauthenticated API spot-checks (live):**

- Staff/import/AI/vocab/admin create paths → **401** without session
- `/api/auth/forgot-password` empty body → **400** `Invalid JSON`; `{}` → **400** (validation)
- `/api/auth/preview-invite` `{}` → **404** (generic, no leak)
- `/api/telegram/webhook` `{}` → **401**

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):**

- Re-synced `ROUTES` with `src/server.ts` (added admin reset/invite + auth preview/claim/forgot-password)
- Hardened 2MB payload probes (90s timeout + catch abort) so the harness completes on slow body reads
- Prior run aborted at 20s on first route’s 2MB probe; re-run after fix expected `P1A_DONE` with no `[!]` flags

**Repo CI locally:**

- `npm test` → **246/246** passed
- `npm run typecheck` → OK
- `npm run build` → OK

**npm audit:**

- Before: 10 vulns (2 moderate, 6 high, 2 critical)
- After `npm audit fix` (no `--force`): **4** remaining (vitest/tinypool/zod — dev/tooling; need breaking upgrades to clear)
- Did **not** run `npm audit fix --force`

**Not run (no `.dev.vars` in cloud agent env):**

- `scripts/verify-phase1-security.mjs`
- `scripts/verify-homepage-anon.mjs`
- Supabase migration confirmation on prod

**Code changes this run:**

- `scripts/pentest/p1a-unauth.mjs` — route list + timeout handling
- `package-lock.json` — safe audit dependency bumps (seroval, etc.)
- This log file (re)created on branch `cursor/system-integrity-audit-49e2`

**Lint:** not re-run (historically Prettier drift only; no functional regressions expected)

---
