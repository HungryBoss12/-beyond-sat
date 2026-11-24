# BeyondSAT security review

Date: 9 November 2026
Scope: source code, Supabase migrations, build output, git history, dependencies, and local verification of the app's own controls.
Method: white-box code and configuration review, plus light verification on localhost only. Nothing was sent to production, the deployed Worker, the real Supabase project, or any third-party service. No source code was changed.

---

## 1. Executive summary

**Overall risk: High.** The deployed application is in good shape. Every API route checked its session and role correctly in testing, the security headers are present, and the database layer has been hardened carefully. The serious problem is on the developer machine: the local dev server hands the real secrets file to anyone on the same network.

| Severity | Count |
| --- | --- |
| Critical | 1 |
| High | 0 |
| Medium | 1 |
| Low | 7 |
| Informational | 8 |

**The three most important findings**

1. **F-01 (Critical, Confirmed).** `npm run dev` listens on every network interface, and Vite serves `.dev.vars` as a plain file. Anyone on the same Wi-Fi can download the Supabase service-role key, the database password, the Supabase personal access token, and the OpenRouter and Gemini keys with one request. Those values give full control of the production database and the Supabase account.
2. **F-02 (Medium, Likely).** During first login, a student can attach any email address to their account, and the server marks it as verified without sending a confirmation. Because Google sign-in is enabled, this enables a "pre-account takeover" against the owner of that address. The error messages also reveal whether an email is already registered.
3. **F-05 (Low, Likely).** Any signed-in user can call `staff_assign_support_by_name` and learn whether a username exists, because the existence check runs before the staff check.

---

## 2. Attack surface map

| Entry point | Method | Auth required | Rate limit | Notes |
| --- | --- | --- | --- | --- |
| `/api/ai/chat` | POST | User | 20 burst / 6 per min per user, plus DB daily quota | Calls Gemini/OpenRouter only after auth, ban check, and quota |
| `/api/ai/uinfo` | POST | User (staff for other users) | 1 per 10 min per user | Writes AI activity summary |
| `/api/ai/youtube-recs` | GET | User | 10 burst / 2 per min | Calls YouTube Data API |
| `/api/import/{vision,fix,figure}` | POST | Staff | — | Gemini/OpenRouter vision |
| `/api/vocab/{session,review,quiz/submit}` | GET/POST | User | — | |
| `/api/vocab/{generate,admin/save}`, `/api/vocab/admin/{decks,cards}/:id` | POST/DELETE | Staff | — | |
| `/api/admin/{create-user,delete-student,reset-student-password,student-invite}` | POST | Admin | — | Use the service-role key |
| `/api/auth/username-login` | POST | None | Per account+IP (DB, fails closed) and per IP (DB, fails open) | Timing floor and decoy verify |
| `/api/auth/forgot-password` | POST | None | — | Fixed redirect origin |
| `/api/auth/preview-invite`, `/api/auth/claim-invite` | POST | None (invite token) | Per IP (DB, fails open) | 256-bit tokens, stored hashed |
| `/api/auth/complete-first-login` | POST | User | — | Sets password, username, email |
| `/api/telegram/webhook` | POST | Telegram secret header | — | Admin bot (ban/unban, user lookup) |
| `/api/telegram/ensure-webhook` | POST | Secret header or admin | — | |
| SSR pages (TanStack Start) | GET | Varies (client-side) | — | Maintenance gate before SSR |
| Cron `*/5` and hourly | scheduled | Cloudflare only | — | Support notices, recurring fees, webhook repair |
| Supabase PostgREST / RPC / Storage | direct from browser | Supabase JWT + RLS | Some RPCs | Static review only |
| Vite dev server (`vite dev`) | GET | None | — | Developer machine, see F-01 |

---

## 3. Findings

### F-01: Dev server serves `.dev.vars` (all production secrets) to the local network

