# Nephro light video redesign

## Summary

Nephro’s landing page now uses a **bright clinical visual system** rather than the previous dark teal hero. The hero is built around a generated kidney-to-tablet sequence: a luminous kidney signal, clinician tablet interaction, and a camera-directed move toward an abstract calculator screen. All important copy, metrics, and actions remain ordinary server-rendered HTML.

The main desktop asset is `public/media/nephro-kidney-tablet-desktop.mp4`, an 8-second H.264 1280×720 video with muted playback, looping, and a bright 16:9 poster. The portrait poster is `public/media/nephro-kidney-tablet-mobile-poster.png`. The free-plan daily video quota prevented a second portrait video from being generated, so the implementation deliberately uses the portrait composition as the mobile visual fallback while desktop receives motion.

## Responsive behavior

| Surface | Visual treatment | Layout behavior | Fallback |
| --- | --- | --- | --- |
| Desktop | Desktop MP4 with the 16:9 bright clinical poster | Left text-safe field, right kidney/clinician/tablet composition, readable metrics and CTA | Desktop poster on reduced motion, data saver, slow connection, or media error |
| Mobile | Dedicated 9:16 portrait poster | Upper text-safe area, portrait kidney, lower clinician hand/tablet, wrapped badges and three equal metric cards | Same poster; HTML remains the primary action layer |
| Reduced motion | Static poster | No decorative video playback | All copy and calculator links remain available |

## Code changes

`HeroVideo.tsx` owns progressive enhancement. It checks reduced-motion and connection preferences on the client, displays the portrait source below the desktop breakpoint, and only starts the desktop video when motion and network conditions permit. `Hero.tsx` now supplies a light gradient veil and faint grid instead of the former dark WebGL treatment. `HeroContent.tsx` and `HeroStats.tsx` use white/gray surfaces and charcoal text to match the requested light style. `globals.css` forces the intended light color scheme and updates the design tokens. `layout.tsx` aligns the browser theme color and responsive header with the new page. The final landing-page CTA now reads `Open calculator`.

## Validation

TypeScript and the Next.js production build passed. `git diff --check` passed. A desktop browser pass confirmed video/poster composition, readable metrics, and the evidence transition. A 390×844 mobile capture confirmed the portrait poster, wrapping, CTA visibility, equal metric cards, and no navigation overflow. The detailed observations are stored in `research/validation-light.md`.

## Asset limitation

The desktop video was generated successfully. A second portrait video request returned the free-plan limit message `1/1`; no unsupported or fake mobile video was substituted. The site uses the generated portrait poster and keeps the mobile structure independent so a portrait MP4 can be added later without changing the layout contract.
