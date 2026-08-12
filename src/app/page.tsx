import Link from "next/link";
import Reveal from "@/components/Reveal";
import Hero from "@/components/hero/Hero";
import type { HeroStat } from "@/components/hero/HeroStats";
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

export default function LandingPage() {
  return (
    <div className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 overflow-x-clip">
      <Hero stats={HERO_STATS} />

      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Every number on this page was computed, not generated
          </p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Three outputs. One transparent calculation path.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted">
            The moving signals in the hero correspond to the same deterministic outputs below. This
            is a demonstration patient, not a generated report.
          </p>
        </div>
        <Reveal stagger className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group relative overflow-hidden rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              <div className="flex items-center justify-between">
                <svg
                  viewBox="0 0 24 24"
                  className="size-7 text-primary"
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
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
              <p className="mt-5 text-2xl font-bold tracking-tight tabular-nums text-text">
                {feature.value}
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">{feature.note}</p>
            </article>
          ))}
        </Reveal>
      </section>

      <section className="border-y border-border bg-[linear-gradient(180deg,color-mix(in_oklab,var(--surface)_96%,var(--primary)_4%),var(--bg))]">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Computation, made inspectable
              </p>
              <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                The answer is not a black box.
              </h2>
              <p className="mt-4 max-w-lg text-pretty leading-relaxed text-muted">
                Nephro turns a small set of clinical values into a citeable assessment. The route
                from input to guidance is visible at every step.
              </p>
              <Link
                href="/methods"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-accent"
              >
                Inspect the published methods
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <Reveal stagger as="div" className="grid gap-3 sm:grid-cols-2">
              {STEPS.map((step) => (
                <article
                  key={step.number}
                  className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface/80 p-5 shadow-sm"
                >
                  <span className="font-mono text-xs font-semibold tracking-[0.16em] text-primary">
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      <Reveal as="section" delay={100} className="border-b border-border bg-surface/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Transparent by design
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              No black boxes. Every intermediate value visible.
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted">
              This tool runs the exact published equations nephrologists rely on, shows the inputs
              and classification logic behind each result, and cites the source for every
              calculation family. The same inputs produce the same result on every device.
            </p>
            <Link
              href="/methods"
              className="mt-6 inline-block rounded-[var(--radius-base)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
            >
              Read the methods
            </Link>
          </div>
          <div className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface p-6 shadow-lg shadow-primary/5">
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
      </Reveal>

      <Reveal as="section" delay={100} className="relative overflow-hidden px-6 py-24 text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_52%)]"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ready when you are</p>
        <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Run it on a real patient, right now.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted">
          Two minutes of lab values in — a complete, citeable CKD assessment out.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/calculator"
            className="rounded-[var(--radius-base)] bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
          >
            Go to calculator
          </Link>
          <Link
            href="/records"
            className="rounded-[var(--radius-base)] border border-border bg-surface px-7 py-3 text-sm font-semibold transition-colors hover:bg-bg"
          >
            View patient records
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

export const dynamic = "force-static";
