# BeyondSAT system health log

Automated cron reviews (`0 3 * * *`). Each entry summarizes live checks, CI-local gates, security probes, and repo fixes from that run.

---

## 2026-11-09 (UTC)

**Live:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Path | Status |
|------|--------|
| `/` | 200 |
| `/signin` | 200 |
| `/dashboard` | 200 |
| `/signup` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |
| `/api/health` | 404 (no dedicated health route) |

**Response headers on `/`:** CSP **enforced**, HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

**Unauthenticated API spot-checks:** import/admin → 401; forgot-password → 400; telegram webhook → 401; preview-invite GET → 405; preview-invite POST → 404.

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** `P1A_DONE`, zero `[!]` flags (route list includes admin reset/invite + auth preview/claim/forgot).

**Local gates:** `npm run typecheck` OK · `npm run test` **282/282** · `npm run build` OK · `npm ci` OK after lockfile refresh.

**npm:** Lockfile out of sync (`lru-cache@11.5.3`). Refreshed via `npm install`. **12** advisories remain (safe `npm audit fix` unchanged; force would bump majors — not applied).

**Fixes this run**

- Removed unreachable SQB branches in `draft-editor.tsx` ordinary path (TS2367 regression on `main`).
- Explicit row typing in `load-existing-orphans.test.ts`.
- Added missing P1A routes: delete-student, reset-student-password, student-invite, preview/claim-invite, forgot-password.
- Restored `SYSTEM_HEALTH_LOG.md` (absent on `main` / this branch).

