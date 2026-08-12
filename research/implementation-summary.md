# Nephro Landing Page: Implementation Summary

**Project:** [vossgraves/Nephro](https://github.com/vossgraves/Nephro)
**Commit:** `af763ce` — `Improve landing page with computation-focused three.js scene`
**Status:** Implemented locally, production build verified

## What changed

The landing page now uses an actual React Three Fiber scene as a visual explanation of the product rather than as a generic atmospheric background. The hero contains a kidney-inspired computational core, two orbital rings, three signal nodes, a particle field, low-amplitude pointer response, visibility-aware rendering, and a reduced-motion path. The scene is intentionally optional: the server-rendered copy, metrics, evidence, links, and disclaimer remain available without WebGL.

The hero layout now has a stronger left-copy/right-visual composition on wide screens, a more explicit trust line, clearer primary and secondary CTAs, and a semantic “Live signals” legend for eGFR, KFRE risk, and KDIGO stage. The animated values are now passed from the same renal calculation payload used by the evidence cards. This fixed the previous mismatch between hard-coded hero numbers and deterministic card values.

Below the hero, the landing page now includes a three-output evidence section and a four-step “computation made inspectable” narrative covering patient inputs, published equations, KDIGO context, and citeable working. The deterministic-guidance copy is more confident and less dependent on attacking unnamed competitors. The compact trace now correctly renders `G3b A2` instead of duplicating the stage prefixes. The shared home navigation label is now “Overview,” reserving “Calculator” for the actual calculator route.

## Files changed

| File | Purpose |
|---|---|
| `src/components/hero/KidneyScene.tsx` | Rebuilt the R3F scene with the computation core, orbit system, signal nodes, particles, pointer response, and reduced-motion behavior. |
| `src/components/hero/HeroScene.tsx` | Added the client-only `next/dynamic` boundary required for `ssr: false` in Next.js. |
| `src/components/hero/Hero.tsx` | Refined the hero visual field, grid treatment, fallback layering, and server/client composition. |
| `src/components/hero/HeroContent.tsx` | Reworked hierarchy, copy, CTAs, badges, signal legend, and responsive alignment. |
| `src/components/hero/HeroStats.tsx` | Added anime.js React scoping/cleanup and calculation-driven numeric entrances. |
| `src/app/page.tsx` | Added the evidence narrative, computation-flow section, updated trust copy, and corrected trace output. |
| `src/app/layout.tsx` | Renamed the home navigation item from “Calculator” to “Overview.” |
| `research/research-dossier.md` | Full Three.js/anime.js comparative research and redesign blueprint. |
| `research/competitor-notes.md` | Earlier comparative audit notes from the reviewed websites and official documentation. |
| `research/validation.md` | Visual, runtime, route, and data-integrity validation notes. |

## Validation results

The local TypeScript checker passed. The production build passed with Next.js static generation and reported the following route sizes: `/` at 18 kB and 124 kB first-load JavaScript, `/calculator` at 5.84 kB and 112 kB, `/methods` at 123 B and 103 kB, and `/records` at 160 B and 106 kB. The renal equation regression suite passed with `all renal equation checks passed`. Local smoke requests returned HTTP 200 for `/`, `/calculator`, `/methods`, and `/records`.

The browser visual pass confirmed that the Three.js scene is visible and active, the hero metrics match the evidence cards (`43.6`, `0.9`, and `G3b A2`), and the lower-page narrative, corrected trace, deterministic guidance panel, final CTA, and disclaimer render correctly. The only console message observed was the existing Three.js deprecation warning for `THREE.Clock`; no React or WebGL runtime error appeared.

## Research-to-implementation mapping

| Research finding | Implementation response |
|---|---|
| Three.js examples reward one coherent interaction grammar rather than effect accumulation [1] | One core object, two rings, three signal nodes, and low-amplitude pointer response. |
| Bruno Simon demonstrates direct manipulation but makes exploration the content [2] | Nephro keeps pointer response optional and leaves the clinical message/CTA in HTML. |
| R3F guidance favors ref mutation in `useFrame`, reusable geometry/materials, and avoiding high-frequency React state [3] | Scene motion uses refs and frame deltas; no React state updates occur in the render loop. |
| anime.js React guidance recommends scoped instances and cleanup [4] | `HeroStats` uses `createScope`, scoped `animate`, and `revert()` on unmount. |
| Product-oriented Three.js landing pages use one visual job per section [5] | The page now progresses from hero signals to three outputs, four computation steps, guidance, and action. |

## References

[1]: https://threejs.org/examples/ "Three.js official examples"
[2]: https://bruno-simon.com/ "Bruno Simon interactive portfolio"
[3]: https://r3f.docs.pmnd.rs/advanced/pitfalls "React Three Fiber performance pitfalls"
[4]: https://animejs.com/documentation/getting-started/using-with-react/ "Anime.js using with React"
[5]: https://anidachi.com/ "Anidachi product landing page"
