"use client";

import { useEffect, useState } from "react";

/**
 * The video is decorative; copy, controls, and calculator access remain normal HTML.
 * Desktop receives motion when it is permitted, while mobile deliberately uses its own
 * portrait composition until a dedicated motion asset is available.
 */
export default function HeroVideo() {
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const constrainedConnection =
      connection.connection?.saveData || connection.connection?.effectiveType === "2g";

    setMotionEnabled(!prefersReducedMotion && !constrainedConnection);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <picture className={`absolute inset-0 ${motionEnabled ? "md:hidden" : ""}`}>
        <source media="(max-width: 767px)" srcSet="/media/nephro-kidney-tablet-mobile-poster.png" />
        <img
          src="/media/nephro-kidney-tablet-desktop-poster.png"
          alt=""
          className="h-full w-full object-cover object-[62%_center] md:object-center"
        />
      </picture>

      {motionEnabled ? (
        <video
          className="absolute inset-0 hidden h-full w-full object-cover object-center md:block"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/nephro-kidney-tablet-desktop-poster.png"
          onError={() => setMotionEnabled(false)}
        >
          <source src="/media/nephro-kidney-tablet-desktop.mp4" type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
