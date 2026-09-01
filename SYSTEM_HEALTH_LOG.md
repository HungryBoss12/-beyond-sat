# BeyondSAT System Health Log

## 2026-09-01 — Cron audit (`cursor/system-integrity-audit-da01`)

### Live site
| Route | Status | Notes |
|-------|--------|-------|
| `/` | **200** | Landing page up |
| `/signin` | **200** | Auth entry |
| `/signup` | **200** | Registration |
| `/dashboard` | **200** | Authenticated shell |
| `/practice` | **200** | Practice hub |
| `/admin` | **200** | Admin shell |
| `/banned` | **200** | Ban page |
| `/reset-password` | **404 (live)** | Route added in this audit; needs deploy |
| `/api/import/vision` | **405** | Exists (GET rejected as expected) |
| `/login` | **404** | Not a route — use `/signin` |

**URL:** https://beyond-sat-v0.javazbek80.workers.dev

### Fixes applied (this run)
1. **Security regression (16th occurrence):** `/api/import/vision`, `/api/import/fix`, `/api/import/figure` were auth-only — any signed-in student could burn Gemini/OpenRouter quota. Re-added `verifyStaffUser()` (`bs_is_staff` RPC) to all three handlers.
2. **Missing `/reset-password` route:** Password-reset emails from `/signin` pointed to a 404. Restored the client-side recovery page (`exchangeCodeForSession` + `updateUser`).
3. **Import parser bug:** Multi-row markdown tables (A/B on one row, C/D on the next) only parsed partial choices. `locateChoices` now joins adjacent `| … |` blocks before extraction.

### Tests & build
- **Tests:** 76/76 passed (was 75/76 — `blocksToDrafts` table test fixed)
- **Build:** `npm run build` succeeded
- **Lint:** ~715 Prettier issues remain (pre-existing; not auto-fixed to avoid a massive unrelated diff)

### Security review
| Area | Status |
|------|--------|
| Import API staff gate | **Fixed** (was open to any authenticated user) |
| Vocab admin APIs | OK — `requireStaff()` on generate/save/decks/cards |
| AI chat `/api/ai/chat` | OK — requires valid Supabase session before upstream call |
| Telegram webhook | OK — secret header verification |
| Answer key column grants | OK — `correct_choice_id` revoked from direct SELECT |
| `grade_answer` RPC | **Known oracle** — any authenticated user can probe arbitrary question IDs for correctness without attempting; needs DB migration to tie to session ownership |
| Profile ban enforcement | Partial — RLS blocks `test_sessions`/`attempts` for banned users; direct profile `intro_completed` self-update may still bypass onboarding (needs RLS review) |
| `dangerouslySetInnerHTML` | Limited to KaTeX-rendered math (`MathText`) and chart styles — acceptable with trusted input |

### npm audit
9 vulnerabilities (5 moderate, 4 high) — mostly transitive (`undici` via `nitro`/`miniflare`). Do **not** run `npm audit fix --force` (breaks nitro).

### Unfixed (needs migrations / deploy)
- `grade_answer` oracle hardening
- Profile `intro_completed` / ban bypass at profiles UPDATE policy
- Deploy this branch to fix live `/reset-password` and import staff gate

### Branch
`cursor/system-integrity-audit-da01`