- **Severity: Critical.** No authentication is needed, an attacker only needs to share a network with the developer, and the impact is full compromise of production data and the Supabase account.
- **Status: Confirmed** (verified on an isolated dev server on port 8099).
- **Location:** `vite.config.ts:71-73` (`server: { host: "::" }`, with no `server.fs.deny` override). Endpoint: `GET http://<dev-machine-ip>:<port>/.dev.vars`.

**Description.** `host: "::"` makes Vite listen on all interfaces. On this machine that means `0.0.0.0` and `[::]`, and Vite advertised `http://192.168.100.231:8099/`. Vite's built-in deny list blocks `.env`, `.env.*`, certificates and `.git`, but not `.dev.vars`. Vite treats the file as a normal project file and serves it.

**What was observed (values never printed):**

| Request | Result |
| --- | --- |
| `GET /.dev.vars` | 200, 1256 bytes, contains `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` and others |
| `GET /.dev.vars?raw`, `?import&raw`, `?url`, `/@fs/<abs path>/.dev.vars` | 200, same contents |
| `GET /.dev.vars` with `Host: 192.168.100.231:8099` | 200 (reachable by LAN IP) |
| `GET /.dev.vars` with `Host: evil.example` | 403 (DNS rebinding blocked) |
| `GET /.dev.vars` with `Origin: https://evil.example` | 200, no CORS header, so a malicious website cannot read it from a browser |
| `GET /.env`, `/.git/config`, `/@fs/C:/Windows/win.ini` | 403 |

Your regular dev server on port 8081 uses the same config and was also listening on `0.0.0.0:8081` and `[::]:8081` during this review. It was not probed.

**Reproduction (plain language).** Start `npm run dev` on a laptop connected to shared Wi-Fi. From another device on that network, open `http://<laptop-ip>:8080/.dev.vars` in a browser. The secrets file is displayed.

**Why it matters.**
- `SUPABASE_SERVICE_ROLE_KEY` (`eyJh…`) bypasses every RLS policy: read and write every student's data, grades, billing, and chats.
- `SUPABASE_DB_PASSWORD` (`2011…`) gives a direct Postgres connection.
- `SUPABASE_ACCESS_TOKEN` (`sbp_…`) is a personal access token for the Supabase Management API. It can run SQL, read keys, and change settings on **every project in your account**.
- `OPENROUTER_API_KEY` (`sk-o…`) and `GEMINI_API_KEY` (`AQ.A…`) enable billing abuse.

Schools, cafés, and coworking spaces are exactly where this kind of network sharing happens.

**Fix.**

```ts
// vite.config.ts
server: {
  host: "localhost",
  port: 8080,
  fs: {
    // Replaces Vite's default list, so the defaults are repeated here.
    deny: [".env", ".env.*", ".dev.vars", ".dev.vars.*", "*.{crt,pem}", "**/.git/**"],
  },
  watch: { ignored: ["**/.agents/**", "**/.cursor/**", "**/.output/**"] },
},
```

If you need to test on a phone, opt in for that session only with `npx vite dev --host`. The deny rule still protects the file then.

Because the exposure window is unknown, **rotate every value in `.dev.vars`**: the Supabase secret / service-role key, the database password, the personal access token (Dashboard → Account → Access Tokens), and the OpenRouter and Gemini keys. Update the Cloudflare secrets afterwards. Longer term, point local development at a separate Supabase project, so a laptop never holds production's service-role key or your account token.

---

### F-02: First-login email is marked verified without confirmation (pre-account takeover)

- **Severity: Medium.** Exploiting it needs a provisioned account and a victim who later signs in with Google. Success links the victim's Google identity to an account the attacker controls.
- **Status: Likely.** The code path is confirmed. The final step depends on Supabase identity auto-linking, which is on by default for verified emails but could not be checked against the live project.
- **Location:** `src/lib/auth/complete-first-login-handler.ts:28-36` (any syntactically valid, non-synthetic email is accepted) and `:72-85` (`updateUserById(..., { email: authEmail, email_confirm: true })`). Google sign-in and linking: `src/lib/auth/google.ts:20`, `:35`.

