# BeyondSAT — agent notes

- Stack: TanStack Start (React 19), Vite, Nitro → Cloudflare Workers, Supabase.
- Deploy: `npm run build && npx wrangler deploy` (or `npm run deploy`).
- Local secrets: `.dev.vars` / `.env.local` — see `src/lib/dev-env.ts`.
- Do not force-push `main` unless you intend to rewrite shared history.
- **No subagents / Task tool** unless the user explicitly triggers them (e.g. `review bugbot`) or says to use subagents. See `.cursor/rules/no-subagents.mdc`.
- UI learning material, in this order: [libraries.dev](https://libraries.dev) (React effect libraries and their agent prompts) and [beUI](https://beui.dev) (animated React components; beui.com is a different, unrelated site). For layout and landing references, use the galleries godly.website, cta.gallery, 60fps.design, saasframe.io, navbar.gallery, designspells.com, landing.love, bentogrids.com, 404s.design, supahero.io, curated.design, footer.design, unsection.com, saaspo.com, styles.refero.design, and onepagelove.com. Look them up with Context.dev when the page is not already known.
