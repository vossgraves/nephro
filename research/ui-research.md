# UI refresh research

## Impeccable

Impeccable is a cross-provider design skill pack and CLI, not a runtime UI component library. Its public docs describe a four-phase loop: set context, improve what exists, check before shipping, and maintain the design system. Its `impeccable` npm package is a CLI that scans HTML, CSS, JSX, TSX, Vue, and Svelte for deterministic design, accessibility, performance, responsive, and anti-pattern rules; its documented commands include `npx impeccable skills install` and `npx impeccable detect src/`. The package documentation also says the full suite is intended to be installed into an AI coding harness rather than shipped as a browser dependency.

Sources: [Impeccable design workflow](https://impeccable.style/designing); [Impeccable npm package](https://www.npmjs.com/package/impeccable); [Impeccable CLI repository](https://github.com/pbakaus/impeccable).

## Emil Kowalski design engineering

Emil Kowalski’s published guidance emphasizes purposeful motion, not animation for its own sake. Interactions should remain fast, usually below 300ms for UI controls, favor strong ease-out curves for entering elements, keep transitions interruptible, animate transform and opacity instead of layout properties, and respect reduced-motion preferences. Frequently repeated or keyboard-driven actions should usually be instant. The public skill listing identifies `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `prototype`, `pick-ui-library`, and related skills. The skill is a design workflow/resource, not a runtime npm dependency.

Sources: [Great Animations](https://emilkowal.ski/ui/great-animations); [You Don’t Need Animations](https://emilkowal.ski/ui/you-dont-need-animations); [AI Skills for Design Engineers](https://emilkowal.ski/skill); [Emil design engineering skill](https://github.com/emilkowalski/skill/tree/main/skills/emil-design-eng).

## React Three Fiber

React Three Fiber is a React renderer for Three.js. Its official docs state that R3F v9 pairs with React 19, matching Nephro’s current dependency set. The project already includes `three`, `@react-three/fiber`, `@react-three/drei`, and `animejs`, so no new Three.js runtime is required for this UI pass. The planned enhancement should keep semantic copy, controls, and important values in HTML and treat the scene as progressive enhancement.

Source: [R3F introduction](https://r3f.docs.pmnd.rs/getting-started/introduction).

## Implementation implication

Do not install Impeccable or Emil’s skills as browser dependencies. If desired, the Impeccable CLI can be added as a development-only tool for deterministic audits, while Emil’s principles can guide the implementation and validation. The UI pass should focus on hierarchy, direct manipulation, purposeful micro-interactions, strong focus states, mobile-first layout, and a restrained Three.js data-visual layer rather than adding unrelated 3D effects.
