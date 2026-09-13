# BeyondSAT system health log

Automated cron audits append entries here (newest first).

---

## 2026-09-13 — cron `review-bugbot`

**Live site** (`https://beyond-sat-v0.javazbek80.workers.dev`)

| Route | Status (before fix) | Notes |
|-------|-------------------|--------|
| `/` | 200 | OK |
| `/signin` | 200 | OK |
| `/reset-password` | **404** | Route file + `routeTree.gen.ts` missing on `main`; restored this run |

**Security**

- **Regression (27th occurrence):** `/api/import/vision`, `/api/import/fix`, and `/api/import/figure` only required a signed-in user, allowing any student to burn Gemini/OpenRouter quota. Re-secured with `verifyStaffUser()` → `bs_is_staff` RPC (same pattern as prior audits).
- Restored `verifyStaffUser()` in `src/lib/server-env.ts` (had been dropped from tree).
- Telegram `ensure-webhook` admin path: `callRpc(config, "bs_is_admin", token)` argument order already correct.
- Unauthenticated POST to `/api/import/vision` returns **401** on production (expected).

**Bugs fixed**

- Restored `src/routes/reset-password.tsx` and regenerated `routeTree.gen.ts` (password recovery from sign-in redirect).
- `slugUsernameFromName("12")` now yields `user12` (was `u12`), matching staff create-user username rules and tests.

**Still open (DB / migrations — not changed this run)**

- `grade_answer` callable by any authenticated user (answer oracle).
- Profile ban / onboarding bypass via direct profile updates (RLS).
- Vocab quiz answer leakage via client-visible columns.
- `tests.published` visibility for unpublished tests.

**Tooling**

- Tests: **96/96** passed after username fix (`npm test`).
- `npm audit`: **11** issues (2 moderate, 9 high); do **not** run `audit fix --force`.
- `npm run build`: fails in this agent sandbox (missing private `@lovable.dev/vite-tanstack-config`); Lovable/CI builds unaffected.
- Lint: Prettier noise pre-existing; not bulk-formatted.

**Branch:** `cursor/system-integrity-audit-79f6`
