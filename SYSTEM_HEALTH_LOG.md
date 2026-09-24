# BeyondSAT system health log

Automated cron audits append dated entries here.

---

## 2026-09-24 (cron `0 3 * * *`)

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
- `npm test` — **136/136** pass
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); do **not** `audit fix --force`
- `npm run lint` — many Prettier drift warnings (pre-existing); not auto-fixed this run

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs (`/api/import/*`) staff-gated via `requireStaff` | OK in repo |
| `/api/ai/uinfo` wired in `server.ts` | OK |
| `/api/admin/create-user` uses `requireAdmin` | OK |
| Telegram `ensure-webhook` admin check: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| `slugUsernameFromName` numeric names (`u…` prefix) | OK (unit test) |
| Password reset landing `/reset-password` | **Missing on prod** — sign-in `redirectTo` pointed at 404; **restored this run** |
| Security headers / CSP (`security-headers.ts`) | OK (report-only CSP documented) |
| Service role key references | Server-only (`server-env`, handlers); not bundled for client |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no 5xx/leaks on unauthenticated API surface
- P1A2 Supabase anon RLS probe — **not run** (no `.dev.vars` in agent env)
- Prod DB phase-1 checks (`scripts/verify-phase1-security.mjs`) — **not run** (no `.dev.vars`)

**Outstanding (needs deploy / DB credentials)**

- Deploy worker so `/reset-password` is live
- Confirm prod migrations: `grade_answer` / `submit_attempt` oracle, profile ban & onboarding locks, `tests.published` RLS, vocab answer leak — run `verify-phase1-security.mjs` with `.dev.vars`

**Changes this run**

- Added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Created/updated this log file

**Branch:** `cursor/system-integrity-audit-b4f2`

---

## 2026-09-23 (cron `0 3 * * *`)

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
- `npm test` — **136/136** pass
- `npm audit` — 2 moderate (`vitest` / `@vitest/mocker`, dev-only); do **not** `audit fix --force`
- `npm run lint` — many Prettier drift warnings (pre-existing); not auto-fixed this run

**Code review (recurring regression watch)**

| Area | Status |
|------|--------|
| Import APIs (`/api/import/*`) staff-gated via `requireStaff` | OK in repo |
| `/api/ai/uinfo` wired in `server.ts` | OK |
| `/api/admin/create-user` uses `requireAdmin` | OK |
| Telegram `ensure-webhook` admin check: `verifySupabaseUser` then `callRpc(bs_is_admin)` | OK |
| `slugUsernameFromName` numeric names (`u…` prefix) | OK (unit test) |
| Password reset landing `/reset-password` | **Missing on `main` and prod** — sign-in `redirectTo` pointed at 404; **restored this run** |
| Security headers / CSP (`security-headers.ts`) | OK (report-only CSP documented) |

**Security (quick)**

- P1A unauth probe (`scripts/pentest/p1a-unauth.mjs`) — **P1A_DONE**, no 5xx/leaks on unauthenticated API surface
- Prod DB phase-1 checks (`scripts/verify-phase1-security.mjs`) — **not run** (no `.dev.vars` in agent env)

**Outstanding (needs deploy / DB credentials)**

- Deploy worker so `/reset-password` is live
- Confirm prod migrations: `grade_answer` / `submit_attempt` oracle, profile ban & onboarding locks, `tests.published` RLS, vocab answer leak — run `verify-phase1-security.mjs` with `.dev.vars`

**Changes this run**

- Added `src/routes/reset-password.tsx` (recovery session + `updateUser` password flow)
- Regenerated `src/routeTree.gen.ts`
- Created/updated this log file

**Branch:** `cursor/system-integrity-audit-f2a3`

---
