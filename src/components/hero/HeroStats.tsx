"use client";

import { animate, createScope, utils } from "animejs";
import { useEffect, useRef } from "react";

export type HeroStat = {
  label: string;
  unit: string;
  value: number | null;
  display?: string;
  digits?: number;
};

/**
 * Final values are present in the HTML before JavaScript runs. When motion is permitted,
 * anime.js scopes the short numeric entrance to this component and reverts it on unmount.
 */
export function HeroStats({ stats }: { stats: readonly HeroStat[] }) {
  const root = useRef<HTMLDListElement>(null);
  const scope = useRef<ReturnType<typeof createScope> | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nodes = Array.from(element.querySelectorAll<HTMLElement>("[data-to]"));
    if (nodes.length === 0) return;

    scope.current = createScope({ root }).add(() => {
      utils.set(nodes, { opacity: 1 });
      for (const node of nodes) node.textContent = "0";

      nodes.forEach((node, index) => {
        const to = Number(node.dataset.to);
        const digits = Number(node.dataset.digits ?? 0);
        const value = { n: 0 };

        animate(value, {
          n: to,
          duration: 1050,
          delay: 440 + index * 120,
          ease: "out(3)",
          onUpdate: () => {
            node.textContent = value.n.toFixed(digits);
          },
          onComplete: () => {
            node.textContent = to.toFixed(digits);
          },
        });
      });
    });

    return () => {
      scope.current?.revert();
      scope.current = null;
    };
  }, []);

  return (
    <dl ref={root} className="mx-auto mt-10 grid w-full max-w-md grid-cols-3 gap-3 text-center lg:mx-0 sm:gap-4">
      {stats.map((stat) => {
        const numeric = typeof stat.value === "number";
        const digits = stat.digits ?? 1;
        const formatted = numeric ? stat.value!.toFixed(digits) : stat.display;

        return (
          <div
            key={stat.label}
            className="hero-pop min-w-0 rounded-[var(--radius-base)] border border-slate-200 bg-white/80 px-2 py-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:px-3"
          >
            <dd className="text-lg font-semibold tabular-nums text-slate-950 sm:text-xl">
              {numeric ? (
                <span data-to={stat.value} data-digits={digits}>
                  {formatted}
                </span>
              ) : (
                formatted
              )}
            </dd>
            <dt className="mt-1 truncate text-[10px] uppercase tracking-wider text-slate-500 sm:text-[11px]">
              {stat.label}
              <span className="sr-only"> in {stat.unit}</span>
            </dt>
            <p className="mt-0.5 text-[10px] text-slate-400" aria-hidden="true">
              {stat.unit}
            </p>
          </div>
        );
      })}
    </dl>
  );
}
