# Validation notes

## First local pass

The local page rendered at `http://localhost:3000/` with all landing-page copy, links, evidence cards, computation-flow cards, trace, and footer disclaimer present. The production build and TypeScript checker passed before this visual pass. The browser console reported only the Three.js deprecation warning for `THREE.Clock`; no React or WebGL runtime error appeared.

The first screenshot exposed a data-integrity issue: the animated hero stats were hard-coded to `55.1`, `3.4`, and `71`, while the same example patient’s deterministic cards render `43.6`, `0.9% / 3.3%`, and G3b/A2. The hero stats must be passed from the same calculation values before delivery. The scene is subtle against the dark hero at the current screenshot scale, so contrast/visibility will be checked again after the data fix.

## Second local pass

After the data fix, the hero now renders the same values as the evidence cards: eGFR `43.6`, 2-year KFRE `0.9`, and KDIGO `G3b A2`. The Three.js scene is visibly active: a teal kidney-inspired computational core, two orbit rings, particles, and signal nodes appear behind the hero copy. The lower-page scroll check confirmed the new three-output evidence narrative, four-step computation flow, deterministic guidance panel, corrected `G3b A2` trace, and final CTA are present.

The hero scene is intentionally atmospheric and large on desktop; it remains subordinate to the HTML copy because the copy layer is opaque enough to stay legible. The lower sections use normal HTML cards and links, not canvas-only content.
