# UI direction: Clinical Instrument

## Intent

Nephro should feel like a dependable clinical instrument rather than a generic dashboard or an animated marketing template. The design system will use quiet white surfaces, graphite text, a single teal clinical accent, compact metadata, and strong information hierarchy. The visual language should support rapid scanning of values and predictable task completion on both desktop and mobile.

## Decisions

| Area | Selected approach | Rationale |
| --- | --- | --- |
| Impeccable | Install as a development-only detector (`impeccable@3.5.0`), not as a runtime package | It is a CLI/skill pack, not an end-user UI library. The initial source scan found one bounce-easing warning in `globals.css`, which will be removed. |
| Emil Kowalski principles | Apply in implementation rather than install as a browser module | The source material is a design-engineering skill set. Interactions will use short transform/opacity transitions, ease-out curves, interruptible hover states, and a full reduced-motion path. |
| Three.js | Keep it as progressive enhancement, not a dependency added to every route | Nephro already carries the R3F stack. The existing 3D signal scene will be placed in an optional desktop-only explainer card, with all clinical content preserved as normal HTML. |
| Motion | Retain existing anime.js for numeric/entrance choreography | Adding a second runtime motion system is unnecessary. Changes will emphasize responsiveness, focus, and feedback over decorative animation. |
| Navigation | Create an active-route navigation component with mobile-safe horizontal scrolling | This improves wayfinding at a high-frequency control without an expensive mobile menu. |
| Inputs and cards | Raise shared controls into a consistent clinical-instrument system | Shared primitives will receive a clearer border hierarchy, precise focus rings, useful hover states, and compact card headers. |

## UI changes

The new visual system will introduce a 12-pixel control radius, consistent raised-surface and inset-field treatments, visible keyboard focus, tactile press states, and faster 160–220ms transition timings. The landing page will gain a lightweight interactive 3D signal card within the computation section, while the live hero media remains the primary visual narrative. The calculator will gain stronger form/result separation through the shared primitives instead of decorative clutter.

## Guardrails

No Three.js canvas will contain required data, no value will become harder to read because of motion, and the site will remain complete with reduced motion, JavaScript delay, or narrow screens. The calculation and Imaging Lab will remain explicitly non-diagnostic where applicable.
