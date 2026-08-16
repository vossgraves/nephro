import Link from "next/link";
import Reveal from "@/components/Reveal";
import LandingBackdrop from "@/components/hero/LandingBackdrop";
import { HeroStats, type HeroStat } from "@/components/hero/HeroStats";
import {
  albStage,
  egfrCkdEpi2021,
  gfrStage,
  guidance,
  kdigoRisk,
  kfre,
  RISK_LABEL,
} from "@/lib/renal";

const PATIENT = {
  age: 58,
  sex: "female" as const,
  scrMgDl: 1.4,
  acrMgG: 180,
  region: "other" as const,
};
const egfr = egfrCkdEpi2021(PATIENT.scrMgDl, PATIENT.age, PATIENT.sex);
const g = gfrStage(egfr);
const a = albStage(PATIENT.acrMgG);
const risk = kdigoRisk(g, a);
const kf = kfre({ ...PATIENT, egfr });

const HERO_STATS: readonly HeroStat[] = [
  { label: "eGFR", unit: "mL/min/1.73m²", value: egfr, digits: 1 },
  { label: "2-yr KFRE", unit: "%", value: kf.risk2yr * 100, digits: 1 },
  { label: "KDIGO", unit: "stage", value: null, display: `${g} ${a}` },
];

const FEATURES = [
  {
    icon: "M12 3c3.5 0 6 2.6 6 6.2 0 4.6-3.4 8.4-6 11.8-2.6-3.4-6-7.2-6-11.8C6 5.6 8.5 3 12 3Z",
    signal: "Signal 01",
    title: "CKD-EPI 2021 eGFR",
    body: "The race-free equation the NKF and labs report today. Age, sex, and one creatinine.",
    value: `${egfr.toFixed(1)} mL/min/1.73m²`,
    note: `${PATIENT.age}y ${PATIENT.sex}, Scr ${PATIENT.scrMgDl} mg/dL`,
  },
  {
    icon: "M4 17l6-6-6-6M12 19h8",
    signal: "Signal 02",
    title: "KFRE risk",
    body: "Tangri's 4-variable kidney failure risk, shown as a two-year and five-year probability.",
    value: `${(kf.risk2yr * 100).toFixed(1)}% / ${(kf.risk5yr * 100).toFixed(1)}%`,
    note: `2-year / 5-year risk · uACR ${PATIENT.acrMgG} mg/g`,
  },
  {
    icon: "M12 3v18M5 21h14",
    signal: "Signal 03",
    title: "KDIGO staging",
    body: "The G1–G5 × A1–A3 heat map that turns the same values into clinical risk context.",
    value: `${g} ${a} · ${RISK_LABEL[risk]}`,
    note: "Derived from the same values above",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Start with the patient",
    body: "Enter age, sex, serum creatinine, and uACR. The tool labels every input and its unit.",
  },
  {
    number: "02",
    title: "Run published equations",
    body: "CKD-EPI 2021 and KFRE are calculated from their published constants, not estimated by a model.",
  },
  {
    number: "03",
    title: "Stage the context",
    body: "KDIGO combines GFR and albuminuria into a prognosis grid with the active cell highlighted.",
  },
  {
    number: "04",
    title: "Show the working",
    body: "Every result can be traced to its inputs, intermediate values, source equation, and guidance rule.",
  },
];

const BADGES = ["Published equations", "CKD-EPI 2021", "KFRE (Tangri)", "KDIGO 2024"];
const SIGNALS = ["eGFR", "KFRE risk", "KDIGO stage"] as const;

/**
 * Landing page: the kidney scene is the fixed full-viewport backdrop and the
 * content scrolls over it. Each section owns a choreography pose via its
 * data-choreo attribute; the camera rig damps between poses as you scroll.
 * Without WebGL the poster renders instead; with reduced motion the scene is
 * a static composed frame and the page reads as a normal editorial document.
 */
