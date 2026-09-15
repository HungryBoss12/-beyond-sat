# BeyondSAT system health log

## Cron audit — 2026-09-15 (UTC)

**Branch:** `cursor/system-integrity-and-security-7b8a`  
**Live URL:** https://beyond-sat-v0.javazbek80.workers.dev

### Site availability

| Route | HTTP | Notes |
|-------|------|--------|
| `/` | 200 | OK |
| `/signin` | 200 | OK |
| `/dashboard` | 200 | OK |
| `/reset-password` | 404 | Route missing on **deployed** worker until this branch is deployed |

### Tests & build

- **Vitest:** 108/108 passed (17 files)
- **Production build:** Not run in agent sandbox (`@lovable.dev/vite-tanstack-config` unavailable locally; expected)
- **ESLint:** Pre-existing repo-wide prettier drift; changed files lint clean aside from import-folder noise when globbed

### npm audit

- **12 vulnerabilities** (2 moderate, 10 high), mostly transitive `undici` via `nitro`
- **Action:** Do **not** run `npm audit fix --force` (breaking nitro bump per prior audits)

### Security review

| Area | Status | Action this run |
|------|--------|-----------------|
| `/api/import/vision`, `/fix`, `/figure` | **Regression:** any signed-in user could burn Gemini/OpenRouter keys | Re-secured with `requireStaff()` + `bs_is_staff` RPC |
| `/api/telegram/ensure-webhook` admin bearer path | **Bug:** `callRpc` args swapped (`token` passed as function name) | Fixed to `callRpc(config, "bs_is_admin", token, {})` |
| `/api/ai/uinfo` | Handler existed but was **not** registered in `src/server.ts` (dev / future deploy gap) | Wired `handleUinfoFlush` in server wrapper |
| Other `/api/*` routes | Spot-checked: AI chat, vocab, create-user use auth/staff gates | No change |
| Live unauthenticated POST `/api/import/vision` | 401 | OK on deployed worker |

### Bugs fixed (code)

1. **Import API staff gate** — `vision-handler`, `fix-handler`, `figure-handler` now use `requireStaff`.
2. **Telegram webhook ensure** — corrected `callRpc` argument order for admin authorization.
3. **Password reset flow** — restored `src/routes/reset-password.tsx` and regenerated `routeTree.gen.ts` (sign-in redirect target was 404).
4. **Username slug** — numeric-only display names (e.g. `"12"`) again slug to `user12` (`login-email.ts`; test was failing).
5. **Uinfo flush API** — registered `/api/ai/uinfo` in `server.ts`.

### Known issues (not fixed — need DB migrations / product decisions)

- `grade_answer` oracle exposure for authenticated users (historical)
- Profile ban / onboarding bypass via self-update (historical)
- Vocab quiz answer leak via RLS (historical)
- `tests.published` RLS hardening (see `supabase/PRACTICE_SETS.sql` vs live DB state)
- Deployed worker still on prior build until CI/Lovable deploy picks up this branch

### Removed

- Nothing removed this run.

### Added

- `SYSTEM_HEALTH_LOG.md` (this file)
- `src/routes/reset-password.tsx`
