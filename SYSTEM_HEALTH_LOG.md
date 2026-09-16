# BeyondSAT system health log

## 2026-09-16 — Cron integrity audit (`cursor/system-integrity-audit-25bf`)

### Live site (https://beyond-sat-v0.javazbek80.workers.dev)

| Path | Status (audit start) | Notes |
|------|----------------------|--------|
| `/` | 200 | OK |
| `/signin` | 200 | OK |
| `/dashboard` | 200 | OK (SSR shell) |
| `/reset-password` | **404** | Route missing on deployed build; restored in repo (deploy pending) |

### Critical — fixed in this run

1. **Import API staff gate regression (30th occurrence)**  
   `/api/import/vision`, `/api/import/fix`, and `/api/import/figure` only required any signed-in user, allowing non-staff Gemini/OpenRouter abuse. Re-applied `requireStaff()` + `bs_is_staff` RPC (same pattern as vocab admin APIs).

2. **Missing `/api/ai/uinfo` route**  
   Client `logUinfo()` POSTs to `/api/ai/uinfo` but `server.ts` had no handler — uinfo flush never ran server-side. Wired `handleUinfoFlush` from `src/lib/uinfo/summarize.ts`.

3. **Missing `/reset-password` page**  
   Sign-in password recovery redirects to `/reset-password` but the route file and `routeTree.gen.ts` entries were absent → live 404. Restored `src/routes/reset-password.tsx` and route tree registration.

4. **Telegram ensure-webhook admin RPC argument order**  
   `callRpc(config, fn, token, body)` was called as `callRpc(config, token, "bs_is_admin", {})`, so admin bearer auth for `/api/telegram/ensure-webhook` never worked. Fixed argument order.

5. **`slugUsernameFromName` numeric-only names**  
   Names like `"12"` produced `u12` instead of `user12`, breaking tests and weak usernames. Restored letter-or-`user` prefix logic.

### Security review (unchanged / needs DB migrations)

These remain **server/RLS issues** documented in prior audits — not fixed in app code this run:

- `grade_answer` RPC may expose correct answers to clients (oracle risk).
- Profile RLS may allow banned users or onboarding bypass in edge cases.
- Vocab quiz paths may leak answers before submit.
- `tests.published` RLS scope should be reviewed for draft leakage.

No secrets committed; service role keys only read from env on the worker.

### Dependencies

- `npm audit`: **11 vulnerabilities** (2 moderate, 9 high), mostly `undici` / `nitro` / `wrangler` chain. Do **not** run `npm audit fix --force` (breaking nitro downgrade).

### Verification

- `npm test`: **108/108 passed**
- `npm run build`: fails in agent sandbox (missing `@lovable.dev/vite-tanstack-config` — Lovable-only package; expected locally/CI on Lovable)

### Files touched

- `src/lib/import/{vision,fix,figure}-handler.ts` — staff gate
- `src/server.ts` — `/api/ai/uinfo`
- `src/routes/reset-password.tsx` — restored
- `src/routeTree.gen.ts` — `/reset-password` registration
- `src/lib/telegram/ensure-webhook-handler.ts` — `callRpc` args
- `src/lib/auth/login-email.ts` — username slug fix
