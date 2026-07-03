# Design Review: career-ops 2.0 - Templates admin (Config)

**Date:** 2026-07-03
**URL:** /config (local dev)
**Scope:** the new CV / Cover-letter Templates sections

## Overall Impression

After the alignment fix, the Templates sections read as a native part of Config: same warm, minimal aesthetic, the same Card/Badge/Button kit, consistent spacing and typography. Professional and consistent, not "developer-designed."

## Findings

### High
- **Full-bleed misalignment** at `config/page.tsx` - the Templates sections were direct children of `<main>` (1040px, no padding), while `ConfigForm` lives in a centered `mx-auto max-w-2xl px-6` column (672px). The templates sprawled full width and touched the edges. → Fixed: wrapped both sections in the same centered, padded column. Verified pixel-aligned (both x=424, w=672).

### Low
- **Card actions could overflow** at `template-card.tsx` - a named template shows five actions (Set default / Edit / Preview / Rename / Delete) in a `flex gap-2`; on a narrow 2-column card that could overflow horizontally. → Fixed: added `flex-wrap`.

## What Looks Good

- Reuses the existing `Card` (brand-gradient corner), `Badge` (emerald "Default"), and `Button` variants - visually identical to the CLI-detection cards above.
- Section labels use the established uppercase tracked style; vertical rhythm (`mt-8`, `mb-2`, `gap-3`) matches the rest of Config.
- Clear hierarchy: primary "Set default" vs outline "Edit" vs ghost "Preview/Rename/Delete"; the current default is disabled and badged.
- Inline, state-driven feedback (`role="status"`) - no toast dependency, matching the app.
- Responsive: clean single-column stack on mobile, two-column grid from `sm`, no horizontal overflow; touch targets adequate.
- Contrast passes AA in both themes (muted text 6.5:1 light / 8.2:1 dark; headings 15-20:1).

## Top 3 Fixes (all applied)

1. Align the Templates sections to the Config column (High).
2. Wrap card actions so five-button cards never overflow (Low).
3. (From the a11y pass) visible focus rings on the title pills.
