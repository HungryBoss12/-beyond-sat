# Deploying BeyondSAT to Cloudflare Workers

This is a **TanStack Start** (SSR) app. The Vite build (via the bundled nitro
Cloudflare target) emits a Worker into `.output/`, which Wrangler uploads to
Cloudflare Workers.

- Server entry: `.output/server/index.mjs`
- Static assets: `.output/public`

All Cloudflare config lives in [`wrangler.jsonc`](./wrangler.jsonc).

---

## Environment variables — how they split

| Variable                        | When                         | Where it's set            | Secret?     |
| ------------------------------- | ---------------------------- | ------------------------- | ----------- |
| `VITE_SUPABASE_URL`             | build time (inlined into JS) | `.env` (committed)        | no (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build time (inlined)         | `.env` (committed)        | no (public) |
| `SUPABASE_URL`                  | runtime (SSR)                | `wrangler.jsonc` → `vars` | no (public) |
| `SUPABASE_PUBLISHABLE_KEY`      | runtime (SSR)                | `wrangler.jsonc` → `vars` | no (public) |
| `SUPABASE_SERVICE_ROLE_KEY`     | runtime (optional)           | `wrangler secret put`     | **YES**     |

The `VITE_*` values are baked into the client bundle at build time, so they must
be present whenever you run `vite build` (they already are, via `.env`).

The non-prefixed runtime values are read by the SSR server client
([`src/integrations/supabase/client.server.ts`](./src/integrations/supabase/client.server.ts)).
They're the same public Supabase values and are committed in `wrangler.jsonc`.

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in `wrangler.jsonc` or `.env` — it
bypasses row-level security. It's currently unused, so you can skip it until an
admin/server feature needs it.

---

## First-time setup

1. **Install dependencies**

   ```bash
   npm install       # or: bun install
   ```

2. **Install Wrangler & log in** (Wrangler is already a devDependency)

   ```bash
   npx wrangler login
   ```

   This opens a browser to authorize Wrangler against your Cloudflare account.

3. **(Optional) Pick a Worker name.** Edit `"name"` in `wrangler.jsonc` if you
   want something other than `beyond-sat-v0`. This becomes your default URL:
   `https://<name>.<your-subdomain>.workers.dev`. It must match the Worker that
   is connected to this repo in the Cloudflare dashboard.

---

## Deploy

```bash
npm run deploy
```

This runs `vite build` then `wrangler deploy`. On success Wrangler prints the
live `*.workers.dev` URL.

---

## Local preview of the production Worker

Runs the built Worker in a local Cloudflare runtime (miniflare):

```bash
cp .dev.vars.example .dev.vars   # first time only; fill in values
npm run cf:preview               # vite build + wrangler dev
```

(For fast day-to-day dev, keep using `npm run dev` — plain Vite.)

---

## Google sign-in

Sign-in and sign-up use Supabase OAuth (`Continue with Google`). The app
cannot enable the provider for you — do this once in the dashboards:

1. **Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client
   (Web). Authorized redirect URI must be the Supabase callback:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase** → Authentication → Providers → **Google**: enable it and paste
   the Google Client ID and Client Secret.
3. **Supabase** → Authentication → URL Configuration → Redirect URLs: add
   `https://<your-app-host>/auth/callback` (the live Workers URL and any custom
   domain). For local `npm run dev`, also add `http://localhost:5173/auth/callback`
   (or whichever origin Vite prints).

After Google returns, the app lands on `/auth/callback`, then `/dashboard`. New
users (`profiles.intro_completed` is false) are sent to `/onboarding`; returning
users stay in the app.

The migration `supabase/migrations/20260817000001_handle_new_user_google_names.sql`
must be applied so Google's `given_name` / `full_name` fill `profiles`.

---

## Optional: the service-role secret

Only if/when you wire up the admin Supabase client:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# paste the value when prompted — it is encrypted and never stored in git
```

---

## Optional: custom domain

1. Add your domain as a zone in the Cloudflare dashboard.
2. In the dashboard: **Workers & Pages → beyond-sat-v0 → Settings → Domains &
   Routes → Add custom domain**, or add a `routes` block to `wrangler.jsonc`.

---

## Continuous deployment (optional)

Connect the GitHub repo under **Workers & Pages → Create → Connect to Git**, or
add a GitHub Action that runs `npm ci && npm run deploy` with a
`CLOUDFLARE_API_TOKEN` secret. The build command is `npm run deploy` (or split
into `vite build` + `wrangler deploy`).

---

## Troubleshooting

- **`Missing Supabase environment variable(s)`** — a `VITE_*` var wasn't present
  at build time (check `.env`) or a runtime var is missing from
  `wrangler.jsonc` → `vars`.
- **`nodejs_compat` / Node built-in errors** — ensure `compatibility_flags`
  keeps `"nodejs_compat"` and `compatibility_date` is `2024-09-23` or later.
- **404s on assets** — confirm `.output/public` exists after build and matches
  the `assets.directory` in `wrangler.jsonc`.
