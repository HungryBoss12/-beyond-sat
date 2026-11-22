# BeyondSAT system health log

Automated cron notes from `/review-bugbot` runs. Each entry is append-only.

---

## 2026-11-14 (03:05 UTC)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Route | HTTP |
|-------|------|
| `/` | 200 |
| `/signin` | 200 |
| `/signup` | 200 |
| `/dashboard` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |

**Title (/)**: `BeyondSAT — Master the Digital SAT`

**Security headers (/)**: CSP enforced, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP, Permissions-Policy, Referrer-Policy.

**Unauthenticated API spot-check:** import/admin → 401; `forgot-password` empty body → 400; telegram webhook → 401; `/api/health` → 404 (no dedicated health route).

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** P1A_DONE — no `[!]` flags (route list includes admin delete/reset/invite + auth preview/claim/forgot-password).

**CI-local checks:** 282/282 tests pass; `tsc --noEmit` clean; `vite build` OK; `npm ci` OK after lockfile resync.

**npm audit:** 12 vulnerabilities (dev-chain vitest/tinypool, moderate minimatch/eslint). Safe `npm audit fix` unchanged; **not** applying `npm audit fix --force`.

**Fixed this run:**
- Restored `SYSTEM_HEALTH_LOG.md` (missing on branch / main lineage).
- Removed unreachable `variant === "sqb"` branches in `draft-editor.tsx` ordinary path (TS2367 regression on `main`).
- Typed orphan grouping test rows for mixed `source_month` fixtures.
- Re-extended P1A route list; resynced `package-lock.json` (`lru-cache` / `npm ci`).

**Not run (needs `.dev.vars` in env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`, Supabase-side DB probes.

**Lint:** Pre-existing prettier/eslint drift — not addressed.

**Branch:** `cursor/site-health-security-check-a0dd`

---

## 2026-11-13 (03:03 UTC)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev — **UP** (same route matrix as 2026-11-12).

**P1A:** P1A_DONE — no `[!]` flags. **CI-local:** 282/282 tests; typecheck + build OK.

**Fixed:** Same TS2367 / orphan test / P1A routes / lockfile / log restoration pattern as prior cron (regressions on `main`).

**Branch:** `cursor/system-health-and-security-a498`

---

## 2026-11-12 (03:04 UTC)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Route | HTTP |
|-------|------|
| `/` | 200 |
| `/signin` | 200 |
| `/signup` | 200 |
| `/dashboard` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |

**Security headers (/)**: CSP enforced, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP, Permissions-Policy, Referrer-Policy.

**Unauthenticated API spot-check:** import/admin → 401; `preview-invite` GET → 405; POST claim/preview without token → 404; `forgot-password` → 400; telegram webhook → 401. `/api/health` → 404 (no dedicated health route).

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** P1A_DONE — no `[!]` flags.

**CI-local checks:** 282/282 tests pass; `tsc --noEmit` clean; `vite build` OK.

**npm audit:** 12 vulnerabilities; safe `npm audit fix` unchanged; **not** applying `npm audit fix --force`.

**Fixed this run:**
- Restored `SYSTEM_HEALTH_LOG.md` (missing on `cursor/site-health-security-check-f260` / main lineage).
- Re-applied TS2367 fixes in `draft-editor.tsx` (dead `variant === "sqb"` branches had regressed on main).
- Re-applied orphan test row typing for mixed `source_month` fixtures.
- Re-extended P1A route list (admin delete/reset/invite + auth preview/claim/forgot-password).
- Resynced `package-lock.json` for `npm ci` (`lru-cache@11.5.3`).

**Not run (needs `.dev.vars` in env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`, Supabase-side DB probes.

**Lint:** Pre-existing prettier/eslint drift — not addressed.

**Branch:** `cursor/site-health-security-check-f260`

---

## 2026-11-11 (03:03 UTC)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Route | HTTP |
|-------|------|
| `/` | 200 |
| `/signin` | 200 |
| `/signup` | 200 |
| `/dashboard` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |

**Security headers (/)**: CSP enforced, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP, Permissions-Policy.

**Unauthenticated API spot-check:** import/admin → 401; `preview-invite` GET → 405; POST claim/preview without token → 404; `forgot-password` → 400; telegram webhook → 401. `/api/health` → 404 (no dedicated health route).

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** P1A_DONE — no `[!]` flags after syncing route list with `src/server.ts` (admin delete/reset/invite + auth preview/claim/forgot-password).

**CI-local checks:** 282/282 tests pass; `tsc --noEmit` clean; `vite build` OK.

**npm audit:** 12 vulnerabilities (2 critical in tinypool/vitest chain, moderate uuid/exceljs). Safe `npm audit fix` unchanged; **not** applying `npm audit fix --force` (breaking vitest/exceljs downgrades).

**Fixed this run:**
- Restored `SYSTEM_HEALTH_LOG.md` (file missing on branch).
- Removed unreachable `variant === "sqb"` branches in `draft-editor.tsx` ordinary path (TS2367 regression).
- Typed orphan grouping test rows so mixed `source_month` fixtures typecheck.
- Extended P1A route list; resynced `package-lock.json` (`lru-cache` / `npm ci`).

**Not run (needs `.dev.vars` in env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`, Supabase-side DB probes.

**Lint:** Pre-existing prettier/eslint drift across repo — not addressed in this pass.

**Branch:** `cursor/site-health-security-check-326b`