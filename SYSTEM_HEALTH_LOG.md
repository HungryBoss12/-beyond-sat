# BeyondSAT System Health Log

Automated integrity audits (cron). Newest entries first.

---

## 2026-09-04 — `cursor/system-integrity-audit-8eae`

### Live site

| Route | Status | Notes |
|-------|--------|-------|
| `/` | **200** | Home loads |
| `/signin` | **200** | Auth page |
| `/signup` | **200** | Registration |
| `/practice` | **200** | Practice hub (SSR shell) |
| `/admin` | **200** | Admin shell |
| `/dashboard` | **200** | Dashboard shell |
| `/reset-password` | **404 live** | Route added this run; needs deploy |
| `POST /api/import/vision` | **401** | Rejects unauthenticated POST (expected) |
| `POST /api/ai/chat` | **401** | Rejects unauthenticated POST (expected) |

**URL:** https://beyond-sat-v0.javazbek80.workers.dev — **UP** on core routes.

### Fixed this run

1. **Security regression (19th occurrence):** `/api/import/vision`, `/api/import/fix`, and `/api/import/figure` only checked `verifySupabaseUser()` — any signed-in student could burn Gemini/OpenRouter quota. Re-secured with `verifyStaffUser()` → `bs_is_staff` RPC.
2. **Missing `/reset-password` route:** Supabase recovery emails redirect to `/reset-password` (see `signin.tsx` `redirectTo`). Added `src/routes/reset-password.tsx` and regenerated `routeTree.gen.ts`.
3. **Import parser:** Multi-row markdown table choices (A/B header row + separator + C/D data row split across blocks) were not detected. Added `joinAdjacentTableBlocks()` in `parse.ts` — restores 84/84 passing tests.

### Tests & lint

- **Tests:** 84/84 passed (`vitest run`)
- **Lint:** ~791 Prettier/format issues remain (pre-existing; not auto-fixed this run)
- **Build:** `npm run build` fails in cloud agent env — missing `@lovable.dev/vite-tanstack-config` (Lovable-only package; builds succeed in Lovable CI)

### Security audit (quick)

| Area | Status |
|------|--------|
| Import API staff gate | **Fixed** (was open to all authenticated users) |
| AI chat `/api/ai/chat` | OK — auth before upstream calls |
| Telegram webhook | OK — secret header verification |
| Vocab admin routes | OK — `requireStaff()` on generate/save/deck endpoints |
| Answer key column grants | OK — `correct_choice_id` revoked from direct SELECT |
| `grade_answer` RPC oracle | **Unfixed** — any authenticated user can probe arbitrary `question_id` without a session |
| Profile ban / onboarding bypass | **Unfixed** — client-side checks only; needs DB migration hardening |
| npm audit | 8 issues (4 moderate, 4 high); do **not** `audit fix --force` (breaks nitro) |

### Not changed

- No dependency upgrades
- No DB migrations applied
- `/login` still 404 (app uses `/signin`; cosmetic only)

---

## 2026-09-03 — `cursor/system-integrity-audit-0506`

### Live site

| Route | Status | Notes |
|-------|--------|-------|
| `/` | **200** | Home loads |
| `/signin` | **200** | Auth page |
| `/signup` | **200** | Registration |
| `/practice` | **200** | Practice hub (SSR shell) |
| `/admin` | **200** | Admin shell |
| `/reset-password` | **404 live** | Route added this run; needs deploy |
| `POST /api/import/vision` | **401** | Rejects unauthenticated POST (expected) |
| `POST /api/ai/chat` | **401** | Rejects unauthenticated POST (expected) |

**URL:** https://beyond-sat-v0.javazbek80.workers.dev — **UP** on core routes.

### Fixed this run

1. **Security regression (18th occurrence):** `/api/import/vision`, `/api/import/fix`, and `/api/import/figure` only checked `verifySupabaseUser()` — any signed-in student could burn Gemini/OpenRouter quota. Re-secured with `verifyStaffUser()` → `bs_is_staff` RPC.
2. **Missing `/reset-password` route:** Supabase recovery emails redirect to `/reset-password` (see `signin.tsx` `redirectTo`). Added `src/routes/reset-password.tsx`.
3. **Import parser:** Multi-row markdown table choices (A/B header row + C/D data row split across blocks) were not detected. Added `joinAdjacentTableBlocks()` in `parse.ts` — restores 84/84 passing tests.

### Tests & lint

- **Tests:** 84/84 passed (`vitest run`)
- **Lint:** ~742 Prettier/format issues remain (pre-existing; not auto-fixed this run)
- **Build:** `npm run build` succeeded

### Security audit (quick)

| Area | Status |
|------|--------|
| Import API staff gate | **Fixed** (was open to all authenticated users) |
| AI chat `/api/ai/chat` | OK — auth before upstream calls |
| Telegram webhook | OK — secret header verification |
| Vocab admin routes | OK — `requireStaff()` on generate/save/deck endpoints |
| Answer key column grants | OK — `correct_choice_id` revoked from direct SELECT |
| `grade_answer` RPC oracle | **Unfixed** — any authenticated user can probe arbitrary `question_id` without a session |
| Profile ban / onboarding bypass | **Unfixed** — client-side checks only; needs DB migration hardening |
| npm audit | 9 issues (5 moderate, 4 high); do **not** `audit fix --force` (breaks nitro) |

### Not changed

- No dependency upgrades
- No DB migrations applied
- `/login` still 404 (app uses `/signin`; cosmetic only)