**Description.** A student whose account still needs first-time setup (`must_change_credentials`) submits a new password and, optionally, an email. The server writes that email to Supabase Auth as already confirmed. Nothing proves the student owns the address.

**Reproduction (plain language).**
1. A student receives a teacher-created account and opens first-login setup.
2. They enter someone else's Gmail address, for example a classmate or teacher who hasn't signed up yet.
3. Later, the real owner clicks "Continue with Google". Supabase sees a verified account with the same email and links the Google identity to it.
4. The owner is now inside an account whose password the attacker set. The attacker can keep signing in and see everything the victim does.

There is also a side effect. If the address already belongs to another user, `updateUserById` fails, and `:88` returns Supabase's raw message ("A user with this email address has already been registered"). That turns the endpoint into an email-registration oracle for any account in setup.

**Fix.** Do not mark user-supplied emails as confirmed. Save the password on the server, then let the client start Supabase's normal email-change flow, which sends a confirmation link to the new address.

```ts
// complete-first-login-handler.ts: server keeps only the password (and synthetic username email)
const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(auth.user.id, {
  password,
  ...(authEmail && !nextEmail ? { email: authEmail, email_confirm: true } : {}),
});
if (updErr) {
  console.error("[first-login] update failed", updErr.message);
  return jsonResponse({ error: "Could not update your account." }, 400);
}
return jsonResponse({ ok: true, pendingEmail: nextEmail || null });
```

```ts
// client, after the request succeeds
if (result.pendingEmail) {
  await supabase.auth.updateUser({ email: result.pendingEmail }); // sends a confirmation link
}
```

Pass `null` for `p_email` until the address is confirmed, or store it as "pending" in `bs_complete_first_login`. In the Supabase dashboard, also confirm that "Secure email change" is on.

---

### F-03: Some rate limits switch off when the database limiter is unavailable

- **Severity: Low.** It needs a database outage or error, and the affected endpoints are already protected by strong secrets or a stricter limit that fails closed.
- **Status: Confirmed** (code). Local verification showed that with the rate-limit RPC failing, the flush endpoint fell back to the in-memory limiter.
- **Location:**
  - `src/lib/auth/student-invite-handler.ts:140-146`: `if (!limit || limit.ok) return null;` lets every request through when `takeRateToken` returns `null`.
  - `src/lib/auth/username-login-handler.ts:73`: `(ipLimit && !ipLimit.ok)` skips the per-IP cap when the DB call fails. The per-account limit at `:69-71` fails closed, which is correct.
  - `src/lib/shared-rate-limit.ts:65-67`: other limits fall back to a per-isolate bucket, which is weaker on Cloudflare because each isolate keeps its own count.

**Why it matters.** During a Supabase incident, the invite preview and claim endpoints and the login per-IP cap have no throttling. Invite tokens are 256-bit, so guessing them stays infeasible. The main risk is extra load and noise at a moment when the database is already struggling.

**Fix.** Use the same fallback everywhere:

```ts
// student-invite-handler.ts
const limit = await sharedRateLimit(
  env,
  `invite-${kind}:${requestIp(request)}`,
  kind === "preview" ? 40 : 20,
  kind === "preview" ? 10 : 5,
);
if (limit.ok) return null;
```

```ts
// username-login-handler.ts
sharedRateLimit(env, `login-ip:${ip}`, 60, 6), // instead of takeRateToken
...
if (!limit.ok || !ipLimit.ok) { /* 429 */ }
```

---

### F-04: Telegram admin link codes are short and guesses are not limited

- **Severity: Low.** The search space and the 10-minute lifetime make guessing impractical, but success grants admin powers in the bot.
- **Status: Theoretical.**
- **Location:** `supabase/migrations/20260830000001_admin_user_insights.sql:389` (6 hex characters, 24 bits); `supabase/migrations/20261108000001_pentest_hardening.sql:88-120` (`admin_consume_telegram_link_code`, no attempt counter); `src/lib/telegram/webhook.ts:125-130` (`/link CODE` accepted from any chat).

**Description.** Anyone can message the bot and try `/link XXXXXX`. A code is valid for 10 minutes and used once. Nothing counts failed guesses per chat. A linked chat can look up users and ban or unban accounts.

