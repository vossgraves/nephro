# UI remake plan — awwwards-inspired Three.js landing + chrome refresh

Directive (user): remake the UI with Three.js, inspired by awwwards Three.js examples.
Hard constraints (master prompt): ORIGINAL design (not the friend's UI, not a template),
medical-safe copy, performance tiers, reduced-motion + WebGL fallback, keep all verified
functionality intact. Our identity stays light/clinical — awards-level through craft.

## Design language (original)
"Clinical editorial": warm paper background (#fbfbfa family kept), ink text, terracotta
accent (AA-passing tokens already set), huge display headings (Caprasimo or keep Geist —
decide: keep Geist variable already loaded, add display sizing via clamp()), hairline rules,
generous whitespace, mono micro-labels. 3D is the hero medium, not decoration.

## Landing page remake (worker: landing-3d)
1. **Full-viewport WebGL hero**: the existing KidneyScene becomes the full-bleed backdrop
   (fixed canvas, content overlaid). Kidney shader core + particle field + orbit system stay;
   add scroll-driven camera choreography: scroll progress pushes the camera through the
   particle field and orbits the kidney (damped, eased), sections crossfade over it.
2. **Scroll choreography**: hero → signals section (camera dollies, kidney recedes) →
   process section (camera settles, particles form a loose grid) → CTA (kidney returns
   centered, slow idle). Implement with a scroll progress ref (IntersectionObserver on
   sections + lerp in useFrame). NO pinning libraries; pure R3F + IO.
3. **Typography**: display scale (clamp 40–88px), tight tracking, eyebrow mono labels.
   Content sections become editorial blocks over the canvas with backdrop-blur cards only
   where text crosses busy 3D regions.
4. **Interactions**: keep pointer-repel ripple; add subtle parallax on pointer move.
5. **Perf tiers/fallback/reduced-motion**: existing perf-tier.ts drives particle count/dpr;
   reduced motion = static composed frame, no scroll choreography (content flows normally);
   WebGL failure = poster fallback already built.
6. **Keep**: the computed demo-patient stats (HeroStats), the "not a black box" story beats,
   footer disclaimer, nav.

## Chrome refresh (worker: chrome)
- SiteNav: keep behavior (edge fade, aria-current); restyle to match (hairline underline on
  active route, mono micro-labels optional).
- layout.tsx header/footer: lighter, blur already present; add a slim "AI-assisted, not a
  diagnosis" status line in footer (already there — keep wording).
- globals.css: display-type utility classes, section spacing scale, hairline utilities.
  Additive only; do not break existing classes.

## Inner pages skin (worker: chrome, LIGHT touch)
- Page headers get the editorial treatment (eyebrow + display H1 + rule) on /calculator,
  /records, /methods, /tools. Cards keep structure; restyle headings/kickers only.
- DO NOT touch: calculator logic/inputs, imaging workspace internals (any of
  ImagingWorkspace), records table logic, server actions.

## Verification (all)
- typecheck + lint + tests + build green.
- Browser re-run of key checklist items on the new build (landing visuals, nav, imaging
  regression smoke, axe on changed pages, reduced-motion, mobile 390px).

## Explicitly out of scope
- No dark-mode clone of awwwards sites; no copied layouts/assets from any showcased site.
- No new npm deps without integrator approval.
- No changes to API routes, lib logic, or the imaging workspace internals.
