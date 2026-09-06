# BeyondSAT System Health Log

## 2026-09-06 — Cron audit (`cursor/system-integrity-audit-20ec`)

### Live site
| Route | Status | Notes |
|-------|--------|-------|
| `/` | **200** | Landing page up |
| `/signin` | **200** | |
| `/signup` | **200** | |
| `/practice` | **200** | Auth-gated SSR |
| `/admin` | **200** | Auth-gated SSR |
| `/reset-password` | **404 live** | Route restored in code; needs deploy |

**URL:** https://beyond-sat-v0.javazbek80.workers.dev

### Fixed this run

1. **Security regression (21st occurrence)** — Import API routes (`/api/import/vision`, `/api/import/fix`, `/api/import/figure`) only checked authentication, not staff role. Any signed-in student could burn Gemini/OpenRouter credits.
   - Restored `verifyStaffUser()` in `src/lib/server-env.ts` (calls `bs_is_staff` RPC).
   - Re-applied staff gate in all three import handlers.

2. **Missing `/reset-password` route** — Password-reset emails from sign-in redirect to `/reset-password`, which 404'd on production.
   - Restored `src/routes/reset-password.tsx` and updated `routeTree.gen.ts`.

3. **Import parser regression** — Multi-row markdown table choices (A/B on row 1, C/D on row 2) were not merged.
   - Restored `joinAdjacentTableBlocks()` in `src/lib/import/parse.ts`.
   - Tests: **84/84 passed** (was 83/84).

### Security check (no code changes)

| Area | Status |
|------|--------|
| Import APIs | **Fixed** — staff-only again |
| Vocab admin APIs | OK — `requireStaff()` via `bs_is_staff` |
| AI chat API | OK — auth required before upstream call |
| Telegram webhook ensure | OK — setup token or admin-only |
| API keys in repo | OK — none committed; `.dev.vars` gitignored |
| npm audit | **8 issues** (4 moderate, 4 high) — all in `undici`/`wrangler`/`nitro` dev chain; do **not** `audit fix --force` |

### Known unfixed (need DB migrations)

1. **`grade_answer` oracle** — Any authenticated user can call `grade_answer(question_id, choice, null)` for any question without a session, brute-forcing the correct choice. Needs RPC to verify the question is in an active/completed session owned by the caller.

2. **Profile ban column** — If `profiles.banned` migration is not applied, ban check silently fails (treated as not banned). Client handles gracefully but bans won't enforce until migration runs.

### Pre-existing / informational

- **Lint:** ~793 Prettier/eslint issues (mostly formatting; pre-existing).
- **Build:** `npm run build` fails in this sandbox — missing `@lovable.dev/vite-tanstack-config` (Lovable-only package). Production deploys via Lovable/Wrangler work normally.
- **Recurring regression pattern:** Import staff checks and `/reset-password` keep getting dropped on merges to `main`. Consider a CI test that asserts `verifyStaffUser` is called in import handlers.

### Branch
`cursor/system-integrity-audit-20ec`