**Fix.** Use longer codes and limit failed attempts per chat:

```sql
-- admin_create_telegram_link_code
v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)); -- 40 bits
```

```ts
// webhook.ts, before consumeLinkCode
const limit = await sharedRateLimit(env, `tg-link:${chatId}`, 5, 1);
if (!limit.ok) {
  await sendTelegramMessage(token, chatId, "Too many attempts. Try again later.");
  return;
}
```

---

### F-05: Any signed-in user can check whether a username exists

- **Severity: Low.** It leaks account existence only, but it makes targeted login or phishing attempts easier.
- **Status: Likely** (static analysis; the database was not tested live).
- **Location:** `supabase/migrations/20261013000002_support_window_open.sql:147-181` (function body), `:301` (`GRANT EXECUTE … TO authenticated`).

**Description.** `staff_assign_support_by_name` is SECURITY DEFINER and callable by every authenticated user. It looks up the name and raises `Student not found` (`:171-172`) or `That name matches more than one account` before calling `staff_assign_support_window`, where the staff check lives. A student who calls it with any window ID gets "not found" for a missing username and a different error for an existing one.

**Fix.** Check permission first:

```sql
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
  ...
```

---

### F-06: Raw database and auth error messages are returned to clients

- **Severity: Low.** It leaks internal details (constraint names, Supabase Auth messages) and supports the email oracle in F-02.
- **Status: Confirmed** (code).
- **Location:** `src/lib/auth/complete-first-login-handler.ts:88`, `:102`; `src/lib/auth/student-invite-handler.ts:236`, `:252`, `:270`, `:279`, `:288`, `:373`, `:390`, `:472`, `:492`; `src/lib/auth/reset-student-password-handler.ts:74`, `:84`, `:88`, `:94`.

**Fix.** Log the details and return a fixed sentence:

```ts
if (updErr) {
  console.error("[claim-invite] update user failed", updErr.message);
  return jsonResponse({ error: "Could not finish setting up your account." }, 400);
}
```

Keep the specific user-facing cases you already handle, such as "That username is already taken."

---

### F-07: Lead-form rate limit trusts a client-supplied `x-forwarded-for`

- **Severity: Low.** At worst, the public lead form can be spammed past its limit.
- **Status: Theoretical.** It depends on which headers Supabase's gateway forwards, which could not be checked without the live project.
- **Location:** `supabase/migrations/20261108000001_pentest_hardening.sql:767-771` (`public_submit_lid`).

**Description.** When `cf-connecting-ip` is missing, the function keys its rate limit on the **first** `x-forwarded-for` entry. The client can set that entry, so each request can claim a new IP.

**Fix.** Use only a header the gateway sets, or the right-most `x-forwarded-for` entry, which the closest proxy appends:

```sql
v_xff text := current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for';
v_ip text := COALESCE(
  NULLIF(btrim(current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip'), ''),
  NULLIF(btrim((string_to_array(v_xff, ','))[array_length(string_to_array(v_xff, ','), 1)]), ''),
  'anon'
);
```

Add a small global cap, for example 200 per hour across all IPs, as a backstop.

---

### F-08: Sign-in callback shows text from the URL

- **Severity: Low.** Content spoofing only. React renders it as text, so there is no script injection.
- **Status: Confirmed** (code).
- **Location:** `src/routes/auth.callback.tsx:27-40`.

**Description.** `/auth/callback?error_description=...` displays whatever the link says, for example "Your account is locked, call +998…". It's a convincing phishing aid because the message appears on the real domain.

**Fix.** Show fixed messages only:

```ts
function friendlyAuthError(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("registration is closed") || lower.includes("database error saving new user")) {
    return "Registration is closed. Sign in with an account you already have, or ask your teacher for one.";
  }
  return "Sign-in didn't finish. Try again.";
}
```

---

### F-09: No request body size limit on public JSON endpoints

