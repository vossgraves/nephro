"use client";

import { animate, createTimeline, stagger, utils } from "animejs";
import Link from "next/link";
import { useEffect, useRef } from "react";

const BADGES = ["CKD-EPI 2021", "KFRE (Tangri)", "KDIGO 2024", "Cockcroft–Gault", "No training data"];

function LiveExample() {
  const egfr = useRef<HTMLSpanElement>(null);
  const risk = useRef<HTMLSpanElement>(null);
  const cc = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = (el: HTMLSpanElement | null, to: number, digits: number, delay: number) => {
      if (!el) return;
      if (reduced) {
        el.textContent = to.toFixed(digits);
        return;
      }
      let cancelled = false;
      const o = { n: 0 };
      animate(o, {
        n: to,
        duration: 1300,
        delay,
        ease: "outExpo",
        onUpdate: () => {
          if (!cancelled) el.textContent = o.n.toFixed(digits);
        },
      });
      return () => {
        cancelled = true;
      };
    };
    const cleanup = [count(egfr.current, 55.1, 1, 0), count(risk.current, 3.4, 1, 300), count(cc.current, 71, 0, 600)];
    return () => {
      cleanup.forEach((fn) => fn?.());
    };
  }, []);

  return (
    <dl className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
      {[
        ["eGFR", "mL/min/1.73m²", egfr],
        ["2-yr KFRE", "%", risk],
        ["CrCl (CG)", "mL/min", cc],
      ].map(([label, unit, ref]) => (
        <div
          key={label as string}
          className="rounded-[var(--radius-base)] border border-white/10 bg-white/5 px-3 py-4 backdrop-blur-sm"
        >
          <dd className="text-xl font-semibold tabular-nums text-white">
            <span ref={ref as React.RefObject<HTMLSpanElement>}>0</span>
            <span className="ml-0.5 text-xs font-normal text-white/50">{unit as string}</span>
          </dd>
          <dt className="mt-1 text-[11px] uppercase tracking-wider text-white/45">
            {label as string}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export default function HeroContent() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      utils.set(".hero-line, .hero-fade, .hero-badge", { opacity: 1, translateY: 0, scale: 1 });
      return;
    }
    const t = createTimeline({ delay: 150 });
    t.add(
      ".hero-line",
      {
        translateY: [40, 0],
        opacity: [0, 1],
        filter: ["blur(6px)", "blur(0px)"],
        duration: 900,
        ease: "out(3)",
        delay: stagger(110),
      },
    );
    t.add(
      ".hero-fade",
      {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 800,
        ease: "outCubic",
        delay: stagger(100),
      },
      "-=550",
    );
    t.add(
      ".hero-badge",
      {
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 500,
        ease: "outBack",
        delay: stagger(70, { from: "center" }),
      },
      "-=550",
    );
    return () => {
      t.pause();
    };
  }, []);

  return (
    <div
      ref={root}
      className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="hero-line opacity-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Published equations · Deterministic · Citeable
        </span>
      </div>

      <h1 className="hero-line mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white opacity-0 sm:text-6xl">
        Kidney numbers,
        <br />
        <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
          computed honestly.
        </span>
      </h1>

      <p className="hero-fade mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/65 opacity-0 sm:text-lg">
        The calculators every nephrology guideline actually trusts — CKD-EPI 2021 eGFR, the
        Kidney Failure Risk Equation, and KDIGO staging. Real math, real citations, zero training
        data, zero black boxes.
      </p>

      <div className="hero-fade mt-9 flex flex-wrap items-center justify-center gap-3 opacity-0">
        <Link
          href="/calculator"
          className="rounded-[var(--radius-base)] bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Open the calculator
        </Link>
        <Link
          href="/methods"
          className="rounded-[var(--radius-base)] border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          See the methods
        </Link>
      </div>

      <div className="hero-badge mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2 opacity-0">
        {BADGES.map((b) => (
          <span
            key={b}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/55 backdrop-blur-sm"
          >
            {b}
          </span>
        ))}
      </div>

      <LiveExample />
    </div>
  );
}
