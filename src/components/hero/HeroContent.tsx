import Link from "next/link";
import { HeroStats } from "@/components/hero/HeroStats";

const BADGES = ["CKD-EPI 2021", "KFRE (Tangri)", "KDIGO 2024", "Cockcroft–Gault", "No training data"];

/**
 * Server-rendered hero copy. The entrance is CSS (see globals.css) so the text is
 * readable on first paint and without JS; `--i` sets each element's stagger index.
 */
export default function HeroContent() {
  return (
    <div className="hero-ready relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center">
      <div className="hero-reveal" style={{ "--i": 0 } as React.CSSProperties}>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Published equations · Deterministic · Citeable
        </span>
      </div>

      <h1
        className="hero-reveal mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        Kidney numbers,
        <br />
        <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
          computed honestly.
        </span>
      </h1>

      <p
        className="hero-reveal mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        The calculators every nephrology guideline actually trusts — CKD-EPI 2021 eGFR, the
        Kidney Failure Risk Equation, and KDIGO staging. Real math, real citations, zero training
        data, zero black boxes.
      </p>

      <div
        className="hero-reveal mt-9 flex flex-wrap items-center justify-center gap-3"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <Link
          href="/calculator"
          className="rounded-[var(--radius-base)] bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.97]"
        >
          Open the calculator
        </Link>
        <Link
          href="/methods"
          className="rounded-[var(--radius-base)] border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-150 ease-out hover:bg-white/10 active:scale-[0.97]"
        >
          See the methods
        </Link>
      </div>

      <div className="mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2">
        {BADGES.map((b, i) => (
          <span
            key={b}
            className="hero-pop rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/55 backdrop-blur-sm"
            style={{ "--i": i } as React.CSSProperties}
          >
            {b}
          </span>
        ))}
      </div>

      <HeroStats />
    </div>
  );
}
