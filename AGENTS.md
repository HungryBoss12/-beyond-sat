# BeyondSAT — agent notes

- Stack: TanStack Start (React 19), Vite, Nitro → Cloudflare Workers, Supabase.
- Deploy: `npm run build && npx wrangler deploy` (or `npm run deploy`).
- Local secrets: `.dev.vars` / `.env.local` — see `src/lib/dev-env.ts`.
- Do not force-push `main` unless you intend to rewrite shared history.
- **No subagents / Task tool** unless the user explicitly triggers them (e.g. `review bugbot`) or says to use subagents. See `.cursor/rules/no-subagents.mdc`.
