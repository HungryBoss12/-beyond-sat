# BeyondSAT System Health Log

Automated integrity audits (cron). Newest entries first.

---

## 2026-09-08 — cron audit (`cursor/system-integrity-audit-bee0`)

### Live site

| Route | Status | Notes |
|-------|--------|-------|
| `https://beyond-sat-v0.javazbek80.workers.dev/` | **200** | Landing OK |
| `/signin`, `/signup`, `/dashboard`, `/practice`, `/banned`, `/admin` | **200** | Key pages OK |
| `/reset-password` | **404** (live) | Route restored this run; deploy needed |
| `POST /api/import/vision` | **401** unauth | Expected |
| `POST /api/ai/chat` | **401** unauth | Expected |
| `POST /api/telegram/webhook` | **401** unauth | Expected |

### Fixed this run

1. **Security regression (23rd occurrence)** — `/api/import/vision`, `/api/import/fix`, `/api/import/figure` only checked `verifySupabaseUser`; any signed-in student could burn Gemini/OpenRouter quota. Re-secured with `verifyStaffUser()` + `bs_is_staff` RPC.
2. **Missing `/reset-password` route** — sign-in “Forgot password” redirected to a 404. Added `src/routes/reset-password.tsx` (client-only recovery flow).
3. **Telegram ensure-webhook admin check** — `callRpc` arguments were in wrong order (`config, token, fn` instead of `config, fn, token`), so admin bearer auth never worked for `/api/telegram/ensure-webhook`.

### Tests & tooling

| Check | Result |
|-------|--------|
| `npm test` | **94/94 passed** |
| `npm run build` | **Fails** in agent sandbox — `@lovable.dev/vite-tanstack-config` not installed (Lovable-only package). Deploy/build on Lovable still expected to work. |
| `npm run lint` | **1146** issues (mostly pre-existing Prettier) |
| `npm audit` | **8** vulnerabilities (4 moderate, 4 high). Do **not** run `audit fix --force` (breaks nitro). Safe `audit fix` available for brace-expansion, js-yaml, nanoid. |

### Security review (unchanged / still open)

| Issue | Severity | Status |
|-------|----------|--------|
| `grade_answer` RPC callable on any question ID before attempt | Medium | Needs migration — restrict to in-progress session |
| Profile `onboarding_completed` / ban flags writable via client | Medium | Needs RLS tightening |
| Vocab quiz `correct_answer` returned to client on submit | Low | By design for review; verify no pre-submit leak |
| `tests.published` RLS — draft tests visible? | Low | Verify `PRACTICE_SETS.sql` applied in prod |
| Import API staff gate | **High** | **Fixed this run** |
| Telegram webhook admin RPC arg order | Medium | **Fixed this run** |

### Files changed

- `src/lib/server-env.ts` — add `verifyStaffUser()`
- `src/lib/import/vision-handler.ts` — staff gate
- `src/lib/import/fix-handler.ts` — staff gate
- `src/lib/import/figure-handler.ts` — staff gate
- `src/lib/telegram/ensure-webhook-handler.ts` — fix `callRpc` arg order
- `src/routes/reset-password.tsx` — new route

### Deploy note

Push + merge (or Lovable sync) required for `/reset-password` and import staff checks to reach production.
