# BeyondSAT System Health Log

Dated entries from automated health/security cron runs. Newest first.

---

## 2026-08-17 (cron 03:00 UTC)

**Branch:** `cursor/system-integrity-audit-07eb`

### Site availability

| Route | Status | Notes |
|-------|--------|-------|
| `/` | 200 | ~1.0s TTFB |
| `/signin` | 200 | |
| `/signup` | 200 | |
| `/dashboard` | 200 | SSR shell (auth enforced client-side) |
| `/practice` | 200 | |
| `/banned` | 200 | |
| `/favicon.svg` | 200 | BeyondSAT logo mark (deployed) |
| `/api/health` | 404 | No health endpoint defined (not a regression) |

**Live URL:** https://beyond-sat-v0.javazbek80.workers.dev — **alive**

### Security

| Check | Result |
|-------|--------|
| `/api/ai/chat` without auth | 401 ✓ |
| `/api/import/vision` without auth | 401 ✓ |
| `/api/import/fix` without auth | 401 ✓ |
| `/api/import/figure` without auth | 401 ✓ |
| Import routes staff-only | **Fixed (regression)** — main had auth-only guards; any signed-in student could burn Gemini/OpenRouter quota via `/api/import/*` |
| Secrets in repo | No `SERVICE_ROLE`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY` in committed files |
| Service role key | Read from `process.env` in `client.server.ts` only; documented as wrangler secret |

**Fix applied:** Re-added `verifyStaffUser()` in `src/lib/server-env.ts` (calls `bs_is_staff` RPC) and enforced it on `/api/import/vision`, `/api/import/fix`, and `/api/import/figure`. Invalid session → 401; signed-in non-staff → 403.

### Quality gates

| Gate | Result |
|------|--------|
| `npm run lint` | Pass (98 Prettier formatting issues auto-fixed) |
| `npm run test` | 26/26 passed |
| `npm run build` | Pass |
| `npm ci` | Pass |

### Dependency audit (`npm audit`)

9 vulnerabilities (5 moderate, 4 high), all transitive:

- `brace-expansion` (high) — dev tooling
- `js-yaml` (high) — dev tooling
- `nanoid` (high) — dev tooling
- `undici` via `nitro` / `@lovable.dev/vite-tanstack-config` (high)

**Action:** No `npm audit fix --force` — would downgrade `nitro` (breaking) and risk breaking the build.

### Added / changed / removed

- **Added:** `verifyStaffUser()` helper; staff checks on all three import API handlers; this log file.
- **Changed:** Prettier formatting across admin-import and related files (eslint `--fix`).
- **Removed:** Nothing.

### Follow-ups (not addressed this run)

- Merge staff-auth fix to `main` and deploy so production import routes are protected.
- Consider a lightweight `/api/health` or `/api/ping` for uptime monitors.
- Transitive audit issues await upstream `nitro` / eslint toolchain updates.

---

## 2026-08-15 (cron 03:02 UTC)

**Branch:** `cursor/system-health-and-security-9f2a`

### Site availability

| Route | Status | Notes |
|-------|--------|-------|
| `/` | 200 | ~1.0s TTFB |
| `/signin` | 200 | |
| `/signup` | 200 | |
| `/dashboard` | 200 | SSR shell (auth enforced client-side) |
| `/practice` | 200 | |
| `/banned` | 200 | |
| `/api/health` | 404 | No health endpoint defined (not a regression) |

**Live URL:** https://beyond-sat-v0.javazbek80.workers.dev — **alive**

### Security

| Check | Result |
|-------|--------|
| `/api/ai/chat` without auth | 401 ✓ |
| `/api/import/vision` without auth | 401 ✓ |
| Import routes staff-only | **Fixed** — was auth-only; any signed-in student could burn Gemini/OpenRouter quota |
| Secrets in repo | `.env` holds public Supabase anon key only (documented as safe to commit) |
| Service role key | Referenced only in server client; not in committed files |

**Fix applied:** Added `verifyStaffUser()` in `src/lib/server-env.ts` (calls `bs_is_staff` RPC) and enforced it on `/api/import/vision`, `/api/import/fix`, and `/api/import/figure`. Invalid session → 401; signed-in non-staff → 403.

### Quality gates

| Gate | Result |
|------|--------|
| `npm run lint` | Pass (98 Prettier formatting issues auto-fixed) |
| `npm run test` | 26/26 passed |
| `npm run build` | Pass |
| `npm ci` | Was failing — `package-lock.json` out of sync; `npm install` refreshed lockfile |

### Dependency audit (`npm audit`)

9 vulnerabilities (5 moderate, 4 high), all transitive:

- `brace-expansion` (high) — dev tooling
- `js-yaml` (high) — dev tooling
- `undici` via `nitro` / `@lovable.dev/vite-tanstack-config` (moderate)

**Action:** No `npm audit fix --force` — would downgrade `@lovable.dev/vite-tanstack-config` (semver-major) and risk breaking the build.

### Added / changed / removed

- **Added:** `verifyStaffUser()` helper; staff checks on all three import API handlers; this log file.
- **Changed:** Prettier formatting across admin-import and related files; `package-lock.json` sync.
- **Removed:** Nothing.

### Follow-ups (not addressed this run)

- Consider a lightweight `/api/health` or `/api/ping` for uptime monitors.
- Transitive audit issues await upstream `nitro` / eslint toolchain updates.
