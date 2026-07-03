# Accessibility Audit: Templates admin UI

**Target:** `web/src/components/templates/*`, `web/src/app/config/page.tsx`
**Standard:** WCAG 2.1 Level AA
**Result:** Passing (all found issues remediated and verified in the running app)

## Issues found and fixed

| # | Severity | Criterion | Component | Issue | Fix |
|---|----------|-----------|-----------|-------|-----|
| 1 | Critical | 4.1.2 Name/Role/Value; 2.1.2 No Keyboard Trap; 2.4.3 Focus Order | `template-editor.tsx` | Modal was a plain `div` with no dialog semantics, focus management, or Escape | `role="dialog"` + `aria-modal` + `aria-labelledby`; focus moves into the panel on open and returns to the trigger on close; Escape closes |
| 2 | Serious | 3.3.2 Labels or Instructions; 4.1.2 | `template-editor.tsx` | Titles input had an empty label (no accessible name); body textarea unlabeled | `aria-label` on titles input; the body textarea is now wrapped in a `<label htmlFor>` |
| 3 | Serious | 4.1.2 | `templates-section.tsx` | Visually-hidden file input was focusable but unlabeled | `aria-hidden` + `tabIndex={-1}` so the labeled Upload button is the sole control |
| 4 | Moderate | 2.4.7 Focus Visible | `title-pills.tsx` | Pill toggle buttons had no visible focus ring | Added `focus-visible:ring-2` |
| 5 | Moderate | 4.1.3 Status Messages; 2.4.3 | `templates-section.tsx` | Delete confirmation not announced / not focused | `role="alertdialog"`, focus moves to it on open |

## Verified in the running app

- Editor dialog: `aria-modal="true"`, labelled "Edit template · standard", focus enters the dialog, Escape closes it, titles input and body textarea both have accessible names.
- Inline status uses `role="status"` / `aria-live="polite"`; validation errors use `role="alert"`.
- Pills expose `aria-pressed` and a `role="group"` with an accessible name.

## Color contrast (composited over the page background)

| Text | Dark | Light | AA (4.5:1) |
|------|------|-------|------------|
| Card heading (foreground) | 20.1:1 | 15.7:1 | Pass |
| Muted labels/descriptions (`text-muted`) | 8.2:1 | 6.5:1 | Pass |
| Preview/action buttons | 20.1:1 | — | Pass |

Default badge reuses the app-wide emerald token pair. No new low-contrast tokens introduced.

## Notes / further enhancements (non-blocking)

- The editor implements focus-in, Escape, and focus-return; a full Tab focus-trap (ARIA APG dialog pattern) could be added later but is not an AA failure given `aria-modal` marks outside content inert for AT.
