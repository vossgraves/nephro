import Link from "next/link";
import Reveal from "@/components/Reveal";
import Hero from "@/components/hero/Hero";
import {
  albStage,
  egfrCkdEpi2021,
  gfrStage,
  guidance,
  kdigoRisk,
  kfre,
  RISK_LABEL,
  scrToMgDl,
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

const FEATURES = [
  {
    icon: "M12 3c3.5 0 6 2.6 6 6.2 0 4.6-3.4 8.4-6 11.8-2.6-3.4-6-7.2-6-11.8C6 5.6 8.5 3 12 3Z",
    title: "CKD-EPI 2021 eGFR",
    body: "The race-free equation the NKF and labs report today. Age, sex, and one creatinine.",
    value: `${egfr.toFixed(1)} mL/min/1.73m²`,
    note: `${PATIENT.age}y ${PATIENT.sex}, Scr ${PATIENT.scrMgDl} mg/dL`,
  },
  {
    icon: "M4 17l6-6-6-6M12 19h8",
    title: "KFRE risk",
    body: "Tangri's 4-variable kidney failure risk — validated on 700k+ patients across 30 countries.",
    value: `${(kf.risk2yr * 100).toFixed(1)}% / ${(kf.risk5yr * 100).toFixed(1)}%`,
    note: `2-year / 5-year risk · uACR ${PATIENT.acrMgG} mg/g`,
  },
  {
    icon: "M12 3v18M5 21h14",
    title: "KDIGO staging",
    body: "The G1–G5 × A1–A3 heat map that drives every referral decision. Yours is highlighted.",
    value: `${g}${a} · ${RISK_LABEL[risk]}`,
    note: `Derived from the same two values above`,
  },
];

export default function LandingPage() {
  return (
    <>
      <Hero />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Every number on this page was computed, not generated
        </p>
        <Reveal stagger className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="group rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-primary/5"
            >
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
                <path d={f.icon} />
              </svg>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              <p className="mt-5 text-2xl font-bold tracking-tight tabular-nums text-text">
                {f.value}
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">{f.note}</p>
            </article>
          ))}
        </Reveal>
      </section>

      <Reveal as="section" delay={100} className="border-y border-border bg-surface/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              No fake AI
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Your scan does not need a &ldquo;neural training center&rdquo;.
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted">
              Most kidney &ldquo;AI&rdquo; tools fake it: a progress bar, a scan animation, and a
              random report from a list. This tool does the opposite — it runs the exact
              equations nephrologists have relied on for a decade, shows every intermediate
              value, and cites the paper each constant came from. Results are identical every
              time, on every device.
            </p>
            <Link
              href="/methods"
              className="mt-6 inline-block rounded-[var(--radius-base)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
            >
              Read the methods
            </Link>
          </div>
          <div className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Deterministic, always
              </span>
              <span className="rounded-full bg-low/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Verified
              </span>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm">
              {guidance({ egfr, acrMgG: PATIENT.acrMgG, risk, kfre2: kf.risk2yr }).map((g) => (
                <li key={g} className="flex gap-2.5 text-pretty text-text">
                  <span className="mt-0.5 text-accent" aria-hidden="true">
                    ✓
                  </span>
                  {g}
                </li>
              ))}
              <li className="flex gap-2.5 text-pretty text-muted">
                <span className="mt-0.5 text-accent" aria-hidden="true">
                  ✓
                </span>
                Guidance generated from guideline rules — not a language model.
              </li>
            </ul>
            <div className="mt-6 rounded-[var(--radius-base)] bg-bg px-4 py-3 font-mono text-xs text-muted">
              scr 1.4 mg/dL · age 58 · female → eGFR {egfr.toFixed(1)} · G{g}A{a} · KFRE 2yr{" "}
              {(kf.risk2yr * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" delay={100} className="px-6 py-24 text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
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
    </>
  );
}

export const dynamic = "force-static";
