# BeyondSAT System Health Log

Automated rechecks from the daily cron health automation. Newest entries first.

---

## 2026-08-14 03:17 UTC — Cron recheck

**Branch:** `cursor/system-health-and-security-33db`  
**Live site:** https://beyond-sat-v0.javazbek80.workers.dev  
**Repo HEAD before fixes:** `5d33f1c`

### Site alive

| Check | Result |
| --- | --- |
| `/` | HTTP 200 (~1.2s) |
| `/signin` | HTTP 200 (~0.5s) |
| `/dashboard` | HTTP 200 (client route shell; auth enforced client-side) |
| `/api/ai/chat` POST (no auth) | HTTP 401 ✓ |
| `/api/import/vision` POST (no auth) | HTTP 401 ✓ |
| Supabase REST (`qlzvngegsemrzmyxwykl.supabase.co`) | Reachable (401 on bare root — expected) |
| Cloudflare Worker headers | `server: cloudflare`, HTTP/2 |

### Build & lint

| Check | Result |
| --- | --- |
| `npm run lint` | **Failed** initially — Prettier formatting in `src/components/admin-import/index.ts` |
| `npm run lint --fix` | **Pass** after auto-fix |
| `npm run build` | **Pass** (Vite + Nitro Cloudflare target) |

### Security review

| Area | Finding | Severity | Action |
| --- | --- | --- | --- |
| Secrets in git | Only public Supabase anon/publishable keys in `.env` / `wrangler.jsonc` — intentional | OK | None |
| Service role key | Not present in repo | OK | None |
| API auth — `/api/ai/chat` | Requires valid Bearer token before upstream call | OK | None |
| API auth — import routes | Authenticated any user could call Gemini/OpenRouter (cost abuse) | **Medium** | **Fixed** — added `bs_is_staff` check via new `verifyStaffUser()` |
| Admin UI routes | Client-side `getStaffRole()` + editor section allow-list | OK | Server-side staff gate added for import APIs |
| Maintenance mode | Fail-open on RPC errors; admin bypass via `is_admin` RPC | OK | None |
| MathText XSS | Non-math text escaped; KaTeX with `throwOnError: false` | Low | Acceptable for SAT content |
| Banned users | Ban enforced on client route load; API routes don't re-check ban | Low | Noted — future hardening |
| npm audit | 4 high-severity issues in transitive deps (`brace-expansion`, `js-yaml`, `nanoid`, `undici` via nitro/miniflare) | Low–Med | Not auto-fixed — `npm audit fix --force` would break nitro |

### Bugs / code quality

| Item | Notes |
| --- | --- |
| Prettier export formatting | Fixed in `admin-import/index.ts` |
| Import API staff gate missing | Fixed in `vision-handler`, `fix-handler`, `figure-handler` |
| `build-out.txt` | Stale build artifact in repo root — left untouched (not harmful) |
| No `TODO`/`FIXME` markers | Clean |

### Changes made this run

1. **Added** `verifyStaffUser()` in `src/lib/server-env.ts` — calls Supabase RPC `bs_is_staff`.
2. **Added** staff-role guard (403) on:
   - `POST /api/import/vision`
   - `POST /api/import/fix`
   - `POST /api/import/figure`
3. **Fixed** Prettier lint in `src/components/admin-import/index.ts`.

### Removed

Nothing removed this run.

### Recommendations (not applied — out of scope / major)

- Run `npm audit fix` for non-breaking transitive updates when convenient.
- Consider server-side `bs_is_banned` check on paid API routes.
- Monitor OpenRouter/Gemini secret presence on the deployed Worker (503 paths exist when unset).
