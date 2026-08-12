# Background video redesign audit

## Current baseline

The current Nephro landing page is stable after clearing a stale local `.next` development cache. The warm local page renders the existing Three.js hero with a large teal kidney-inspired form, orbit lines, particle detail, left-aligned copy, a compact metric row, and a clear `Open the calculator` CTA. The page continues into deterministic output cards, the computation-flow narrative, guidance, and the final calculator action.

The current hero is visually strong but still communicates primarily as an abstract WebGL object. The user’s requested replacement should make the visual story explicit: a monochrome animated kidney on black, a clinician working with a tablet, a camera move into the tablet, and a final tablet/UI state that resolves into the calculator action.

## Responsive direction

Desktop should use a wide cinematic 16:9 or 21:9 composition with the kidney and clinician/tablet actions staged in the right two-thirds, while the copy remains in a dark text-safe area on the left. The camera move into the tablet should be readable at desktop scale and land on a final high-contrast tablet frame behind or adjacent to the CTA.

Mobile should use a separate portrait 9:16 crop or composition rather than relying on a desktop crop. The kidney should occupy the upper-middle frame, the tablet and clinician hand should enter from the lower third, and the text/CTA should remain in normal HTML below or above the video so video cropping never removes the action. The video must be muted, autoplay-capable, loop-safe, and paired with a poster/fallback frame. Reduced-motion users should receive a static monochrome poster and the same HTML action.

## Implementation constraints

The current project has no `public/` directory, so the redesign will need to add one for video/poster assets. The project already uses Next.js, React, React Three Fiber, Three.js, and anime.js. The existing Three.js scene can remain as a progressive fallback or be removed from the main hero to avoid competing motion, depending on the generated video’s quality and file size. The most resilient architecture is a `<video>` background with a poster/fallback layer, a desktop source, an optional mobile source, and an HTML overlay that remains the source of truth for the calculator CTA.
