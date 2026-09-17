# BeyondSAT system health log

## Cron audit — 2026-09-17 (UTC)

### Live site (`https://beyond-sat-v0.javazbek80.workers.dev`)

| Route / check | Status |
|---------------|--------|
| `/` | **200** |
| `/signin` | **200** |
| `/dashboard` | **200** |
| `/reset-password` | **404** on production (route restored in repo; needs deploy) |
| `POST /api/import/vision` (no auth) | **401** (live worker still allows any signed-in user until deploy + staff gate) |
| `POST /api/ai/uinfo` (no auth) | **401** |
| `POST /api/telegram/ensure-webhook` (no auth) | **401** |

### Fixes applied this run

1. **Security — import APIs (regression)**  
   `/api/import/vision`, `/api/import/fix`, and `/api/import/figure` again required only a valid session. Re-applied `requireStaff()` + `bs_is_staff` on all three handlers.

2. **Missing worker route — uinfo flush (regression)**  
   Client `logUinfo()` calls `POST /api/ai/uinfo`, but `src/server.ts` did not register `handleUinfoFlush`. Route wiring restored.

3. **Telegram ensure-webhook admin auth (regression)**  
   `callRpc` was invoked with `(config, token, "bs_is_admin")` instead of `(config, "bs_is_admin", token, {})`, so bearer admin checks always failed (setup token still worked).

4. **Password reset page missing (regression)**  
   Restored `src/routes/reset-password.tsx` and registered `/reset-password` in `src/routeTree.gen.ts` (sign-in reset emails point here).

5. **Username slug for numeric-only names (regression)**  
   `slugUsernameFromName("12")` returned `u12` and failed tests; restored logic that yields `user12` when the name has no letters.

### Verified unchanged / OK

- `slugUsernameFromName` / staff create-user tests pass after fix.
- Vocab admin, create-user, and other staff routes still use `requireStaff()`.
- Service role keys remain server-only (worker env / `client.server.ts`), not bundled for browser.

### Tests & tooling

- **Vitest:** 108/108 passed (`npm test`).
- **Build:** `npm run build` fails in this agent sandbox (missing `@lovable.dev/vite-tanstack-config`); production deploys via Lovable/CI.
- **npm audit:** 11 vulnerabilities (2 moderate, 9 high). Do **not** run `npm audit fix --force` (breaking vitest major). Safe `npm audit fix` not applied this run to avoid unrelated churn.

### Security notes (still open — DB / RLS migrations)

These were noted in prior cron runs and were **not** changed here (require Supabase migrations / policy review):

- `grade_answer` callable by any authenticated user (answer oracle risk).
- Profile / onboarding / ban enforcement gaps in RLS (reported previously).
- Vocab quiz answer leakage via policies (reported previously).
- `tests.published` visibility (reported previously).

### Removed

- Nothing deleted this run.

### Added

- `SYSTEM_HEALTH_LOG.md` (this file).
- `src/routes/reset-password.tsx` (restored from last good audit branch).

### Next deploy impact

After the next Workers deploy, expect `/reset-password` **200**, import APIs **403** for non-staff students, uinfo summarization flush to work again, and Telegram ensure-webhook to accept admin bearer tokens.
