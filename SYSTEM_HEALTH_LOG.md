# BeyondSAT system health log

Rolling notes from automated health / security cron runs.

## 2026-11-19

- **Live:** https://beyond-sat-v0.javazbek80.workers.dev — HTTP 200 on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`
- **Headers:** CSP enforced; HSTS; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated health route)
- **Unauth API spot-check:** forgot-password POST `{}` → 400; telegram webhook POST → 401; claim-invite GET → 405; preview-invite POST `{}` → 404 (invalid/short token — expected)
- **P1A pentest:** `P1A_DONE` — no `[!]` flags
- **Tests:** 348/348 passed; `tsc --noEmit` OK after fixes; `vite build` OK
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical — uuid/exceljs); no `audit fix --force`
- **Lockfile:** resynced (`lru-cache@11.5.3` missing — `npm ci` failed until `npm install`)
- **Fixed (regression on branch):** TS2367 dead SQB branches in `draft-editor.tsx`; orphan test `Row[]` typing; session review `activeSection` / `activeModule` for `openPart`
- **Added:** `SYSTEM_HEALTH_LOG.md` with this entry
- **Not run / blocked:** `verify-phase1-security.mjs`, `verify-homepage-anon.mjs` — no `.dev.vars` in cron env
- **Lint:** pre-existing drift — not addressed

## 2026-11-18

- **Live:** https://beyond-sat-v0.javazbek80.workers.dev — HTTP 200 on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP enforced; HSTS; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated health route)
- **Unauth API spot-check:** forgot-password POST `{}` → 400; telegram webhook → 401; claim-invite GET → 405; preview-invite POST `{}` → 400
- **P1A pentest:** `P1A_DONE` — no `[!]` flags
- **Tests:** 348/348 passed; `tsc --noEmit` OK after fixes; `vite build` OK
- **npm audit:** 24 vulnerabilities (9 moderate, 13 high, 2 critical — tinypool/vitest, uuid/exceljs); safe `npm audit fix` not applied; no `--force`
- **Fixed (regression on `main`):** TS2367 dead SQB branches in `draft-editor.tsx` after early `variant === "sqb"` return; orphan test `Row[]` typing; session review `openPart` args after search guard (`activeSection` / `activeModule`)
- **Removed:** unreachable SQB-only UI blocks in ordinary `DraftEditor` return path
- **Added:** `SYSTEM_HEALTH_LOG.md` on branch (absent on `main`)
- **Not run / blocked:** `verify-phase1-security.mjs`, `verify-homepage-anon.mjs` — need Supabase credentials in `.dev.vars`
- **Lint:** pre-existing prettier/eslint drift — not addressed this run
- **Note:** `username-login` 2MB payload returns 413 (expected); preview-invite now 400 on empty body (was 404 on some prior deploys)

## 2026-11-17

- **Live:** https://beyond-sat-v0.javazbek80.workers.dev — HTTP 200 on `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`; title `BeyondSAT — Master the Digital SAT`
- **Headers:** CSP enforced; HSTS; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`
- **`/api/health`:** 404 (no dedicated health route)
- **Unauth API spot-check:** forgot-password POST `{}` → 400; telegram webhook → 401; claim-invite GET → 405; preview-invite POST `{}` → 404
- **P1A pentest:** `P1A_DONE` — no `[!]` flags (route list includes admin delete/reset/invite + auth preview/claim/forgot-password)
- **Tests:** 282/282 passed; `tsc --noEmit` OK; `vite build` OK
- **npm audit:** 12 vulnerabilities (10 moderate, 2 critical — tinypool/vitest, uuid/exceljs); safe `npm audit fix` unchanged; no `--force`
- **Lockfile:** resynced (`lru-cache@11.5.3` missing from lock — `npm ci` failed until `npm install`)
- **Fixed:** TS2367 dead SQB branches in `draft-editor.tsx` (ordinary path after early `variant === "sqb"` return); orphan test row typing
- **Restored:** `SYSTEM_HEALTH_LOG.md` (absent on `main`); extended `p1a-unauth.mjs` routes on `main` (admin delete/reset/invite, auth preview/claim/forgot-password)
- **Not run / blocked:** `verify-phase1-security.mjs`, `verify-homepage-anon.mjs` — need Supabase credentials in `.dev.vars`
- **Lint:** pre-existing prettier/eslint drift — not addressed this run

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