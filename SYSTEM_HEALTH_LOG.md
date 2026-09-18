# BeyondSAT system health log

Automated cron audits (`review-bugbot`). Newest entries first.

---

## 2026-09-18 (cron `7f79fc26`, branch `cursor/system-integrity-audit-e827`)

### Live site (`https://beyond-sat-v0.javazbek80.workers.dev`)

| Path | Status (pre-fix deploy) | Notes |
|------|-------------------------|--------|
| `/` | 200 | OK |
| `/signin` | 200 | OK |
| `/dashboard` | 200 | OK (SSR shell) |
| `/reset-password` | **404** | Route missing on `main` again; restored in repo this run |

### Code fixes (this run)

1. **Restored** `src/routes/reset-password.tsx` — Supabase password-reset emails from sign-in use `redirectTo: /reset-password`; without this route, users land on 404 after clicking the email link.
2. **Fixed** `slugUsernameFromName()` in `src/lib/auth/login-email.ts` — numeric-only display names (e.g. `"12"`) had regressed to `u12` instead of `user12`; test `login-email.test.ts` was failing.
3. **Regenerated** `src/routeTree.gen.ts` via production build (TanStack Router).

### Verified OK (no change needed)

- **Import APIs** (`/api/import/vision`, `fix`, `figure`): `requireStaff()` + `bs_is_staff`; unauthenticated POST returns **401**.
- **`/api/ai/uinfo`**: present in `src/server.ts`; staff-gated cross-user flush.
- **Telegram** `ensure-webhook`: `callRpc(config, "bs_is_admin", token, {})` argument order correct.
- **Production build**: `npm run build` succeeds.
- **Unit tests**: **124/124** passed after fixes.

### Security / dependency notes

- `npm audit`: **11** issues (2 moderate, 9 high); mostly transitive. Do **not** run `audit fix --force` (would bump vitest major). Dev-only vitest mocker advisory; no production exposure.
- No secrets committed; service role keys documented for Wrangler secrets only.
- `dangerouslySetInnerHTML` limited to KaTeX (`MathText`) and chart theming — expected; ensure user HTML is never passed through.

### Known issues (DB / deploy — not fixed this run)

These require Supabase migrations applied on the linked project and/or product decisions:

- Confirm production DB has `20260914000001_test_session_hardening.sql` (`grade_answer` session binding).
- Confirm `20260914000002_profile_security.sql` (ban / `must_change_credentials` lock) is applied.
- `tests.published` RLS tightening (`20260903000002_notifications_edit_and_tests_published.sql`) — verify policy matches app expectations for draft tests.
- Vocab quiz `correct_answer` exposure via RLS — review if students can SELECT answers before submit (historical cron note).

### Lint

- `npm run lint` reports many Prettier formatting diffs on marketing pages (`programs`, `support`, `terms`, etc.) — pre-existing style drift; not auto-formatted this run to keep diff small.

### Deploy reminder

`/reset-password` will stay **404** on workers.dev until the next `npm run deploy` (or CI deploy) from a commit containing this route.

---

## 2026-09-17

See automation memory: live site up; same recurring reset-password regression pattern; PR #32 on branch `cursor/system-integrity-audit-5e8c`.
