# BeyondSAT system health log

Automated cron audits append dated entries here.

---

## 2026-10-09 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /signup` | 200 |
| `GET /join/$token` | 200 |
| `GET /reset-password` (prod) | **404** — still not deployed; **restored in repo again** |
| `GET /api/health` | 404 (no health route; expected) |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/admin/student-invite` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/vocab/generate` (no auth) | 401 |
| `POST /api/telegram/webhook` (no auth) | 401 |
| `POST /api/auth/preview-invite` (bad token) | 404 generic body |
| `POST /api/auth/claim-invite` (bad token) | 404 generic body |

**Build & tests**

- `npm run build` — pass
- `npm test` — **228/228** pass (35 files)
- `npm audit` — 5 issues after safe `npm audit fix` (`seroval`, `sharp`); **do not** `audit fix --force` (vitest/katex major)
- `npm run lint` — not run to completion (large Prettier drift pre-existing)

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs staff-gated via `requireStaff` | OK (repo + live 401) |
| Admin APIs use `requireAdmin` | OK |
| Student invite preview/claim | OK — generic errors on bad tokens |
| Telegram webhook / ensure-webhook unauth | 401 |
| Password reset `/reset-password` | **Missing on prod** — sign-in `redirectTo` 404 until deploy |
| `MathText` HTML allowlist + escape | OK (unchanged) |
| Service role / secrets | Server-only handlers; no new client leaks found |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no flags
- P1A2 / `verify-phase1-security.mjs` — **not run** (no `.dev.vars` in agent env)

**Outstanding**

- **Deploy** worker so `/reset-password` is live (recurring; audit PRs not merged to prod deploy)
- Run prod DB phase-1 checks with `.dev.vars` when credentials available

**Changes this run**

- Re-added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Appended `SYSTEM_HEALTH_LOG.md` (this entry)
- `package-lock.json` — safe `npm audit fix` (`seroval`, `sharp`)

**Branch:** `cursor/system-integrity-audit-92c3`

---

## 2026-10-08 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /signup` | 200 |
| `GET /join/$token` | 200 |
| `GET /reset-password` (prod) | **404** — route missing on deployed worker; **restored in repo this run** |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/import/fix` (no auth) | 401 |
| `POST /api/import/figure` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/admin/student-invite` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |
| `POST /api/auth/preview-invite` (invalid token) | 404 generic |
| `POST /api/auth/claim-invite` (short token) | 404 generic |

**Build & tests**

- `npm run build` — pass
- `npm test` — **228/228** pass (35 files)
- `npm audit` — 11 issues (2 low, 1 moderate, 6 high, 2 critical); safe `npm audit fix` applied (`seroval`, `sharp` bumps); **do not** `audit fix --force` (would bump vitest/nitro major)
- `npm run lint` — not run (large Prettier drift pre-existing)

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs staff-gated via `requireStaff` | OK (repo + live 401) |
| Admin APIs use `requireAdmin` | OK |
| Student invite preview/claim | OK — generic errors on bad tokens |
| Telegram `ensure-webhook`: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| Password reset `/reset-password` | **Missing on prod** — sign-in `redirectTo` 404 until deploy |
| CSP / security headers | OK (unchanged) |
| Service role / secrets | Server-only handlers; no new client leaks found |
| Latest migration `20261008000001_invite_timing_and_fee_cap.sql` | REVOKE on new SECURITY DEFINER RPCs — **prod apply not verified** (no `.dev.vars`) |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no flags
- P1A2 / `verify-phase1-security.mjs` — **not run** (no `.dev.vars` in agent env)

**Outstanding**

- **Deploy** worker so `/reset-password` is live (recurring fix; branch PRs often not merged to prod)
- Run prod DB phase-1 checks with `.dev.vars` when credentials available

**Changes this run**

- Re-added `src/routes/reset-password.tsx`
- Regenerated `src/routeTree.gen.ts`
- Appended `SYSTEM_HEALTH_LOG.md` (this entry)
- `package-lock.json` — safe `npm audit fix` (seroval, sharp)

---
## 2026-10-04 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /signup` | 200 |
| `GET /join/$token` | 200 |
| `GET /reset-password` (prod, pre-deploy) | **404** — still not on deployed worker; **restored in repo this run** (again) |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/import/fix` (no auth) | 401 |
| `POST /api/import/figure` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/admin/student-invite` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |
| `POST /api/auth/preview-invite` (invalid token) | 404 generic |
| `POST /api/auth/claim-invite` (short token) | 404 generic |

**Build & tests**

- `npm run build` — pass
- `npm test` — **222/222** pass (34 files)
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); safe `npm audit fix` applied (wrangler/undici high cleared again); do **not** `audit fix --force`
- `npm run lint` — not run (Prettier drift pre-existing)

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs staff-gated via `requireStaff` | OK (repo + live 401) |
| Admin APIs use `requireAdmin` | OK |
| Student invite preview/claim | OK — generic 404 errors on bad tokens |
| Telegram `ensure-webhook`: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| Password reset `/reset-password` | **Missing on prod** — sign-in `redirectTo` 404 until deploy |
| CSP / security headers | OK (report-only unless `CSP_ENFORCE=1`) |
| Service role / secrets | Server-only handlers; no new client leaks found |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no flags
- P1A2 / `verify-phase1-security.mjs` — **not run** (no `.dev.vars` in agent env)

