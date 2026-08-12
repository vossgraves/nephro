
## Desktop light-theme pass

The local desktop page renders the bright clinical poster/video composition with the kidney and clinician tablet staged to the right, while the left text-safe field keeps the headline, buttons, badges, and metrics readable. After the animation settles, the hero metrics show the deterministic values 43.6, 0.9, and G3b A2, matching the evidence cards below. The video poster and motion field preserve the white site theme and the primary action reads `Open calculator`. The first viewport transitions into the evidence section without a dark band or visual collision.

The desktop video was confirmed as an 8-second H.264 1280×720 asset and the generated posters are available in 16:9 and 9:16 formats. A dedicated mobile video could not be generated because the free-plan daily video quota was reached, so mobile is intentionally wired to the portrait poster fallback while desktop receives motion.

## Mobile light-theme pass

A 390×844 capture confirms the dedicated 9:16 poster is used on mobile rather than cropping the desktop video. The upper copy remains readable against the pale background, the CTA pair stays on one line at this width, badges wrap without overflow, and the three metric cards retain equal widths with the final `G3b A2` value visible. The clinician hand and tablet remain visible in the lower frame as the page continues below the viewport. Navigation fits in the narrow header without horizontal overflow.

The mobile experience therefore uses motion-aware HTML and a portrait poster fallback: it is fast, stable, accessible, and visually distinct from desktop even though a separate mobile video could not be generated within the current daily quota.
