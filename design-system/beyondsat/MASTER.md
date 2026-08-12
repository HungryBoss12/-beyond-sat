# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/beyondsat/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** BeyondSAT  
**Generated:** 2026-08-12 (UI UX Pro Max + brand overrides)  
**Category:** Educational App / Digital SAT prep

---

## Global Rules

### Brand (source of truth — overrides auto palette)

Keep the existing indigo brand ramp from `src/styles.css`. Do **not** switch to playful kids fonts or claymorphism for the student product.

| Role | Token / Hex | Notes |
|------|-------------|-------|
| Brand surfaces | `brand-500`–`brand-900` (`#100E66`…`#0D0D4C`) | Sidebars, panels, CTAs |
| Brand accents on dark | `brand-100`–`brand-400` | Borders, muted text, chips |
| Page background | `#FFFFFF` | App shell / most authenticated pages |
| Text on light | `brand-900` | High contrast body |
| Typography | Montserrat (sans) + Lora (serif) | Already in `@theme` |

### UX checklist (from UI UX Pro Max)

- [ ] Lucide/SVG icons only — no emoji icons
- [ ] `cursor-pointer` on clickable controls (global base rule)
- [ ] Hover + focus-visible states (150–300ms transitions)
- [ ] Text contrast ≥ 4.5:1 on light surfaces
- [ ] Respect `prefers-reduced-motion` (already in `styles.css`)
- [ ] Responsive: 375 / 768 / 1024 / 1440
- [ ] Multi-step flows show stage progress (e.g. import extract → recheck)

### Anti-patterns

- AI purple/pink gradients
- Comic/kids display fonts for high-school SAT product
- Placeholder-only form fields
- Removing focus outlines without a visible replacement
- Hover-only critical actions

### Interaction

- Primary CTAs use `btn-brand` (lift + sheen)
- Secondary controls use `tap` / `btn-ghost`
- Loading → success/error feedback on every submit
- Progress bars for long AI/import work

### Stack

React 19 + TanStack Start + Tailwind v4 + Lucide. Prefer existing brand utilities over inventing a second palette.
