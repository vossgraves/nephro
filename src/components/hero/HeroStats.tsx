"use client";

import { animate, utils } from "animejs";
import { useEffect, useRef } from "react";

/** Values shown in the hero — the real output of the example patient on /. */
const STATS = [
  { label: "eGFR", unit: "mL/min/1.73m²", to: 55.1, digits: 1 },
  { label: "2-yr KFRE", unit: "%", to: 3.4, digits: 1 },
  { label: "CrCl (CG)", unit: "mL/min", to: 71, digits: 0 },
] as const;

/**
 * anime.js earns its place here: interruptible, retargetable value interpolation.
 * The final numbers are rendered server-side, so they are correct with JS off;
 * the count-up only replaces them when it can actually run.
 */
export function HeroStats() {
  const root = useRef<HTMLDListElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-to]"));
    if (nodes.length === 0) return;

    let cancelled = false;
    // Start from zero only once we know we will animate, to avoid a flash of 0.
    utils.set(nodes, { opacity: 1 });
    for (const node of nodes) node.textContent = "0";

    const animations = nodes.map((node, i) => {
      const to = Number(node.dataset.to);
      const digits = Number(node.dataset.digits ?? 0);
      const obj = { n: 0 };
      return animate(obj, {
        n: to,
        duration: 1100,
        delay: 420 + i * 120,
        ease: "out(3)",
        onUpdate: () => {
          if (!cancelled) node.textContent = obj.n.toFixed(digits);
        },
        onComplete: () => {
          if (!cancelled) node.textContent = to.toFixed(digits);
        },
      });
    });

    return () => {
      cancelled = true;
      for (const a of animations) a.pause();
    };
  }, []);

  return (
    <dl ref={root} className="mx-auto mt-10 grid w-full max-w-md grid-cols-3 gap-3 text-center sm:gap-4">
      {STATS.map(({ label, unit, to, digits }) => (
        <div
          key={label}
          className="hero-pop min-w-0 rounded-[var(--radius-base)] border border-white/10 bg-white/5 px-2 py-4 backdrop-blur-sm sm:px-3"
        >
          <dd className="text-lg font-semibold tabular-nums text-white sm:text-xl">
            <span data-to={to} data-digits={digits}>
              {to.toFixed(digits)}
            </span>
          </dd>
          <dt className="mt-1 truncate text-[10px] uppercase tracking-wider text-white/45 sm:text-[11px]">
            {label}
            <span className="sr-only"> in {unit}</span>
          </dt>
          <p className="mt-0.5 text-[10px] text-white/35" aria-hidden="true">
            {unit}
          </p>
        </div>
      ))}
    </dl>
  );
}
