# Admin Import — page overrides

Overrides `MASTER.md` for `/admin/import`.

## Goals

- Clear multi-step feedback for scanned PDF AI import
- Stage 1 Extract (Pro) and Stage 2 Recheck (Flash) always visible while running
- Preserve brand navy surfaces; no second palette

## Patterns

- Overall progress + two stage bars
- `role="status"` / `aria-live="polite"` on progress region
- Focus-visible rings on Stop / Read actions
- Prefer completeness notes over silent empty results
- **Fix broken with AI** on the preview: two-factor repair (Pro fix → Flash recheck) for invalid/warning rows
