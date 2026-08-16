# Accessibility review — layout, calculator, records (Worker C, Phase 2)

Reviewer: Worker C (landing-3d). Read-only review; **nothing in this file has been fixed** —
the integrator triages. Scope: `src/app/layout.tsx`, `src/app/calculator/page.tsx`,
`src/app/records/page.tsx`, plus the shared pieces they mount (`Field.tsx`, `KdigoHeatmap.tsx`,
`SimpleModeToggle.tsx`, `SplashGate.tsx`, `globals.css`). Line numbers are from the current
working tree at review time. Contrast ratios are estimates from the oklch tokens and must be
confirmed with a measured check (DevTools) before acting.

## Summary

- **Critical:** none found.
- **Important:** 5 (skip link; splash focus management; live results not announced; delete
  without confirmation; `--muted` contrast borderline).
- **Minor:** 6 (error association, save status, disabled button opacity, heatmap opacities,
  print of interactive controls, splash print).
- **Verified good:** landmarks, label/input association, focus-visible coverage, table
  semantics, `lang`, `aria-invalid`/`aria-pressed`/`aria-current` usage.

## Important

1. **No skip-to-content link (WCAG 2.4.1).** `src/app/layout.tsx:34-70` — the sticky header
   (`:36-68`) with nav + toggle comes before `<main>` (`:70`). Keyboard and screen-reader
   users must pass 6 nav links + the mode toggle on every page. Add a visually-hidden
   "Skip to content" link as the first focusable element targeting `main` (an `id` on main).

2. **Splash overlay hides content without inerting it (WCAG 2.4.3).**
   `src/app/layout.tsx:35` mounts `SplashGate`; `src/components/SplashGate.tsx:55-79` renders
   a `fixed inset-0 z-[100]` overlay marked `aria-hidden="true"` (`:61`) while the page
   underneath remains focusable. During the up-to-1.9s splash, Tab can land keyboard focus on
   invisible header links. Fix options for triage: `inert` on the rest of the app while the
   splash is up, or focus the overlay and restore on exit.

3. **Live results are never announced (WCAG 4.1.3).**
   `src/app/calculator/page.tsx:491-600` — the results panel appears and recomputes on every
   keystroke with no `aria-live`/`role="status"`. Screen-reader users get no indication that
   eGFR/risk/stage updated. Suggest a polite live region on the results wrapper (consider
   announcing only on the no-results → results transition to avoid per-keystroke chatter).

4. **Irreversible delete with no confirmation (WCAG 3.3.4).**
   `src/app/records/page.tsx:114-129` — one click submits the server action and permanently
   deletes a database record. For a clinical tool this is a data-loss risk for any user, and
   especially for keyboard/SR users who cannot see the button hover. Add a confirm step or an
   undo affordance (integrator decision).

5. **`--muted` contrast is borderline for small text.**
   `src/app/globals.css:11` (`--muted: oklch(0.49 0.013 250)`). Used pervasively at
   10-13px on `--bg`/`--surface`: `calculator/page.tsx:289, 530, 563, 594`; `Field.tsx:28`;
   `layout.tsx:77`; `records/page.tsx:33, 96, 111`. Estimated contrast on white ≈ 4.2-4.5:1,
   at/under the 4.5:1 AA threshold for normal text at those sizes. Needs a measured check;
   likely fix is darkening `--muted` (e.g. lightness ~0.45) — one token fixes every site.

## Minor

6. **Field errors not associated with their input.** `calculator/page.tsx:335-336, 356-357,
   383-384, 404-405` set `aria-invalid`; `Field.tsx:23-26` renders `role="alert"`. The
   message is announced but not linked to the control; adding `aria-describedby` from the
   input to the error text improves SR context (WCAG 3.3.1 best practice).

7. **Save confirmation is not a status message.** `calculator/page.tsx:476-482` renders
   `saveMsg` as a plain `<p>`, while the history/favorite toast at `:519` correctly uses
   `role="status"`. Add `role="status"` (or the same toast pattern).

8. **Disabled submit at 40% opacity.** `calculator/page.tsx:469-475` —
   `disabled:opacity-40`. Disabled controls are contrast-exempt, but 40% makes the label
   hard to read; consider 50-60%.

9. **Heatmap text at 70-80% opacity.** `KdigoHeatmap.tsx:75-85` — non-active cell text
   (`opacity-70`) and the active-cell sub-line (`opacity-80`) over pastel fills
   (`FILL` at `:24-29`). Probably still ≥4.5:1; verify by measurement.

10. **Interactive controls print.** `globals.css:325-333` hides only `.no-print`
    (header/footer: `layout.tsx:36, 72`). Calculator form + action buttons
    (`calculator/page.tsx:469-519`) and records Delete buttons (`records/page.tsx:114-129`)
    print as-is. Add `no-print` to controls or a print stylesheet.

11. **Splash overlay not `no-print`.** `SplashGate.tsx:56-79` — a print during the splash
    window outputs a full-page overlay. Minor (transient), but a one-class fix.

## Notes / verified good

- Landmarks: `header`/`main`/`footer` correctly ordered (`layout.tsx:36, 70, 72`); single
  `nav aria-label="Primary navigation"` visible per breakpoint (`SiteNav.tsx:56`); exactly
  one `h1` per page (`calculator/page.tsx:288`, `records/page.tsx:32`).
- Labels: every input/select pairs with `Field` `htmlFor` ↔ matching `id`
  (`calculator/page.tsx:307-464`, `Field.tsx:19`); unit selects carry `aria-label`
  (`calculator/page.tsx:362, 409`); `SimpleModeToggle` exposes `aria-pressed`
  (`SimpleModeToggle.tsx:39`).
- Focus-visible: global ring (`globals.css:70-73`); inputs replace `outline-none` with a
  visible `focus-visible` ring + accent border (`Field.tsx:38-39, 49-51`); SiteNav links
  have explicit rings (`SiteNav.tsx:80-89`); simple-mode thickens the ring
  (`globals.css:320-323`).
- Tables: `th scope="col"`/`scope="row"` + sr-only captions (`records/page.tsx:80-90`,
  `KdigoHeatmap.tsx:39-52, 57`); `aria-current` on the active heatmap cell
  (`KdigoHeatmap.tsx:67`).
- `html lang="en"` (`layout.tsx:33`); `aria-invalid` on validated fields; `role="alert"`
  on field errors; `aria-pressed` on the favorite toggle (`calculator/page.tsx:510`);
  `role="status"` on the history/fav toast (`calculator/page.tsx:519`).
- Contrast of primary surfaces is strong: `--text` ≈ 11:1 on white; primary button
  white-on-`--primary` ≈ 10:1. The `dark:` variants in `calculator/page.tsx:28-33` are dead
  code (`color-scheme: light`, `globals.css:52`) — not a defect, just note for triage.

## R3F canvas parity check (Phase 2 item 1)

Grep for `Canvas`/`<canvas` under `src/`: the only `@react-three/fiber` Canvas mount is
`src/components/hero/KidneyScene.tsx` (WebGL2 probe, poster fallback, error boundary,
perf config, frameloop pause — all present). `HeroScene.tsx` is a thin `next/dynamic`
wrapper with no canvas. The two `<canvas>` elements in
`src/components/imaging/ImagingWorkspace.tsx` are plain 2D canvases (Worker A's file) —
not R3F, no parity work needed. **No changes required for item 1.**