export default function LandingPage() {
  return (
    <>
      {/* Fixed WebGL backdrop (landing page only). */}
      <LandingBackdrop />

      <div className="relative z-10">
        {/* HERO */}
        <section data-choreo="hero" className="relative flex min-h-[calc(100dvh-7rem)] flex-col justify-center py-16">
          <div className="max-w-2xl">
            <p className="eyebrow hero-reveal" style={{ "--i": 0 } as React.CSSProperties}>
              Published equations · Deterministic · Citeable
            </p>
            <h1
              className="hero-reveal mt-5 text-balance font-bold text-text"
              style={{
                "--i": 1,
                fontSize: "clamp(2.75rem, 6vw, 5.25rem)",
                lineHeight: 1.02,
                letterSpacing: "-0.045em",
              } as React.CSSProperties}
            >
              Kidney numbers,
              <br />
              <span className="text-muted">made clear.</span>
            </h1>
            <p
              className="hero-reveal mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-lg"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              Published renal equations, visible step by step. CKD-EPI 2021 eGFR, the Kidney
              Failure Risk Equation, and KDIGO staging — computed in the open, never generated
              by a model.
            </p>
            <div
              className="hero-reveal mt-9 flex flex-wrap items-center gap-3"
              style={{ "--i": 3 } as React.CSSProperties}
            >
              <Link
                href="/calculator"
                className="pressable rounded-[var(--radius-base)] bg-primary px-7 py-3 text-sm font-semibold text-primary-fg shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
              >
                Open calculator
              </Link>
              <Link
                href="/imaging"
                className="pressable rounded-[var(--radius-base)] border border-border bg-surface/80 px-7 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-surface"
              >
                Review an image
              </Link>
            </div>
            <div className="mt-8 flex max-w-xl flex-wrap items-center gap-2">
              {BADGES.map((badge, index) => (
                <span
                  key={badge}
                  className="hero-pop rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-medium text-muted shadow-sm backdrop-blur-sm"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  {badge}
                </span>
              ))}
            </div>
            <HeroStats stats={HERO_STATS} />
            <div
              className="hero-reveal mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
              style={{ "--i": 4 } as React.CSSProperties}
              role="group"
              aria-label="Three live calculation signals represented in the visualization"
            >
              <span className="text-muted/80">Live signals</span>
              {SIGNALS.map((signal) => (
                <span key={signal} className="inline-flex items-center gap-1.5 text-text">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* SIGNALS */}
        <section data-choreo="signals" data-choreo-fade className="relative py-24 sm:py-32">
          <div className="max-w-2xl">
            <p className="eyebrow">Every number on this page was computed, not generated</p>
            <h2 className="display-2 mt-4 text-balance text-text">
              Three outputs. One transparent calculation path.
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted">
              The moving signals around the kidney correspond to the same deterministic outputs
              below. This is a demonstration patient, not a generated report.
            </p>
          </div>
          <Reveal stagger className="mt-10 grid gap-5 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface/85 p-6 shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
                <div className="flex items-center justify-between">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-7 text-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={feature.icon} />
                  </svg>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {feature.signal}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-text">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
                <p className="mt-5 text-2xl font-bold tracking-tight tabular-nums text-text">
                  {feature.value}
                </p>
                <p className="mt-1 text-xs text-muted tabular-nums">{feature.note}</p>
              </article>
            ))}
          </Reveal>
        </section>

        {/* PROCESS */}
        <section data-choreo="process" data-choreo-fade className="relative py-24 sm:py-32">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="eyebrow">Computation, made inspectable</p>
              <h2 className="display-2 mt-4 text-balance text-text">
                The answer is not a black box.
              </h2>
              <p className="mt-4 max-w-lg text-pretty leading-relaxed text-muted">
                Nephro turns a small set of clinical values into a citeable assessment. The route
                from input to guidance is visible at every step.
              </p>
              <Link
                href="/methods"
                className="pressable mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
              >
                Inspect the published methods
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <Reveal stagger as="div" className="grid gap-3 sm:grid-cols-2">
              {STEPS.map((step) => (
                <article
                  key={step.number}
                  className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface/85 p-5 shadow-sm backdrop-blur-md"
                >
                  <span className="font-mono text-xs font-semibold tracking-[0.16em] text-accent">
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-text">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </section>

        {/* VERIFIED GUIDANCE */}
        <section data-choreo="process" data-choreo-fade className="relative py-24 sm:py-32">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="eyebrow">Transparent by design</p>
              <h2 className="display-2 mt-3 text-balance text-text">
                No black boxes. Every intermediate value visible.
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted">
                This tool runs the exact published equations nephrologists rely on, shows the
                inputs and classification logic behind each result, and cites the source for
                every calculation family. The same inputs produce the same result on every device.
              </p>
              <Link
                href="/methods"
                className="pressable mt-6 inline-block rounded-[var(--radius-base)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
              >
                Read the methods
              </Link>
            </div>
            <div className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface/90 p-6 shadow-lg shadow-primary/5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Deterministic, always
                </span>
                <span className="rounded-full bg-low/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Verified
                </span>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {guidance({ egfr, acrMgG: PATIENT.acrMgG, risk, kfre2: kf.risk2yr }).map((item) => (
                  <li key={item} className="flex gap-2.5 text-pretty text-text">
                    <span className="mt-0.5 text-accent" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
                <li className="flex gap-2.5 text-pretty text-muted">
                  <span className="mt-0.5 text-accent" aria-hidden="true">
                    ✓
                  </span>
                  Guidance is generated from guideline rules, not a language model.
                </li>
              </ul>
              <div className="mt-6 rounded-[var(--radius-base)] bg-bg px-4 py-3 font-mono text-xs text-muted">
                scr 1.4 mg/dL · age 58 · female → eGFR {egfr.toFixed(1)} · {g} {a} · KFRE 2yr{" "}
                {(kf.risk2yr * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section data-choreo="cta" data-choreo-fade className="relative flex min-h-[70dvh] flex-col items-center justify-center py-24 text-center">
          <p className="eyebrow">Ready when you are</p>
          <h2 className="display-2 mt-4 text-balance text-text">
            Run it on a real patient, right now.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-muted">
            Two minutes of lab values in — a complete, citeable CKD assessment out.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/calculator"
              className="pressable rounded-[var(--radius-base)] bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
            >
              Open calculator
            </Link>
            <Link
              href="/records"
              className="pressable rounded-[var(--radius-base)] border border-border bg-surface/80 px-7 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-surface"
            >
              View patient records
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

export const dynamic = "force-static";
