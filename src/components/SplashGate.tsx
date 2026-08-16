"use client";

import { useEffect, useState } from "react";
import { KidneyLoader } from "@/components/KidneyLoader";

const SPLASH_KEY = "nephro-splash-seen";

/**
 * First-visit brand moment: the kidney fills once, then the interface fades in.
 * Shown at most once per browser session, skipped for reduced-motion users,
 * and never blocks content for more than ~1.6s.
 */
export default function SplashGate() {
  const [phase, setPhase] = useState<"hidden" | "shown" | "exiting">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem(SPLASH_KEY)) return;

    setPhase("shown");

    let done = false;
    const dismiss = () => {
      if (done) return;
      done = true;
      setPhase("exiting");
      window.setTimeout(() => {
        sessionStorage.setItem(SPLASH_KEY, "1");
        setPhase("hidden");
      }, 460);
    };

    const minimum = window.setTimeout(dismiss, 1200);
    const maximum = window.setTimeout(dismiss, 1900);

    let cancelled = false;
    if (document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) window.setTimeout(dismiss, 250);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      window.clearTimeout(minimum);
      window.clearTimeout(maximum);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={`splash-overlay no-print fixed inset-0 z-[100] flex flex-col items-center justify-center ${
        phase === "exiting" ? "splash-exit" : ""
      }`}
      style={{
        background:
          "radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--accent) 14%, var(--bg)), var(--bg) 62%)",
      }}
      aria-hidden="true"
    >
      <KidneyLoader size={148} label="Nephro" />
      <p
        className="mt-6 text-center text-sm text-muted"
        style={{ color: "var(--muted)", maxWidth: "20rem" }}
      >
        Kidney numbers, made clear.
      </p>
      <p
        className="mt-10 font-mono text-[10px] tracking-[0.22em] uppercase"
        style={{ color: "var(--muted)", opacity: 0.7 }}
      >
        Preparing the lab
      </p>
    </div>
  );
}
