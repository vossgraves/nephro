# Comparative Three.js research notes

## Renamed repository verification

The public repository is now accessible at [vossgraves/Nephro](https://github.com/vossgraves/Nephro). GitHub shows a public `main` branch and a recent commit titled `Fix hero blank-then-pop entrance, overflowing unit inputs, and impossible eGFR from out-of-range creatinine`. The README explicitly describes the landing page as a Three.js hero with a custom GLSL kidney shader, particle field, and anime.js entrance choreography. The deployed site linked from the repository is `nephro-delta.vercel.app`.

## Official Three.js examples

[Three.js Examples](https://threejs.org/examples/) presents a broad catalog organized by technique, including animation/keyframes, camera, clipping, depth textures, instancing, interaction, post-processing, shaders, and performance-oriented examples. The relevant takeaway for Nephro is to choose a small number of techniques that support the product story instead of stacking effects indiscriminately. For this landing page, the most transferable patterns are a shader/material treatment for the kidney, a controlled camera relationship, subtle interaction, and a particle or flow field that communicates data without becoming a game-like distraction. The examples index also makes the documentation function as a reference map: implementation decisions can be tied to a known Three.js capability rather than an opaque visual trick.

## Bruno Simon’s site

[Bruno Simon](https://bruno-simon.com/) is a highly immersive interactive portfolio whose visible entry point is essentially a canvas. Its main lesson is not to copy the interaction model: a clinical calculator cannot make 3D the only navigation system. The transferable lesson is commitment and coherence. The 3D experience owns a clear visual identity, and the interaction is the product rather than an ornamental background. Nephro should therefore make the kidney scene legible and purposeful, while retaining real DOM navigation and keyboard-accessible CTAs. The site also demonstrates the trade-off: canvas-first experiences can load into a visually sparse state and require more patience before the user understands what to do, which is unsuitable for a medical tool whose value proposition must be visible immediately.

## Early design implications

The redesign should retain a static server-rendered copy layer and accessible DOM controls, then use Three.js as a visual explanation of computation rather than as navigation. The kidney object can serve as a focal anchor, with a restrained visual grammar based on pulses, orbiting markers, and responsive pointer parallax. Animation should have an explicit start and stop policy, honor reduced motion, and degrade gracefully when WebGL is unavailable or when the device is constrained.

## Official anime.js v4 documentation

[Anime.js documentation](https://animejs.com/documentation/) exposes v4.5.0 as the current documented version and provides timelines, staggered delays, DOM/SVG/JavaScript-object targets, CSS variables, easing controls, callbacks, and lifecycle methods such as `pause`, `resume`, `cancel`, `revert`, and `seek`. For Nephro, the best use is a small, interruptible timeline for copy, badge, CTA, and metric entrances, plus a separate object animation for the metric values. It should not be used to drive Three.js objects every frame; the render loop remains the right place for per-frame 3D mutation.

## Official React Three Fiber performance pitfalls

[React Three Fiber performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls) emphasizes that Three.js has a render loop unlike the DOM. Fast updates belong in `useFrame` through mutation and frame deltas, not React state updates. It recommends reusing geometries and materials, using instancing for many similar objects, avoiding unnecessary mount/unmount cycles, and fetching fast state directly rather than binding it reactively. The current Nephro scene already follows several of these practices: it mutates refs in `useFrame`, uses memoized uniforms, pauses the frame loop when the hero is not visible, and respects reduced motion. The redesign should preserve that architecture and avoid adding state-driven animation to the WebGL loop.

## Implementation implications

The research supports a split animation system: Three.js/R3F owns continuous low-level scene motion with `useFrame`, while anime.js owns one-shot DOM choreography and controlled numeric transitions. This separation will keep animation responsibilities clear and reduce unnecessary React work.

## Awwwards Three.js gallery

[Awwwards’ Three.js collection](https://www.awwwards.com/websites/three-js/) frames Three.js sites as interactive 3D graphics, animations, product showcases, and visualizations. The gallery is useful as a pattern library rather than a direct technical source: representative entries favor strong visual focal points, large image or canvas areas, and concise editorial framing. For Nephro, the right adaptation is a strong focal kidney scene with an editorial level of restraint, not a portfolio-style full-screen canvas that hides the product’s clinical purpose.

## React Three Fiber showcase

The [React Three Fiber examples page](https://r3f.docs.pmnd.rs/getting-started/examples) demonstrates a range of production patterns, including selection/tilt-shift, rounded-card rendering, fisheye interaction, post-processing, annotations, portals, image galleries, and scroll/controls. The useful direction for Nephro is the presence of annotations and controlled interaction around a scene: a medical visualization can benefit from a small number of labeled data signals or orbiting checkpoints, provided the labels remain real DOM content and do not depend solely on a canvas overlay. The examples also reinforce that 3D can be modularized as a component while the surrounding page remains a normal application.

## Cross-site conclusion so far

Across the official examples, Bruno Simon, the Awwwards gallery, and the R3F showcase, the strongest common pattern is a clear visual thesis: the 3D layer either is the product or explains a product. Nephro’s thesis should be “transparent computation around a human organ,” with motion that makes values feel traceable. The page should not imitate portfolio spectacle; it should use premium interactive craft to make the trust story memorable.

## One Page Love Three.js index

[One Page Love’s Three.js collection](https://onepagelove.com/tech/three-js) lists 37 real one-page examples and exposes useful filters for genre, style, platform, technology, and color. The collection includes landing pages, digital products, apps, startups, portfolios, and experimental work, which supports treating Three.js as a flexible layer rather than a genre by itself. A relevant pattern is the coexistence of strong visual signatures with ordinary page structures, including landing-page sections and clear marketing categories. Nephro can borrow this discipline: use 3D to differentiate the first impression, then move into scannable sections with clear value and action.

## Anidachi featured site

[Anidachi](https://anidachi.com/) is a product-oriented, highly visual site with a full-bleed colorful hero, a simple waitlist CTA, a short product thesis, and a long scroll narrative broken into focused sections such as Shape-shifter, Travel-sized, games, and Independent behavior. It demonstrates how a visual product can be explained by progressively revealing capabilities rather than relying on one hero effect. The transferable pattern is the section choreography: each scene has a job and each job has a short statement. For Nephro, that could become a sequence of `Compute`, `Show the working`, `Understand the risk`, and `Act with context`, with the calculator CTA remaining visible and obvious throughout.

## New synthesis

The strongest research-backed direction is a hybrid landing page: one visual hero with a memorable kidney scene, followed by deliberate narrative sections that explain the computation journey. The 3D should not be a decorative layer detached from the product; it should visualize the same facts the page claims to compute. The page should remain usable on first paint, with real HTML copy and controls available before WebGL finishes.

## Anime.js React integration and timeline details

[Anime.js React integration](https://animejs.com/documentation/getting-started/using-with-react/) recommends combining React `useEffect()` with `createScope()` and calling `scope.current.revert()` during cleanup. That is directly applicable to a client-only hero choreography component: scope the animation to a root element, keep references to the scope, and ensure development-mode remounts or route transitions do not leave stale animations behind.

[Anime.js timelines](https://animejs.com/documentation/timeline/) provide synchronized animation, timers, and callbacks through `createTimeline()`, with methods for adding animations, timers, sync points, callbacks, and labels. This supports a measured choreography in which the eyebrow appears first, the headline and supporting line follow, the computed metrics settle in, and the CTAs arrive last. The timeline should be short, reversible or cancellable, and skipped or simplified when reduced motion is requested.