**Outstanding**

- **Deploy** worker so `/reset-password` is live (recurring fix never merged to prod deploy path)
- Run prod DB phase-1 checks with `.dev.vars` when credentials available

**Changes this run**

- Re-added `src/routes/reset-password.tsx`
- Regenerated `src/routeTree.gen.ts`
- Appended `SYSTEM_HEALTH_LOG.md` (this entry)
- `package-lock.json` — safe `npm audit fix` (undici via wrangler)

---

## 2026-10-03 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /signup` | 200 |
| `GET /join/$token` | 200 |
| `GET /reset-password` (prod, pre-deploy) | **404** — route missing on deployed worker again; **restored in repo this run** |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/import/fix` (no auth) | (not re-probed; same handler gate as vision) |
| `POST /api/import/figure` (no auth) | (not re-probed; same handler gate as vision) |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/admin/student-invite` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |
| `POST /api/auth/preview-invite` (invalid token) | 404 generic error (no leak) |
| `POST /api/auth/claim-invite` (short token) | 404 generic error |

**Build & tests**

- `npm run build` — pass
- `npm test` — **221/221** pass (34 files)
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); safe `npm audit fix` applied (wrangler/undici high cleared); do **not** `audit fix --force`
- `npm run lint` — not run to completion (large Prettier drift pre-existing)

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs (`/api/import/*`) staff-gated via `requireStaff` | OK in repo |
| `/api/admin/create-user` + `/api/admin/student-invite` use `requireAdmin` | OK |
| Student invite preview/claim (`/api/auth/preview-invite`, `claim-invite`) | OK — token hashed server-side; generic 404/410 errors |
| Telegram `ensure-webhook` admin check: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| `slugUsernameFromName` numeric names (`u…` prefix) | OK (unit test) |
| Password reset landing `/reset-password` | **Missing on prod** — sign-in `redirectTo` hits 404; **restored this run** |
| Security headers / CSP (`security-headers.ts`) | OK (unchanged) |
| Service role key references | Server-only; not bundled for client |
| `wrangler.jsonc` vars | Public Supabase anon/publishable only (expected) |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no 5xx/leaks/odd statuses
- P1A2 Supabase anon RLS probe — **not run** (no `.dev.vars` in agent env)
- Prod DB phase-1 checks (`scripts/verify-phase1-security.mjs`) — **not run** (no `.dev.vars`)

**Outstanding (needs deploy / DB credentials)**

- Deploy worker so `/reset-password` is live (recurring cron fix still not on prod)
- Confirm prod migrations: oracle RPCs, profile locks, `tests.published` RLS, vocab answer leak — run `verify-phase1-security.mjs` with `.dev.vars`

**Changes this run**

- Re-added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Restored/appended `SYSTEM_HEALTH_LOG.md` (this entry)
- `package-lock.json` — safe `npm audit fix` (wrangler/undici)

---

## 2026-10-02 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /reset-password` (prod, pre-deploy) | 404 — route absent on deployed worker; **restored in repo this run** |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/import/fix` (no auth) | 401 |
| `POST /api/import/figure` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |

**Build & tests**

- `npm run build` — pass
- `npm test` — **175/175** pass (24 files); aligned `latexify-ascii` test with equation-level `$…$` wrapping (fraction + `=` in one span)
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); safe `npm audit fix` cleared **undici** high via wrangler bump; do **not** `audit fix --force`
- `npm run lint` — not run to completion (large Prettier drift pre-existing)

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs (`/api/import/*`) staff-gated via `requireStaff` | OK in repo |
| `/api/admin/create-user` uses `requireAdmin` | OK |
| Telegram `ensure-webhook` admin check: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| `slugUsernameFromName` numeric names (`u…` prefix) | OK (unit test) |
| Password reset landing `/reset-password` | **Missing on prod** — sign-in `redirectTo` hits 404; **restored this run** |
| Security headers / CSP (`security-headers.ts`) | OK (unchanged) |
| Service role key references | Server-only; not bundled for client |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no 5xx/leaks/odd statuses
- P1A2 Supabase anon RLS probe — **not run** (no `.dev.vars` in agent env)
- Prod DB phase-1 checks (`scripts/verify-phase1-security.mjs`) — **not run** (no `.dev.vars`)

**Outstanding (needs deploy / DB credentials)**

- Deploy worker so `/reset-password` is live (recurring cron fix still not on prod)
- Confirm prod migrations: `grade_answer` / `submit_attempt` oracle, profile ban & onboarding locks, `tests.published` RLS, vocab answer leak — run `verify-phase1-security.mjs` with `.dev.vars`

**Changes this run**

- Re-added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Fixed `latexify-ascii.test.ts` expectations for inline equation wrapping
- `package-lock.json` — safe audit fix (wrangler/undici)
- Restored/appended `SYSTEM_HEALTH_LOG.md` (this entry)

**Branch:** `cursor/system-integrity-audit-4fce`
