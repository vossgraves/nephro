# Nephro Landing Page: Three.js and anime.js Research Dossier

**Author:** Manus AI
**Project:** Nephro / Renal Function Calculator
**Repository:** [vossgraves/Nephro](https://github.com/vossgraves/Nephro)
**Live site:** [nephro-delta.vercel.app](https://nephro-delta.vercel.app/)
**Research status:** Complete before implementation

## Executive summary

Nephro already has the right product thesis: it presents renal-function calculations as deterministic, published, citeable mathematics rather than as a black-box AI experience. The existing codebase also has a credible technical foundation: Next.js, React 19, React Three Fiber, Three.js, Drei, anime.js, server-rendered hero copy, a reduced-motion path, and a visibility-aware Three.js render loop. The problem is not a lack of technology. It is that the current 3D layer is primarily atmospheric while the page’s strongest product promise is explanatory and traceable.

The recommended redesign is therefore not a portfolio-style “more effects” treatment. It is a focused medical visualization system built around one memorable idea: **the page makes computation visible**. The hero should retain a calm, dark teal visual field but introduce a legible kidney-inspired orbital form, a small number of real annotation signals, and a clear handoff from the canvas to the three computed evidence cards. The post-hero narrative should turn the same visual language into a four-step story: input, equation, risk context, and clinical next step. The calculator remains the primary action; the methods page remains the trust action.

Three.js should own continuous scene motion, pointer response, and object interpolation. anime.js should own short DOM timelines, count-up values, and section reveals. This split follows the official React Three Fiber guidance that fast updates belong in the render loop and should mutate refs rather than trigger React state updates [5], and anime.js’s documented React pattern of scoping animations and reverting them during cleanup [8].

No application code was changed during the research phase.

## 1. Existing product and code audit

### 1.1 Product positioning

The current landing page is unusually clear about what it is not. Its headline, “Kidney numbers, computed honestly,” is direct, and the supporting copy names CKD-EPI 2021 eGFR, the Kidney Failure Risk Equation, KDIGO staging, zero training data, and zero black boxes. This is a strong trust position for a clinical calculator. The page also carries a visible disclaimer that it is not a medical device and does not replace clinical judgment.

The current narrative has three main beats after the hero. First, it displays three computed cards for CKD-EPI 2021 eGFR, KFRE risk, and KDIGO staging. Second, it argues against fake AI and presents deterministic guideline rules. Third, it closes with a “Run it on a real patient, right now” call to action. The information architecture is sound; the redesign should sharpen its sequencing rather than replace it.

### 1.2 Existing technical foundation

The repository is already configured for the requested technologies:

| Area | Current implementation | Consequence for the redesign |
|---|---|---|
| Framework | Next.js 15.5.23 with React 19 | Keep the existing app structure and server/client boundary. |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` | Build on the existing canvas instead of introducing a second renderer. |
| Motion | `animejs` 4.5.0 | Use official v4 APIs for scoped DOM choreography and numeric transitions. |
| Styling | Tailwind CSS 4 plus global CSS tokens | Extend the existing token system and avoid a visual framework migration. |
| Validation | TypeScript, Next build, lint, and a renal test script | Preserve these checks and add focused interaction checks if useful. |

The existing hero copy is server-rendered and visible without JavaScript. That is an important quality decision: a WebGL or motion failure must not remove the primary message. The existing hero statistics component also renders final values in HTML before replacing them with anime.js count-up values, which is the correct progressive-enhancement direction.

The main code-level issues to address are localized. The production compact trace string currently produces malformed text such as `GG3bAA2` because the stage values already contain their `G` and `A` prefixes. The shared header labels the home link as “Calculator,” even though the route is the marketing landing page. The shared `main` wrapper also imposes a constrained width that is appropriate for utility pages but limits the visual authority of a full-bleed landing hero. These are small changes with disproportionately high clarity value.

### 1.3 Current visual audit

The live hero currently presents a teal/green atmospheric canvas behind centered copy, with a readable headline, two CTAs, methodology badges, and three metric cards. The visual direction is calm and clinical rather than loud, which is appropriate. The current scene, however, reads more as an abstract flowing field than as a clearly legible kidney or computational model. A viewer can recognize that something is moving, but not immediately why that motion belongs to renal-function computation.

The first post-hero transition is a strong foundation: a small evidence eyebrow leads into three white cards, then the deterministic-guidance section. The visual weakness is that the canvas and those cards do not yet feel like parts of one system. The redesign should make the hero’s moving signals correspond to the cards below, so that the user understands the relationship between the scene and the outputs.

## 2. Comparative research: production Three.js and motion patterns

### 2.1 Official Three.js examples

The [official Three.js examples gallery](https://threejs.org/examples/) is the broadest reference for interaction vocabulary. Its value is not a single visual style, but the range of techniques it makes available: scene navigation, post-processing, geometry, particles, shaders, and interaction. For Nephro, the relevant lesson is to choose one interaction grammar and make it legible. Pointer response, subtle camera drift, and a small number of highlighted signals are enough; a gallery of unrelated effects would dilute the product thesis.

### 2.2 Bruno Simon

[Bruno Simon’s portfolio](https://bruno-simon.com/) is a benchmark for direct manipulation and immersive 3D. Its central design decision is that the user is invited to control a world rather than merely watch an animation. This is effective for a portfolio because the interaction itself is the content. It is not a model to copy literally for Nephro: a clinical calculator must communicate before it asks the user to explore. The transferable lesson is more modest and useful: use a visible pointer response and a clear “you can interact” affordance, but keep the core message and CTA independent of that interaction.

### 2.3 React Three Fiber showcase

The [React Three Fiber examples page](https://r3f.docs.pmnd.rs/getting-started/examples) includes examples for selection and tilt-shift, rounded cards, fisheye interaction, post-processing, annotations, portals, image galleries, reflections, and scroll/controls. The strongest relevant pattern is **annotation around a scene**. A medical visualization benefits from a few labels that point toward meaningful signals, but those labels should remain normal HTML content whenever possible so they are accessible, selectable, and readable without the canvas.

### 2.4 Awwwards Three.js collection

The [Awwwards Three.js collection](https://www.awwwards.com/websites/three-js/) is a useful visual pattern library. Its entries demonstrate that Three.js sites typically succeed when they have a strong focal composition, a controlled color system, and a clear relationship between the canvas and the editorial message. The collection also exposes a risk: visual novelty can become the dominant story. For Nephro, the visual goal should be a premium evidence interface, not a portfolio spectacle.

### 2.5 One Page Love Three.js collection

[One Page Love’s Three.js index](https://onepagelove.com/tech/three-js) catalogs 37 one-page examples across landing pages, digital products, apps, startups, portfolios, and experimental sites. Its filters make an important point: Three.js is a technology layer that can support many information architectures. The best reference category for Nephro is not “portfolio”; it is the intersection of **landing page**, **digital product**, **minimal**, **editorial**, and **scroll effects**. Nephro should use 3D to establish a signature and then return to scannable product sections.

### 2.6 Anidachi

[Anidachi](https://anidachi.com/) is a product-oriented visual site that uses a full-bleed hero, a short thesis, a waitlist CTA, and a long scroll narrative split into focused product capabilities such as “Shape-shifter,” “Travel-sized,” “He’s got games,” and “Independent.” Its strongest transferable pattern is **one scene, one job**. Every section introduces one reason to care and supports it with an image, animation, or short interaction. Nephro can adapt this as “Compute,” “Show the working,” “Stage the risk,” and “Act with context.”

### 2.7 Research synthesis

The repeated pattern across these references is not maximum complexity. It is coherence. The strongest sites use a distinctive visual layer to explain a product or establish a world, while preserving a normal page structure around it. Nephro should adopt the same discipline with a medical tone: a restrained canvas, meaningful signals, high-contrast copy, real HTML controls, and scroll sections that progressively explain the calculation journey.

| Reference | Primary strength | What Nephro should borrow | What Nephro should avoid |
|---|---|---|---|
| Three.js examples | Technique breadth | Selective pointer/camera/annotation patterns | Unrelated effect accumulation |
| Bruno Simon | Direct manipulation | Obvious but optional pointer response | Making exploration a prerequisite for understanding |
| R3F showcase | Modular scene interaction | Scene annotations and reusable components | Canvas-only labels and hidden semantics |
| Awwwards gallery | Visual focal composition | Strong art direction and restrained palette | Award-site spectacle disconnected from product value |
| One Page Love | One-page information architecture | Clear sections, category discipline, scannable flow | Treating “Three.js” as the whole design strategy |
| Anidachi | Product storytelling through sections | One section, one capability, one visual job | Long scroll without a clear narrative spine |

## 3. Official technical guidance

### 3.1 React Three Fiber performance

The official [React Three Fiber performance pitfalls guidance](https://r3f.docs.pmnd.rs/advanced/pitfalls) states that Three.js has a render loop unlike the DOM and recommends handling fast updates in `useFrame` through mutation and frame deltas rather than setting React state. It also recommends reusing geometries and materials, using instancing for repeated objects, avoiding unnecessary mount/unmount cycles, and fetching fast state directly rather than binding it reactively [5].

> “Fast updates are carried out in `useFrame` by mutation.” — React Three Fiber performance guidance [5]

The existing Nephro scene already follows much of this guidance. The implementation should preserve that architecture. The new orbital form should reuse its materials and geometries, keep pointer targets in refs, use `delta` for motion, and avoid storing a 60fps cursor position in React state. The canvas can remain `frameloop="demand"` when not visible, and the scene should remain disabled or simplified under reduced motion.

### 3.2 anime.js React lifecycle

The official [anime.js React guidance](https://animejs.com/documentation/getting-started/using-with-react/) recommends combining `useEffect()` with `createScope()` and calling `scope.current.revert()` when the component unmounts [8]. This is especially relevant in Next.js development mode, where remounts can expose duplicate timelines or stale DOM mutations.

The proposed choreography should therefore live in a small client component with a root ref and a scoped timeline. Its responsibilities should include the hero eyebrow, headline, supporting paragraph, CTA group, badges, and visible evidence values. The scene itself should remain in R3F. Cleanup should revert all DOM animations; reduced-motion mode should skip the timeline and leave the final values visible.

### 3.3 anime.js timeline composition

The official [anime.js timeline documentation](https://animejs.com/documentation/timeline/) provides `createTimeline()` for synchronizing animations, timers, callbacks, sync points, and labels [9]. It supports a concise narrative sequence: establish the eyebrow, reveal the message, settle the metrics, and then surface the action. The timeline should be short enough to feel like an entrance rather than a loading ritual, and it should not hold copy hidden while waiting for WebGL.

## 4. Recommended redesign direction

### 4.1 Visual thesis: Computation made visible

The hero should communicate three facts in under five seconds:

1. This is a renal-function calculator, not a generic AI demo.
2. The outputs are deterministic and citeable.
3. A clinician can open the calculator immediately.

The Three.js object should be a **kidney-inspired computational core** rather than a literal anatomical model. A low-poly or smoothly shaded paired-kidney silhouette can sit inside a thin orbital field. Three small orbiting markers can represent eGFR, KFRE, and KDIGO. The markers should use the same label names and values as the evidence cards below, creating one coherent visual language. The scene can remain abstract enough to avoid implying anatomical diagnostic imaging.

The dominant palette should stay in the existing dark teal family, with cyan/emerald accents and warm risk colors reserved for data states. The card surfaces should remain bright and clinical below the fold. The visual contrast between dark hero and pale evidence sections is already effective and should be strengthened, not discarded.

### 4.2 Narrative structure

| Section | User question | Recommended treatment |
|---|---|---|
| Hero | What is this and why should I trust it? | Kidney-inspired orbital computation scene, concise proof badges, primary CTA. |
| Computed evidence | What does it actually output? | Three cards linked visually to the hero markers; real sample values. |
| How it works | Is this a black box? | Four-step horizontal or stacked explainer: inputs → equations → staging → citeable result. |
| Deterministic guidance | What does the result mean operationally? | Keep the existing guidance panel, but make the rule trace visually clearer. |
| Final CTA | What should I do next? | “Run it on a real patient” with calculator and records actions. |

### 4.3 Copy recommendations

The current headline is strong and should remain. The supporting copy can become more compact so the scene and the value proposition share the first viewport. A suggested subhead is: “Published renal equations, shown step by step. CKD-EPI 2021 eGFR, KFRE risk, and KDIGO staging—without training data or black-box reports.” This retains the key proof points while reducing line length.

The badge row should be treated as proof, not decoration. It should use a consistent label format and avoid looking like a technology stack. The first badge can state “Published equations”; the others can name the three calculation families; the final badge can remain “No training data.”

The page should replace adversarial language such as “Most kidney ‘AI’ tools fake it” with a more clinically confident contrast when possible. The underlying argument is important, but “No black boxes. Every intermediate value visible.” is more durable and less dependent on attacking unnamed competitors.

### 4.4 Interaction design

The hero scene should respond to pointer movement with a low-amplitude parallax or orbital offset, not camera spinning. Hovering or focusing a marker can increase its emissive intensity and reveal a nearby DOM annotation. The pointer interaction must be optional; keyboard focus and visible text must expose the same concepts. On mobile, the scene should simplify to slow idle motion and keep the copy/CTA in a stable vertical stack.

The scene should not be draggable by default because the product is a calculator rather than an exploratory 3D world. If an exploratory mode is desired later, it can be introduced as a secondary “Explore the signals” affordance after the main CTA.

## 5. Technical implementation blueprint

### 5.1 Component boundaries

The existing `Hero`, `HeroContent`, `HeroStats`, and `KidneyScene` components are a reasonable starting point. The implementation should add or refine components along these boundaries:

| Component | Responsibility |
|---|---|
| `ComputationScene` | Own the kidney-inspired core, orbital ring, marker nodes, lights, and scene-level refs. |
| `SignalMarker` | Render one reusable marker with a stable semantic label and pointer/focus interaction. |
| `HeroChoreography` | Own the scoped anime.js timeline for DOM elements only. |
| `ComputationSteps` | Explain inputs, equations, staging, and result using normal HTML and existing `Reveal`. |
| `HeroStats` | Keep server-rendered final values and animate only when motion is allowed. |

### 5.2 Render-loop rules

The R3F loop should mutate object transforms and material uniforms using refs. Cursor values should be stored in refs, interpolated with `THREE.MathUtils.lerp`, and applied using `delta`. No `setState` should run from `useFrame`. Static geometry and materials should be memoized or declared once. The scene should avoid unnecessary post-processing until the base composition is proven on low-powered devices.

A practical quality ladder is recommended. On desktop, use the full orbital scene with a moderate device pixel ratio cap. On mobile or when `prefers-reduced-motion` is set, reduce particle/marker counts, avoid high-cost effects, and keep the object’s motion slow. If WebGL is unavailable, the HTML hero should still provide the full message, badges, metrics, and CTA, with a CSS gradient or static poster-like background.

### 5.3 anime.js rules

Use anime.js only for DOM choreography and numeric value interpolation. Create a scoped timeline once in `useEffect`, register it against a root ref, and revert it during cleanup. Keep the server-rendered final values in the DOM. When motion is allowed, animate an internal numeric object from zero or a near-final value and update text content through `onUpdate`; when reduced motion is requested, skip the animation and leave the final values in place.

The existing `HeroStats` implementation is close to this pattern. It should be refined so cleanup uses the documented scope strategy where appropriate, and so animation cancellation does not leave the count-up stuck at an intermediate value during route changes.

### 5.4 Layout and page-shell changes

The landing route should be allowed to use a wider or full-bleed hero while utility routes retain the constrained `max-w-5xl` shell. This can be accomplished through a route-level wrapper or a page-shell variant rather than by weakening every route. The shared nav should label the home route as “Overview” or “Home,” with “Calculator” reserved for `/calculator`.

The hero should use a two-column composition at wide desktop widths: copy and CTAs on the left, scene on the right, with the scene still occupying enough space to feel intentional. At tablet and mobile widths, it should collapse to a centered or copy-first stack. The first CTA should remain visible without requiring scene interaction or scroll.

### 5.5 Data integrity fixes included with the visual work

The compact trace string should be corrected so it renders `G3b A2` rather than `GG3bAA2`. The fix should use the existing stage values as-is or strip prefixes before adding them, but not both. The landing-page sample values should remain derived from the same deterministic calculation functions used by the calculator rather than duplicated constants wherever practical. The copy should make it clear that the hero numbers are a demonstration patient, not a user’s actual result.

## 6. Accessibility, trust, and resilience requirements

A medical calculation landing page must be understandable without WebGL, animation, or pointer input. All important values and claims must be in the DOM. Canvas content should have an adjacent accessible description or be marked decorative when the surrounding HTML already communicates the same facts. Focus states must remain visible on dark surfaces. CTA labels should describe destinations, and the methods link should remain available without waiting for the scene.

The reduced-motion experience should remove or substantially simplify parallax, orbit movement, count-up effects, and reveal choreography. The final values should appear immediately. The page should be tested at narrow widths, with keyboard-only navigation, with JavaScript disabled where possible, and with WebGL unavailable or blocked.

The clinical disclaimer should remain prominent enough to be noticed without overwhelming the primary action. The design should avoid visual metaphors that imply diagnosis, imaging certainty, or an AI-generated report. The kidney-inspired object is a visualization of computation, not a patient scan.

## 7. Implementation sequence

The safest sequence is:

1. Refine the page shell and hero layout without changing the scene, then verify that copy and CTAs remain stable.
2. Replace or extend the abstract hero object with the computation-core scene and three signal markers.
3. Connect the marker labels to the existing evidence-card vocabulary.
4. Add the scoped anime.js hero timeline and refine the existing count-up behavior.
5. Add the four-step computation explainer using the existing reveal primitive.
6. Correct the compact trace string and header navigation label.
7. Run typecheck, tests, lint/build checks, and responsive visual review.

This order isolates layout risk from WebGL risk and allows the site to remain functional after each step.

## 8. Acceptance criteria

| Area | Acceptance condition |
|---|---|
| Product clarity | A first-time visitor can identify the calculator, its trust claim, and the primary action from the first viewport. |
| Three.js | The hero contains an actual R3F scene with a meaningful computational object, pointer response, and no React state updates in the render loop. |
| anime.js | DOM entrance and numeric transitions use anime.js v4 with cleanup and reduced-motion handling. |
| Accessibility | Copy, values, CTAs, and explanatory labels remain available without WebGL or animation. |
| Responsive design | The hero and evidence sections remain readable at mobile, tablet, and desktop widths. |
| Performance | Geometry/material reuse, capped pixel ratio, visibility-aware rendering, and simplified fallback behavior are preserved. |
| Data integrity | The compact stage trace is formatted correctly and the hero sample values remain consistent with the calculator logic. |
| Trust | The methods link and disclaimer remain easy to find, and no visual treatment implies diagnosis or black-box inference. |

## References

[1]: https://github.com/vossgraves/Nephro "vossgraves/Nephro — GitHub repository"
[2]: https://nephro-delta.vercel.app/ "Nephro — Renal Function Calculator"
[3]: https://threejs.org/examples/ "Three.js official examples"
[4]: https://bruno-simon.com/ "Bruno Simon interactive portfolio"
[5]: https://r3f.docs.pmnd.rs/advanced/pitfalls "React Three Fiber — Performance pitfalls"
[6]: https://r3f.docs.pmnd.rs/getting-started/examples "React Three Fiber — Examples and showcase"
[7]: https://www.awwwards.com/websites/three-js/ "Awwwards — Best Three.js websites"
[8]: https://animejs.com/documentation/getting-started/using-with-react/ "Anime.js — Using with React"
[9]: https://animejs.com/documentation/timeline/ "Anime.js — Timeline"
[10]: https://onepagelove.com/tech/three-js "One Page Love — Three.js one-page website examples"
[11]: https://anidachi.com/ "Anidachi — product landing page"
