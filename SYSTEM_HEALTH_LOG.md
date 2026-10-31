# BeyondSAT system health log (cron / integrity audits)

Automated notes from scheduled integrity runs. Newest entries at the top.

---

## 2026-10-31 (UTC) — cron integrity audit

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password` | HTTP **200** |
| `/join/*` (sample token path) | HTTP **200** |
| `/api/health` | **404** (no dedicated health route; expected) |
| Security headers on `/` | CSP (enforced), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

**Unauthenticated API spot-checks (live):**

- `/api/admin/create-user`, `/api/import/vision`, `/api/ai/chat` → **401** without session
- `/api/auth/forgot-password` `{}` → **400** (validation)
- `/api/auth/preview-invite` `{}` → **404** (generic, no leak)
- `/api/telegram/webhook` `{}` → **401**

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):**

- Re-synced `ROUTES` with `src/server.ts` (admin reset/invite + auth preview/claim/forgot-password were missing on branch)
- Restored 90s timeout + abort handling on 2MB payload probes
- **Run:** `P1A_DONE`, **no `[!]` flags** (~11s)

**Repo CI locally:**

- `npm test` → **266/266** passed (46 files)
- `npm run typecheck` → OK after fixing `load-existing-orphans.test.ts` inference (`OrphanMathQuestion` export)
- `npm run build` → OK

**npm audit:**

- Fresh install reported 32 vulns; after `npm audit fix` (no `--force`): **26** remaining (nested `zod`, dev/tooling chains; breaking upgrades needed to clear)
- Did **not** run `npm audit fix --force`

**Not run (no `.dev.vars` in cloud agent env):**

- `scripts/verify-phase1-security.mjs`
- `scripts/verify-homepage-anon.mjs`
- P1B–P3 pentest scripts (require service role + test users)

**Security quick pass (code review):**

- No hardcoded secrets in app source; service role only referenced in local/pentest scripts
- `MathText` escapes HTML and allowlists `<u>` only before `dangerouslySetInnerHTML`
- Unauthenticated surface matches prior audits; no new public API routes in `src/server.ts`

**Code changes this run:**

- `scripts/pentest/p1a-unauth.mjs` — full route list + robust oversized-body probes
- `src/lib/import/load-existing.ts` — export `OrphanMathQuestion` type
- `src/lib/import/load-existing-orphans.test.ts` — explicit row typing (fixes `tsc` on CI)
- `package-lock.json` — safe `npm audit fix` dependency bumps
- This log file (re)created on branch `cursor/system-health-and-security-6f24`

**Lint:** not re-run (historically Prettier drift only)

---

## 2026-10-29 (UTC) — cron integrity audit

**Live site:** https://beyond-sat-v0.javazbek80.workers.dev

| Check | Result |
| --- | --- |
| `/`, `/signin`, `/dashboard`, `/signup`, `/reset-password`, `/join/*` | HTTP **200** |
| `/api/health` | **404** (no dedicated health route; expected) |
| Security headers on `/` | CSP (enforced), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |

**Unauthenticated API spot-checks (live):**

- Staff/import/AI/vocab/admin create paths → **401** without session
- `/api/auth/forgot-password` empty body → **400** `Invalid JSON`; `{}` → **400** (validation)
- `/api/auth/preview-invite` `{}` → **404** (generic, no leak)
- `/api/telegram/webhook` `{}` → **401**

**P1A pentest (`scripts/pentest/p1a-unauth.mjs`):**

- Re-synced `ROUTES` with `src/server.ts` (added admin reset/invite + auth preview/claim/forgot-password)
- Hardened 2MB payload probes (90s timeout + catch abort) so the harness completes on slow body reads
- **2026-10-29 re-run:** `P1A_DONE`, **no `[!]` flags** (~20s)

**Repo CI locally:**

- `npm test` → **246/246** passed
- `npm run typecheck` → OK
- `npm run build` → OK

**npm audit:**

- After `npm audit fix` (no `--force`): **4** remaining (vitest/tinypool/zod — dev/tooling)
- Did **not** run `npm audit fix --force`

**Not run (no `.dev.vars` in cloud agent env):**

- `scripts/verify-phase1-security.mjs`
- `scripts/verify-homepage-anon.mjs`

**Branch:** `cursor/system-integrity-audit-49e2` — PR #54
