"use client";

import HeroScene from "@/components/hero/HeroScene";
import { useScrollChoreography } from "@/components/hero/scroll-choreography";

/**
 * Full-bleed, fixed WebGL backdrop for the landing page. The page content sits
 * above it in the normal flow; this component also runs the scroll
 * choreography hook that watches the landing sections (by `data-choreo`
 * attribute) and drives the shared progress bus the canvas reads each frame.
 */
export default function LandingBackdrop() {
  useScrollChoreography();

  return (
    <>
      <HeroScene className="pointer-events-none fixed inset-0 z-0" />
      {/* Readability veil: keeps text contrast over the 3D field. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(90deg, rgba(251,251,250,0.94) 0%, rgba(251,251,250,0.78) 38%, rgba(251,251,250,0.35) 62%, rgba(251,251,250,0.55) 100%)",
        }}
      />
    </>
  );
}