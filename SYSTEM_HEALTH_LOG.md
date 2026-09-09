# BeyondSAT System Health Log

**Run:** 2026-09-09 03:03 UTC (cron `/review-bugbot`)  
**Branch:** `cursor/system-integrity-audit-9ae2`  
**Live URL:** https://beyond-sat-v0.javazbek80.workers.dev

---

## Site alive check

| Route | Status | Notes |
|-------|--------|-------|
| `/` | 200 | Landing OK |
| `/signin` | 200 | Auth entry OK |
| `/signup` | 200 | Registration OK |
| `/dashboard` | 200 | App shell OK |
| `/admin` | 200 | Admin shell OK |
| `/practice` | 200 | Practice OK |
| `/beyond-ai` | 200 | AI chat shell OK |
| `/reset-password` | **404 live** | Route restored in code; needs deploy |
| `/api/health` | 404 | No health endpoint defined (expected) |
| `POST /api/import/vision` (no auth) | 401 | Rejects unauthenticated callers |

**Verdict:** Site is **UP**. Password reset flow broken on production until next deploy.

---

## Tests & build

| Check | Result |
|-------|--------|
| Vitest | **94/94 passed** (14 files) |
| `npm run build` | Failed locally — missing `@lovable.dev/vite-tanstack-config` (Lovable CI package; not in this VM) |
| `npm audit` | 11 vulnerabilities (2 moderate, 9 high) in `undici`/`miniflare`/`nitro`/`wrangler` chain — **do not** `audit fix --force` |
| ESLint | ~1146 Prettier/format issues (pre-existing) |

---

## Fixes applied this run (code — minor)

### 1. Import API staff gate regression (24th occurrence) — **CRITICAL fix**

**Problem:** `/api/import/vision`, `/fix`, `/figure` only checked `verifySupabaseUser`. Any signed-in student could burn Gemini/OpenRouter credits.

**Fix:**
- Restored `verifyStaffUser()` in `src/lib/server-env.ts` (calls `bs_is_staff` RPC)
- Re-added staff checks to all three import handlers

### 2. Missing `/reset-password` route — **HIGH fix**

**Problem:** `signin.tsx` sends password-reset emails to `/reset-password`, but the route was removed in a prior merge.

**Fix:** Restored `src/routes/reset-password.tsx` + `routeTree.gen.ts` entries.

### 3. Telegram ensure-webhook admin auth — **MEDIUM fix**

**Problem:** `callRpc(config, token, "bs_is_admin", {})` had wrong argument order; admin bearer auth always failed.

**Fix:** `callRpc(config, "bs_is_admin", token)` in `ensure-webhook-handler.ts`.

---

## Security findings (not fixed — need DB migrations or larger work)

| Severity | Issue | Fix type |
|----------|-------|----------|
| **CRITICAL** | `grade_answer` oracle — any authenticated user can probe correct answers by question ID | DB migration (bind to session) |
| **HIGH** | Profile `intro_completed` bypass — users can skip onboarding via direct UPDATE | DB trigger / column protection |
| **HIGH** | Profile `banned` self-unban — users can set `banned: false` on own row | DB trigger |
| **HIGH** | Incomplete ban enforcement on `/api/ai/*`, vocab, import (partially mitigated by import staff gate) | DB + API middleware |
| **HIGH** | Vocab quiz `correct_answer` exposed client-side via open SELECT | DB column revoke + server-only grading |
| **HIGH** | `tests.published` column added but RLS policy not migrated from `PRACTICE_SETS.sql` | DB migration |
| **MEDIUM** | Maintenance mode exempts all `/api/*` | Code (narrow exemption) |
| **MEDIUM** | Telegram link codes 6 hex chars, no rate limit | DB/code hardening |
| **LOW** | No API rate limiting on expensive endpoints | Cloudflare limits |
| **LOW** | Anon key in `wrangler.jsonc` (intentional for Supabase client) | Monitor only |

---

## Recent feature areas reviewed (no new bugs found)

- Mock exam R&W/Math sections, configurable break, H:MM:SS timer
- Image upload decode timeouts + signed URL display
- Submit scoring + durable image refs
- Import parser multi-row markdown table choices
- Vocab FSRS, deck tree, quiz submit handlers (staff-gated admin routes OK)
- Telegram webhook auto-ensure on Worker boot + scheduled cron

---

## Summary

| Action | Count |
|--------|-------|
| Bugs fixed (code) | 3 |
| Security regressions re-patched | 1 (import staff gate) |
| Routes restored | 1 (`/reset-password`) |
| Tests passing | 94/94 |
| Deploy needed | Yes — for `/reset-password` + import staff gate on live |