**Not run (no `.dev.vars` / `.env.local` in agent env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`.

**Lint:** `npm run lint` reports widespread pre-existing prettier drift (not touched this run).

**Branch:** `cursor/site-health-security-check-3302`

---

## 2026-11-08 (UTC)

**Live:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Path | Status |
|------|--------|
| `/` | 200 |
| `/signin` | 200 |
| `/dashboard` | 200 |
| `/signup` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |
| `/api/health` | 404 (no dedicated health route) |

**Response headers on `/`:** CSP **enforced** (full policy, no report-only), HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

**Unauthenticated API spot-checks:** import/admin → 401; forgot-password → 400; telegram webhook → 401; preview-invite GET → 405.

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** `P1A_DONE`, zero `[!]` flags.

**Local gates:** `npm run typecheck` OK · `npm run test` **282/282** · `npm run build` OK · `npm ci` OK after lockfile refresh.

**npm:** Lockfile was out of sync (`lru-cache@11.5.3`). Refreshed via `npm install` + safe `npm audit fix`. **13** advisories remain (force fix would bump majors — not applied).

**Fixes this run**

- Re-applied unreachable SQB branch cleanup in `draft-editor.tsx` (main branch had regressed; TS2367).
- Re-applied orphan-math test row typing (`load-existing-orphans.test.ts`).
- Re-synced P1A route list with `src/server.ts` (admin reset/invite + auth preview/claim/forgot).
- Restored `SYSTEM_HEALTH_LOG.md` (missing on `cursor/system-health-check-cb2a`).

**Not run (no `.dev.vars` / `.env.local` in agent env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`.

**Branch:** `cursor/system-health-check-cb2a`

---

## 2026-11-07 (UTC)

**Live:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Path | Status |
|------|--------|
| `/` | 200 |
| `/signin` | 200 |
| `/dashboard` | 200 |
| `/signup` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |
| `/api/health` | 404 (no dedicated health route) |

**Response headers on `/`:** CSP **enforced** (`CSP_ENFORCE=1` in `wrangler.jsonc`), HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

**Unauthenticated API spot-checks:** import/admin → 401; forgot-password → 400; telegram webhook → 401; preview-invite GET → 405.

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** `P1A_DONE`, zero `[!]` flags.

**Local gates:** `npm run typecheck` OK · `npm run test` **282/282** · `npm run build` OK · `npm ci` OK after lockfile refresh.

**npm:** Lockfile was out of sync (`lru-cache@11.5.3`, miniflare/sharp transitive drift). Refreshed via `npm install` + safe `npm audit fix`. **18** advisories remain (force fix would bump majors — not applied).

**Fixes this run**

- Re-applied unreachable SQB branch cleanup in `draft-editor.tsx` (main had regressed; TS2367).
- Re-applied orphan-math test row typing (`load-existing-orphans.test.ts`).
- Re-synced P1A route list with `src/server.ts` (admin reset/invite + auth preview/claim/forgot).
- Restored `SYSTEM_HEALTH_LOG.md` (missing on branch).

**Not run (no `.dev.vars` / `.env.local` in agent env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`.

**Branch:** `cursor/site-health-security-check-306e`

---

## 2026-11-06 (UTC)

**Live:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Path | Status |
|------|--------|
| `/` | 200 |
| `/signin` | 200 |
| `/dashboard` | 200 |
| `/signup` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |
| `/api/health` | 404 (no dedicated health route) |

**Response headers on `/`:** CSP **enforced** (`CSP_ENFORCE=1` in `wrangler.jsonc`), HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

**Unauthenticated API spot-checks:** import/admin → 401; forgot-password → 400; telegram webhook → 401; preview-invite GET → 405.

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** `P1A_DONE`, zero `[!]` flags. Route list re-synced with `src/server.ts` (admin reset/invite + auth preview/claim/forgot had dropped off main).

**Local gates:** `npm run typecheck` OK · `npm run test` **282/282** · `npm run build` OK · `npm ci` OK after lockfile refresh.

**npm:** Lockfile was out of sync (`lru-cache@11.5.3`, wrangler/sharp transitive drift). Refreshed via `npm install` + safe `npm audit fix`. **18** advisories remain (force fix would bump majors — not applied).

**Fixes this run**

- Removed unreachable SQB branches in `draft-editor.tsx` ordinary path (TS2367 after early `variant === "sqb"` return).
- Typed orphan-math test rows so `source_month: 6` is valid (`load-existing-orphans.test.ts`).
- Restored full P1A route coverage in `scripts/pentest/p1a-unauth.mjs`.

**Not run (no `.dev.vars` / `.env.local` in agent env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`.

**Branch:** `cursor/system-health-and-security-96bc`

---

## 2026-11-05 (UTC)

**Live:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Path | Status |
|------|--------|
| `/` | 200 |
| `/signin` | 200 |
| `/dashboard` | 200 |
| `/signup` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |
| `/api/health` | 404 (no dedicated health route) |

**Response headers on `/`:** CSP (report-only on prod unless `CSP_ENFORCE=1`), HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

**Unauthenticated API spot-checks:** import/admin/AI → 401; forgot-password → 400; telegram webhook → 401; preview-invite GET → 405.

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** `P1A_DONE`, zero `[!]` flags. Route list synced with `src/server.ts` (admin reset/invite + auth preview/claim/forgot).

**Local gates:** `npm run typecheck` OK · `npm run test` **278/278** · `npm run build` OK · `npm ci` OK after lockfile refresh.

**npm:** Lockfile was out of sync (`Missing: lru-cache@11.5.3` and transitive wrangler/sharp entries). Refreshed via `npm install` + safe `npm audit fix`. **13** advisories remain (force fix would bump majors — not applied).

**Fixes this run**

- Removed unreachable SQB branches in `draft-editor.tsx` ordinary path (TS2367 after early `variant === "sqb"` return).
- Typed orphan-math test rows so `source_month: 6` is valid (`load-existing-orphans.test.ts`).
- Expanded P1A route coverage in `scripts/pentest/p1a-unauth.mjs`.

**Not run (no `.dev.vars` / `.env.local` in agent env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`.

**Branch:** `cursor/site-health-security-check-1bca`

---

## 2026-11-04 (UTC)

**Live:** https://beyond-sat-v0.javazbek80.workers.dev — **UP**

| Path | Status |
|------|--------|
| `/` | 200 |
| `/signin` | 200 |
| `/dashboard` | 200 |
| `/signup` | 200 |
| `/reset-password` | 200 |
| `/join/*` (sample token) | 200 |
| `/api/health` | 404 (no dedicated health route) |

**Response headers on `/`:** CSP, HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

**Unauthenticated API spot-checks:** import/admin/AI → 401; forgot-password → 400; telegram webhook → 401; preview-invite GET → 405.

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):** `P1A_DONE`, zero `[!]` flags. Route list synced with `src/server.ts` (added admin reset/invite + auth preview/claim/forgot).

**Local gates:** `npm run typecheck` OK · `npm run test` **278/278** · `npm run build` OK.

**npm:** `npm ci` was out of sync (`Missing: lru-cache@11.5.3`); lockfile refreshed via `npm install`. `npm audit fix` (safe) applied; **26** advisories remain (force fix would bump Zod major — not applied).

**Fixes (prior run on branch `cursor/site-health-security-check-2e83`)**

- Removed unreachable SQB branches in `draft-editor.tsx` ordinary path (TS2367 after early `variant === "sqb"` return).
- Typed orphan-math test rows so `source_month: 6` is valid (`load-existing-orphans.test.ts`).
- Expanded P1A route coverage in `scripts/pentest/p1a-unauth.mjs`.

**Not run (no `.dev.vars` / `.env.local` in agent env):** `scripts/verify-phase1-security.mjs`, `scripts/verify-homepage-anon.mjs`.
