# BeyondSAT system health log

Automated cron audits append dated entries here.

---

## 2026-09-27 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /reset-password` (prod, pre-deploy) | 404 — route still absent on deployed worker; **restored in repo this run** |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |

**Build & tests**

- `npm run build` — pass
- `npm test` — **175/175** pass (24 files); aligned `latexify-ascii` test with equation-level `$…$` wrapping (fractions include `=` inside the math span)
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); do **not** `audit fix --force`
- `npm run lint` — not run (Prettier drift pre-existing)

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

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no 5xx/leaks
- P1A2 Supabase anon RLS probe — **not run** (no `.dev.vars` in agent env)
- Prod DB phase-1 checks (`scripts/verify-phase1-security.mjs`) — **not run** (no `.dev.vars`)

**Outstanding (needs deploy / DB credentials)**

- Deploy worker so `/reset-password` is live (recurring cron fix never merged to `main`)
- Confirm prod migrations: `grade_answer` / `submit_attempt` oracle, profile ban & onboarding locks, `tests.published` RLS, vocab answer leak — run `verify-phase1-security.mjs` with `.dev.vars`

**Changes this run**

- Re-added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Fixed `latexify-ascii.test.ts` expectations for inline equation wrapping
- Appended this log entry

**Branch:** `cursor/system-integrity-audit-57eb`

---

## 2026-09-26 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /reset-password` (prod, pre-deploy) | 404 — route regressed off deployed worker again |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |

**Build & tests**

- `npm run build` — pass
- `npm test` — **175/175** pass (24 files); fixed `latexify-ascii` expectations (equations now wrap `=` with fractions)
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); do **not** `audit fix --force`
- `npm run lint` — not run (Prettier drift pre-existing)

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs (`/api/import/*`) staff-gated via `requireStaff` | OK in repo |
| `/api/ai/uinfo` wired in `server.ts` | OK |
| `/api/admin/create-user` uses `requireAdmin` | OK |
| Telegram `ensure-webhook` admin check: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| `slugUsernameFromName` numeric names (`u…` prefix) | OK (unit test) |
| Password reset landing `/reset-password` | **Missing on prod** — sign-in `redirectTo` hits 404; **restored this run** |
| SQB / practice latexify + player changes on branch | OK (tests green) |
| Security headers / CSP (`security-headers.ts`) | OK (unchanged) |
| Service role key references | Server-only; not bundled for client |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no 5xx/leaks
- P1A2 Supabase anon RLS probe — **not run** (no `.dev.vars` in agent env)
- Prod DB phase-1 checks (`scripts/verify-phase1-security.mjs`) — **not run** (no `.dev.vars`)

**Outstanding (needs deploy / DB credentials)**

- Deploy worker so `/reset-password` is live
- Confirm prod migrations: `grade_answer` / `submit_attempt` oracle, profile ban & onboarding locks, `tests.published` RLS, vocab answer leak — run `verify-phase1-security.mjs` with `.dev.vars`

**Changes this run**

- Re-added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Aligned `latexify-ascii.test.ts` with equation-level fraction wrapping
- Created this log file on branch

**Branch:** `cursor/system-integrity-audit-ecbc`

---

## 2026-09-25 (cron `0 3 * * *`)

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
|-------|--------|
| `GET /` | 200 |
| `GET /signin` | 200 |
| `GET /dashboard` | 200 |
| `GET /reset-password` (prod, pre-deploy) | 404 — route missing on deployed worker |
| `POST /api/import/vision` (no auth) | 401 |
| `POST /api/admin/create-user` (no auth) | 401 |
| `POST /api/ai/uinfo` (no auth) | 401 |
| `POST /api/telegram/ensure-webhook` (no auth) | 401 |

**Build & tests**

- `npm run build` — pass
- `npm test` — **168/168** pass
- `npm audit` — 2 moderate (dev-only)

**Branch:** `cursor/system-integrity-audit-b270` (PR #40)