- **Severity: Low.** Cloudflare caps request bodies by plan, and Workers have a 128 MB memory limit, so large bodies mostly waste CPU and memory on the isolate.
- **Status: Theoretical.** It was not exercised, by agreement (no oversized payloads).
- **Location:** `request.json()` with no size check in `src/lib/auth/username-login-handler.ts:47`, `src/lib/auth/student-invite-handler.ts:160`, and the other `/api/auth/*` handlers.

**Fix.** Add a shared guard:

```ts
export async function readJsonLimited<T>(request: Request, maxBytes = 16_384): Promise<T | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
```

---

### Informational

| ID | Observation | Location | Recommendation |
| --- | --- | --- | --- |
| I-01 | CSP allows `script-src 'unsafe-inline'`, which weakens protection if an XSS bug ever appears. Confirmed in the response header. | `src/lib/security-headers.ts:44` | Move to nonces when TanStack Start supports them for hydration scripts. |
| I-02 | The maintenance gate fails open when the database is unreachable. Observed: the RPC failed and the page was still served. | `src/server.ts:232` | Reasonable as a design choice. Document it. |
| I-03 | `create-user` checks server config before checking admin, so a misconfigured deploy shows config error text to anyone. | `src/lib/auth/create-user-handler.ts:67-88` | Move `requireAdmin` above the config check. |
| I-04 | The admin password reset only refuses targets with the `admin` role, so an admin can reset teacher and editor passwords. | `src/lib/auth/reset-student-password-handler.ts:69-75` | Restrict to students if that's the intent. |
| I-05 | Any staff member (including editors) can trigger an AI summary flush for any user ID. | `src/lib/uinfo/summarize.ts:70-76` | Restrict to admins, or check that the target is a student. |
| I-06 | The vision fetcher accepts any `*.supabase.co` host. The router already pins the exact project host, so this is defense in depth only. | `src/lib/gemini/chat-vision.ts:35` | Compare against the exact storage host. |
| I-07 | `npm audit`: 2 critical (vitest, tinypool), 10 moderate (typescript-eslint, minimatch, exceljs → uuid). All are dev tooling except exceljs, whose `uuid.v4()` call doesn't use the vulnerable buffer path. Nothing reachable in production. | `package.json` | Upgrade vitest to 5.x and typescript-eslint when convenient. |
| I-08 | `vite preview` inherits `server.host`, so it is LAN-exposed too. It only serves the built client, not project files. | `vite.config.ts:71-73` | Covered by the F-01 fix. |

---

## 4. Attack chains

1. **Laptop on shared Wi-Fi → full production compromise (F-01).** Someone on the same network fetches `/.dev.vars`. With the service-role key they read or alter every student, grade, payment, and message. With the access token they control the Supabase account itself. This needs no other bug.
2. **Email oracle → pre-account takeover (F-06 + F-02).** A student in first-login setup tries addresses until the raw error shows which ones are free. They then claim a free address belonging to a teacher or classmate. When that person later uses Google sign-in, they land in the attacker's account.
3. **Username discovery → targeted login attempts (F-05 + login).** A student lists valid usernames through the support RPC, then tries passwords. The per-account login limit (5 tries, then one every 3 minutes, failing closed) keeps this slow.

---

## 5. Checked and found secure

**Verified on localhost** (production build under `wrangler dev --local`, fake bindings, a local stand-in for Supabase):

