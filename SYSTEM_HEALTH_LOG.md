# BeyondSAT system health log

Rolling notes from automated health / security cron runs.

## 2026-11-16

- **Live:** https://beyond-sat-v0.javazbek80.workers.dev — HTTP 200 on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP enforced; HSTS; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated health route)
- **Unauth API spot-check:** import/vision 401; admin create/delete/reset/invite 401; forgot-password 400; telegram webhook 401; preview-invite POST 404 / GET claim-invite 405 (expected without token)
- **P1A pentest:** `P1A_DONE` — no `[!]` flags
- **Tests:** 282/282 passed; `tsc --noEmit` OK; `vite build` OK
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical — tinypool/vitest, uuid/exceljs); safe `npm audit fix` unchanged; no `--force`
- **Lockfile:** resynced (`lru-cache@11.5.3` missing from lock — `npm ci` failed until `npm install`)
- **Fixed:** TS2367 dead SQB branches in `draft-editor.tsx` (ordinary path after early `variant === "sqb"` return); orphan test row typing
- **Added:** `SYSTEM_HEALTH_LOG.md` (missing on `main`); extended `p1a-unauth.mjs` routes (admin delete/reset/invite, auth preview/claim/forgot-password)
- **Not run / blocked:** `verify-phase1-security.mjs`, `verify-homepage-anon.mjs` — need Supabase credentials in `.dev.vars`
- **Lint:** pre-existing prettier/eslint drift — not addressed this run

## 2026-11-15

See automation memory — prior run on branch `cursor/system-health-and-security-0a44` (same fixes/log pattern).