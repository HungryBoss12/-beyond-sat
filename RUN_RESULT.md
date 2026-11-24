# Security fix run — result

**Outcome:** every finding the plan covered is fixed and committed to the local branch `security-hardening`. **Nothing was pushed or deployed.** The finalization gate requires `tsc` and ESLint to be green, and both were already red on `main` before this run. The errors are all in files this run did not touch, and the plan says not to fix unrelated code during the run, so the gate stayed red.

Production was not touched. No migration was applied anywhere, nothing ran against the live database, and no test Supabase project is configured.

## Commits on `security-hardening` (not pushed)

| Commit | Change |
| --- | --- |
| `3006f37` | Bind the dev server to localhost and deny `.dev.vars` |
| `49a1575` | Require email confirmation for first-login email |
| `9376a3a` | Harden rate limits, error messages, link codes, and input limits |
| `e98f77b` | Keep invite error helpers within the print width |

## What each finding got

| Finding | Fix | Proof |
| --- | --- | --- |
| **F-01 Critical**: dev server serves `.dev.vars` to the LAN | Vite `server.host` is `localhost`, and `server.fs.deny` blocks `.env*`, `.dev.vars*`, certificates and `.git`. `vite preview` inherits the host, which also covers I-08. | `src/lib/dev-server.test.ts`. Checked by hand: the server listened only on `[::1]`; `/.dev.vars`, `?raw` and `/@fs/` requests returned 403; the LAN address refused connections. |
| **F-02 Medium**: first-login email marked verified without confirmation | A typed email is no longer set server-side with `email_confirm`. The page calls `supabase.auth.updateUser({ email })` instead, so Supabase sends a confirmation link and the address only becomes active after the click. Only the synthetic username email is still set directly. | `src/lib/auth/first-login-update.test.ts` |
| F-03: rate limits fail open when the DB limiter is down | Invite and username-login IP limits use `sharedRateLimit`, which falls back to the in-memory limiter. The per-account login limit still fails closed. | `src/lib/security/limits-when-db-down.test.ts` |
| F-04: short Telegram link codes, unlimited guesses | `/link` is capped at 5 attempts per chat (app side, live as soon as the code deploys). The migration lengthens codes from 6 to 10 hex characters. | Same test file, plus `migrations.test.ts` |
| F-05: username existence check for any user | Migration: `staff_assign_support_by_name` checks `bs_is_staff()` before looking up the profile. | `migrations.test.ts` |
| F-06: raw DB/auth errors returned to clients | Invite, reset-password and first-login handlers log the raw message and return a fixed sentence (`src/lib/http/public-error.ts`). | `public-error.test.ts`, `first-login-update.test.ts` |
| F-07: lead-form limit trusts client `x-forwarded-for` | Migration: `public_submit_lid` keys on `cf-connecting-ip`, then the right-most forwarded entry, and adds a global cap of 200 per hour (`lid-all`). | `migrations.test.ts` |
| F-08: sign-in callback shows text from the URL | `/auth/callback` shows only fixed sentences (`src/lib/auth/callback-error.ts`). | `callback-error.test.ts` |
| F-09: no body size limit on public JSON endpoints | `readJsonLimited` caps bodies at 16 KB, or 64 KB for the Telegram webhook, and returns 413 above that. It's used by invite preview and claim, username login, forgot password, first login, and the webhook. | `read-json.test.ts` |
| I-03: create-user shows config errors before the auth check | `requireAdmin` runs first. | `admin-gates.test.ts` |
| I-05: any staff can flush another user's AI summary | Flushing another user's summary now requires `bs_is_admin`. | `admin-gates.test.ts` |
| I-06: vision fetcher accepts any `*.supabase.co` | The fetcher compares against this project's exact storage host. | `vision-url.test.ts` |

Not done, as the plan specified: I-01 (nonce-based CSP needs framework support), I-02 (design choice), I-04 (needs a product decision on whether admins may reset teacher and editor passwords), and I-07 (major dev-tool upgrades).

## Checks

| Check | Result |
| --- | --- |
| Vitest | **Pass**: 58 files, 310 tests |
| `npm run build` | **Pass** |
| `tsc --noEmit` | **Fail**: 9 errors, the same 9 as on `main` before the run. 8 are in `src/components/admin-import/draft-editor.tsx` and 1 is in `src/lib/import/load-existing-orphans.test.ts`. |
| ESLint | **Fail**: 21 non-formatting errors, the same count as before. Formatting (prettier) errors dropped from 3076 to 3074. About 37,000 more "Delete ␍" messages come from Windows line endings in the working copy; git commits LF, so these don't reach the repo. |
| Secrets or env files in the diff | **None.** No `.env`, `.dev.vars` or key files. The only scanner match was a fake placeholder (`test…`) in a test fixture. |
| Code depends on an unapplied migration | **No.** The app changes work with or without the new migration. |
| Push, deploy, homepage smoke test | **Not run**, because the gates failed. Production still runs the previous deploy, so no rollback was needed. |

## Apply before deploying

None is strictly required, since the code doesn't depend on any migration. Apply this one when you're ready, to finish F-04, F-05 and F-07:

- `supabase/migrations/20261109000001_low_findings_hardening.sql`

## Manual steps for you

1. **Rotate every secret in `.dev.vars`**: the Supabase service role key, the AI provider keys, the Telegram bot token, and the rest. Then update them with `wrangler secret put`. Until the F-01 fix, any device on the same network could read them from a running dev server, so treat them as exposed.
2. To ship: fix the 9 tsc errors and the lint errors listed above (unrelated to this run), or decide to waive the gate. Then push `security-hardening`, open a PR into `main`, and run `npm run deploy`.
3. In Supabase Auth settings, confirm **Secure email change** is on and SMTP can handle confirmation emails. F-02 now relies on Supabase's confirmation email.
4. After a student confirms a new email, `profiles.email` is not updated (it is display-only). If you want it in sync, add a trigger on `auth.users` email changes.
5. `SECURITY_REPORT.md` was left uncommitted in the repo root. Commit it or move it.

## Decisions made without asking

- I kept the plan's gate exactly as written instead of waiving it for pre-existing errors, so nothing was pushed or deployed. This was the safest reading.
- For each phase, "checks pass" meant no new `tsc` errors, no new lint errors in touched files, fully clean new files, and green Vitest. A fully green repo wasn't possible before the run started.
- The fallback for the username-login IP limit has no direct test; the same fallback is tested through the invite limiter.
- The lead form's global cap (200 per hour) is a guess at a safe ceiling. A large legitimate spike above it would see the "try again" message.
