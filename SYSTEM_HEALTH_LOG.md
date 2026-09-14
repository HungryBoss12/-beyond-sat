# BeyondSAT system health log

Automated cron audits append entries here (newest first).

---

## 2026-09-14 — cron `review-bugbot`

**Live site** (`https://beyond-sat-v0.javazbek80.workers.dev`)

| Route | Status (before fix) | Notes |
|-------|-------------------|--------|
| `/` | 200 | OK |
| `/signin` | 200 | OK |
| `/dashboard` | 200 | OK (redirects unauthenticated users as expected) |
| `/reset-password` | **404** | Route file + `routeTree.gen.ts` missing on branch; restored this run |
| `/api/health` | 404 | No dedicated health endpoint (not a regression) |

**Security**

- **Regression (28th occurrence):** `/api/import/vision`, `/api/import/fix`, and `/api/import/figure` only required a signed-in user, allowing any student to burn Gemini/OpenRouter quota. Re-secured with `verifyStaffUser()` → `bs_is_staff` RPC.
- Restored `verifyStaffUser()` in `src/lib/server-env.ts`.
- **Telegram ensure-webhook:** fixed `callRpc(config, "bs_is_admin", token, {})` argument order (was passing the bearer token as the RPC name, so admin bearer auth never worked).
- Unauthenticated POST to `/api/import/vision` on production returns **401** (expected).
- Vocab generate/admin APIs already use `requireStaff`; create-user handler uses `requireStaff`.

**Bugs fixed**

- Restored `src/routes/reset-password.tsx` and registered `/reset-password` in `routeTree.gen.ts` (password recovery target from sign-in).
- `slugUsernameFromName("12")` now yields `user12` (was `u12`), matching tests and staff create-user rules.

**Still open (DB / migrations — not changed this run)**

- `grade_answer` callable by any authenticated user (answer oracle).
- Profile ban / onboarding bypass via direct profile updates (RLS).
- Vocab quiz answer leakage via client-visible columns.
- `tests.published` visibility for unpublished tests.

**Tooling**

- Tests: **96/96** passed (`npm test`).
- `npm audit`: **11** issues (2 moderate, 9 high); do **not** run `audit fix --force`.
- `npm run build`: fails in this agent sandbox (missing private `@lovable.dev/vite-tanstack-config`); Lovable/CI builds unaffected.

**Branch:** `cursor/system-integrity-audit-ed30`
