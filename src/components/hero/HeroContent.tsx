import Link from "next/link";
import { HeroStats, type HeroStat } from "@/components/hero/HeroStats";

const BADGES = ["Published equations", "CKD-EPI 2021", "KFRE (Tangri)", "KDIGO 2024"];

const SIGNALS = ["eGFR", "KFRE risk", "KDIGO stage"] as const;

/**
 * Copy and actions remain available before media loads. The background is decoration;
 * this semantic HTML is the accessible product narrative and primary path to calculation.
 */
export default function HeroContent({ stats }: { stats: readonly HeroStat[] }) {
  return (
    <div className="hero-ready relative z-10 mx-auto flex min-h-[720px] max-w-6xl flex-col items-center justify-start px-6 pb-64 pt-16 text-center sm:min-h-[760px] sm:pt-20 lg:min-h-[760px] lg:items-start lg:justify-center lg:px-10 lg:py-24 lg:text-left xl:px-2">
      <div className="max-w-xl">
        <div className="hero-reveal" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white/70 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-950/5 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-slate-900" aria-hidden="true" />
            Published equations · Deterministic · Citeable
          </span>
        </div>

        <h1
          className="hero-reveal mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.045em] text-slate-950 sm:text-6xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Kidney numbers,
          <br />
          <span className="text-slate-500">made clear.</span>
        </h1>

        <p
          className="hero-reveal mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Published renal equations, visible step by step. CKD-EPI 2021 eGFR, Kidney Failure Risk
          Equation, and KDIGO staging — without training data or black-box reports.
        </p>

        <div
          className="hero-reveal mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <Link
            href="/calculator"
            className="rounded-[var(--radius-base)] bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-transform duration-150 ease-out hover:scale-[1.02] hover:bg-slate-800 active:scale-[0.97]"
          >
            Open calculator
          </Link>
          <Link
            href="/methods"
            className="rounded-[var(--radius-base)] border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-950/5 backdrop-blur-sm transition-colors duration-150 ease-out hover:bg-white active:scale-[0.97]"
          >
            See the methods
          </Link>
        </div>

        <div className="mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2 lg:justify-start">
          {BADGES.map((badge, index) => (
            <span
              key={badge}
              className="hero-pop rounded-full border border-slate-200 bg-white/65 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm shadow-slate-950/[0.03] backdrop-blur-sm"
              style={{ "--i": index } as React.CSSProperties}
            >
              {badge}
            </span>
          ))}
        </div>

        <HeroStats stats={stats} />

        <div
          className="hero-reveal mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 lg:justify-start"
          style={{ "--i": 4 } as React.CSSProperties}
          aria-label="Three live calculation signals represented in the visualization"
        >
          <span className="text-slate-400">Live signals</span>
          {SIGNALS.map((signal) => (
            <span key={signal} className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="size-1.5 rounded-full bg-slate-900" aria-hidden="true" />
              {signal}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
