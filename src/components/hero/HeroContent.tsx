import Link from "next/link";
import { HeroStats, type HeroStat } from "@/components/hero/HeroStats";

const BADGES = ["Published equations", "CKD-EPI 2021", "KFRE (Tangri)", "KDIGO 2024", "No training data"];

const SIGNALS = [
  { label: "eGFR", color: "bg-cyan-200" },
  { label: "KFRE risk", color: "bg-teal-200" },
  { label: "KDIGO stage", color: "bg-emerald-200" },
] as const;

/**
 * Server-rendered copy remains readable before JavaScript or WebGL is available.
 * The canvas is progressive enhancement; the evidence and actions are never canvas-only.
 */
export default function HeroContent({ stats }: { stats: readonly HeroStat[] }) {
  return (
    <div className="hero-ready relative z-10 mx-auto flex min-h-[680px] max-w-6xl flex-col items-center justify-center px-6 py-24 text-center sm:min-h-[720px] lg:min-h-[760px] lg:items-start lg:px-10 lg:text-left xl:px-2">
      <div className="max-w-xl">
        <div className="hero-reveal" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/75 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" aria-hidden="true" />
            Published equations · Deterministic · Citeable
          </span>
        </div>

        <h1
          className="hero-reveal mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.04] tracking-tight text-white sm:text-6xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Kidney numbers,
          <br />
          <span className="bg-gradient-to-r from-teal-200 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
            computed honestly.
          </span>
        </h1>

        <p
          className="hero-reveal mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          Published renal equations, shown step by step. CKD-EPI 2021 eGFR, Kidney Failure Risk
          Equation, and KDIGO staging — without training data or black-box reports.
        </p>

        <div
          className="hero-reveal mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
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

        <div className="mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2 lg:justify-start">
          {BADGES.map((badge, index) => (
            <span
              key={badge}
              className="hero-pop rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60 backdrop-blur-sm"
              style={{ "--i": index } as React.CSSProperties}
            >
              {badge}
            </span>
          ))}
        </div>

        <HeroStats stats={stats} />

        <div
          className="hero-reveal mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45 lg:justify-start"
          style={{ "--i": 4 } as React.CSSProperties}
          aria-label="Three live calculation signals represented in the visualization"
        >
          <span className="text-white/35">Live signals</span>
          {SIGNALS.map((signal) => (
            <span key={signal.label} className="inline-flex items-center gap-1.5 text-white/65">
              <span className={`size-1.5 rounded-full ${signal.color}`} aria-hidden="true" />
              {signal.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