- Security headers on every page: enforced CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy`.
- All 19 protected `/api` routes return 401 with no session; an unknown token also gets 401.
- A signed-in student gets 403 from staff routes (`/api/vocab/admin/save`, `/api/import/vision`) and admin routes (`/api/admin/create-user`, `/api/admin/delete-student`).
- `/api/telegram/webhook` returns 401 with no secret or a wrong secret, and 405 for GET. `/api/telegram/ensure-webhook` returns 401 without the secret or an admin session.
- Rate limiter: 20 flush requests in a row gave 1 accepted and 19 refused (`204`, `retry-after: 600`), with the database limiter unavailable, so the fallback works.
- Vite blocks DNS rebinding (foreign `Host` → 403), sends no CORS header to foreign origins, and denies `.env`, `.git` and files outside the project.

**Verified by code and configuration review:**

- Every billable AI, Gemini, OpenRouter and YouTube call happens after auth, the ban check, and rate limits. The `/auth/key` probe runs only on the post-auth 401 path.
- Telegram webhook secret comparison is constant-time, and bot output is HTML-escaped.
- Username login uses a 300 ms timing floor, a decoy password check, and a per-account limit that fails closed.
- Forgot-password uses a fixed redirect origin and gives the same response for existing and unknown accounts.
- Invite tokens: 32 random bytes, stored as SHA-256, single use, with expiry and activation time. Claim refuses staff accounts.
- Auth callback `next` parameter is allow-listed to `/dashboard` and `/profile`, so there is no open redirect.
- `MathText` escapes prose and runs KaTeX with `trust` off. AI output is rendered through it, with no raw HTML.
- AI router: at most 24 messages and 8000 characters each, and image URLs limited to data URIs or the project's own storage host.
- Database (static): RLS on every table. Answer columns on `questions` revoked at column level. `app_settings` readable by admins only. Role checks (`bs_is_admin`, `bs_is_staff`) bound to `auth.uid()`, with admin also requiring a fresh session. Internal SECURITY DEFINER helpers revoked from `authenticated`. Rate-limit RPCs restricted to the service role. `grade_answer` revoked. `chat_directory` view scoped to classmates and teachers.
- Storage (static): private buckets, per-folder write policies, SVG and HTML uploads blocked.
- Secrets: none in the production bundle (627 files scanned, no source maps), none in any of the 143 commits, `.dev.vars` and `.env*` are git-ignored, and `.dev.vars.example` holds placeholders only. The public anon key in `wrangler.jsonc` is meant to be public.
- Production `server.ts` drops the dev-only env loader at build time, so no `node:fs` code ships to the Worker.

---

## 6. What could not be tested

- **The whole database layer, live.** RLS policies, RPC functions, grants, triggers, and storage policies were reviewed from migrations only. No test Supabase project was available, and production was off limits.
- **Supabase Auth settings:** identity auto-linking (decides F-02), "secure email change", redirect URL allow-list, password policy, email rate limits, MFA, and whether the migrations match what is actually deployed.
- **Headers Supabase's gateway forwards to Postgres** (decides F-07).
- **Cloudflare edge behavior:** the real `cf-connecting-ip`, WAF rules, platform body-size limits, edge caching, and cron triggers.
- **Third-party integrations:** Telegram, YouTube, OpenRouter, and Gemini were not contacted. Their handlers were reviewed in code only.
- **Browser-side behavior:** no browser-driven XSS or clickjacking tests were run. Rendering was reviewed in code.
- **Your running dev server on port 8081** was not probed, only seen listening on all interfaces. It uses the same config as the server tested in F-01.
- **GitHub repository settings** (visibility, branch protection, secret scanning) were not checked, because that means contacting GitHub.
- **Oversized or malformed payloads, and sustained load**, were left out by agreement.

---

## 7. Prioritized fix list

1. **Today: F-01.** Bind the dev server to `localhost`, add `.dev.vars` to `server.fs.deny`, restart any running `npm run dev`, then rotate every secret in `.dev.vars` and update the Cloudflare secrets.
2. **F-02 together with F-06.** Stop marking user-supplied emails as confirmed, move the email change to Supabase's confirmation flow, and replace raw error messages with fixed sentences.
3. **F-05.** Add a staff check at the top of `staff_assign_support_by_name` (one migration).
4. **F-03, F-04, F-07.** Make rate limits consistent (fallback instead of fail-open), lengthen and throttle Telegram link codes, and fix the lead-form IP source.
5. **F-08, F-09, I-03, I-05, I-06.** Small hardening changes.
6. **Later: I-01 and I-07.** Nonce-based CSP when the framework allows it, and the dev-dependency upgrades.
7. **Separately:** use a dedicated development Supabase project, so local machines never hold production keys or your account token.
