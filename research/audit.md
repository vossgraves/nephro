# Nephro landing-page audit

## Repository

- Repository cloned locally from `vossgraves/nephro`.
- Stack: Next.js 15.5.23, React 19.1, TypeScript, Tailwind CSS v4, `three` 0.185.1, `@react-three/fiber` 9.7.0, `@react-three/drei` 10.7.8, and `animejs` 4.5.0.
- Existing homepage is `src/app/page.tsx`; hero composition is split across `src/components/hero/Hero.tsx`, `HeroContent.tsx`, `HeroStats.tsx`, and `KidneyScene.tsx`.
- The repository already contains a real React Three Fiber implementation: a shader-driven kidney-like blob, a particle field, pointer-following rotation, an IntersectionObserver pause mechanism, and `prefers-reduced-motion` handling.
- Existing homepage narrative is strong on clinical integrity: deterministic published equations, cited methods, explicit anti-black-box language, and direct CTAs to calculator, records, and methods.
- Existing dependencies already include the requested Three.js and anime.js packages; the primary opportunity is refinement, not introducing a new rendering stack.

## Live page observations

- Deployed URL: https://nephro-delta.vercel.app/
- Page title: `Renal Function Calculator | Validated CKD Assessment`.
- Top navigation is minimal: Renal Function, Calculator, Records, Methods.
- Hero headline: `Kidney numbers, computed honestly.` with supporting copy about CKD-EPI 2021, KFRE, KDIGO staging, real math, citations, and no training data.
- Hero includes two CTAs: `Open the calculator` and `See the methods`.
- Hero also shows small methodology badges and three compact metrics for eGFR, 2-year KFRE, and Cockcroft–Gault.
- Below the hero, three cards explain CKD-EPI 2021 eGFR, KFRE risk, and KDIGO staging with computed values.
- The next section contrasts deterministic equations with fake AI and shows generated guidance rules.
- Final CTA invites users to run a real patient assessment and view records.
- The live page's visual design is dark, restrained, teal/green, clinical, and typography-led. The hero canvas is present behind the copy, but the 3D scene is visually subtle at the inspected viewport.
- The live extracted content contains a malformed string in the compact trace line: `G{g}A{a}` appears as `GG3bAA2`; this should be corrected during implementation.
- GitHub's public page returned a 404 for the user-provided casing, while the selected GitHub connector repository cloned successfully as `vossgraves/nephro`.

## Initial improvement hypothesis

Keep the clinically credible positioning and existing shader work. Improve the landing page by making the kidney visualization more legible and intentional, adding a clear visual system for `computed`, `cited`, and `reproducible`, using anime.js for restrained entrance and number transitions, strengthening responsive behavior, and ensuring the hero motion is meaningful without harming accessibility or performance.

## Current production re-check

The current deployed hero now shows the Three.js scene as a visible teal/green field with flowing light-like edges behind the copy, making the canvas more legible than the earlier inspection. The DOM hero remains readable and the two primary CTAs are visible. The first transition below the hero is clean: a computed-evidence eyebrow leads to three white cards for CKD-EPI 2021 eGFR, KFRE risk, and KDIGO staging, followed by the deterministic guidance section.

The strongest remaining opportunity is not adding more visual spectacle; it is giving the existing motion a clearer semantic role. The hero scene currently reads as an atmospheric field rather than an obvious kidney or computation model. The redesign blueprint should therefore introduce a restrained orbital/annotation grammar or a more legible organ silhouette while preserving the existing static first paint. The compact trace line still renders malformed `GG3bAA2`, so the blueprint includes a data-label correction alongside visual work.
