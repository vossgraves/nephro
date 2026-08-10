import type { ReactNode } from "react";

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-base)] border border-border bg-bg px-4 py-3 font-mono text-[13px] leading-relaxed">
      {children}
    </div>
  );
}

function Source({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted">Source: {children}</p>;
}

function Eq({
  n,
  title,
  tag,
  children,
  source,
  example,
}: {
  n: string;
  title: string;
  tag?: string;
  children: ReactNode;
  source: ReactNode;
  example?: string;
}) {
  return (
    <article className="scroll-mt-24 rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {n}
        </span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {tag ? (
          <span className="rounded-full bg-low/25 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {tag}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
      <Formula>{example ?? ""}</Formula>
      <div className="mt-3">
        <Source>{source}</Source>
      </div>
    </article>
  );
}

export default function MethodsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Methods & sources</h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
          This tool contains no machine learning, no &ldquo;trained weights&rdquo;, and no
          randomly generated impressions. Every output is the direct evaluation of a published
          equation with fixed, cited constants — the same mathematics nephrology guidelines and
          hospital laboratories rely on. Every formula is reproduced below with its primary
          source, so any output can be independently verified by hand.
        </p>
      </div>

      <Eq
        n="1"
        title="eGFR — CKD-EPI 2021 creatinine equation"
        tag="Race-free · recommended"
        source={
          <>
            Inker LA, Eneanya ND, Coresh J, et al. New creatinine- and cystatin C-based equations
            to estimate GFR without race. N Engl J Med 2021;385:1737–1749. Formula as published by
            the National Kidney Foundation (kidney.org/ckd-epi-creatinine-equation-2021).
          </>
        }
        example={`eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × 1.012 [if female]

κ = 0.7 (female) or 0.9 (male)
α = -0.241 (female) or -0.302 (male)
Scr = standardized serum creatinine in mg/dL

Example: 58 y female, Scr 1.4 mg/dL
= 142 × 1.5556^-1.200 × 0.9938^58 × 1.012 = 44.6 mL/min/1.73 m²`}
      >
        <p>
          The 2021 revision removes the race coefficient that the 2009 equation carried, after
          it was shown to perpetuate inequity and to misclassify kidney function. The same
          standardized (IDMS) creatinine values labs already report are used directly. This is
          the equation laboratories display alongside every adult serum creatinine result.
        </p>
      </Eq>

      <Eq
        n="2"
        title="Kidney Failure Risk Equation (4-variable KFRE)"
        tag="Validated in 700k+ patients"
        source={
          <>
            Tangri N, Stevens LA, Griffith J, et al. A predictive model for progression of CKD
            to kidney failure. JAMA 2011;305:1553–9. Recalibration: Tangri N, Grams ME, Levey
            AS, et al. Multinational assessment of accuracy of equations for predicting risk of
            kidney failure. JAMA 2016;315:164–74.
          </>
        }
        example={`L = -0.2201×(age/10 − 7.036) + 0.2467×(male − 0.5642)
    − 0.5567×(eGFR/5 − 7.222) + 0.4510×(ln(uACR mg/g) − 5.137)
Risk(t) = 1 − S0(t)^exp(L)

Baseline survival S0:
  North American      2-yr 0.9751 · 5-yr 0.9240
  Non-North American  2-yr 0.9832 · 5-yr 0.9365`}
      >
        <p>
          Predicts the 2- and 5-year probability of treated kidney failure (dialysis or
          transplant) for adults with CKD stages G3–G5. The linear predictor is identical
          worldwide; only the baseline survival differs by region, because baseline risk is
          materially higher in North American cohorts. Using the wrong calibration is the single
          most common implementation error.
        </p>
        <p>
          The equation is not validated for eGFR ≥ 60, dialysis, transplant recipients, or
          children — this tool accordingly refuses to display it in those settings.
        </p>
      </Eq>

      <Eq
        n="3"
        title="KDIGO classification — GFR and albuminuria categories"
        tag="Guideline standard"
        source={
          <>
            Kidney Disease: Improving Global Outcomes (KDIGO) CKD Work Group. KDIGO 2024
            Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney
            Disease. Kidney Int 2024;105(4S):S117–S314.
          </>
        }
        example={`GFR categories (mL/min/1.73 m²):  G1 ≥90 · G2 60–89 · G3a 45–59
  G3b 30–44 · G4 15–29 · G5 <15
Albuminuria (mg/g):  A1 <30 · A2 30–300 · A3 >300
(mg/mmol: A1 <3 · A2 3–30 · A3 >30; 1 mg/mmol = 8.84 mg/g)`}
      >
        <p>
          The risk heat map combines the two: prognosis and management intensity rise from
          &ldquo;low&rdquo; through &ldquo;moderately increased&rdquo;, &ldquo;high&rdquo;, to
          &ldquo;very high&rdquo; as GFR falls and albuminuria rises. This is the staging the
          tool uses for its risk label and its monitoring/referral guidance.
        </p>
      </Eq>

      <Eq
        n="4"
        title="Creatinine clearance — Cockcroft–Gault"
        tag="Drug dosing"
        source={
          <>
            Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine.
            Nephron 1976;16:31–41.
          </>
        }
        example={`CrCl = [(140 − age) × weight(kg)] / [72 × Scr(mg/dL)]  × 0.85 [if female]

Example: 58 y female, 70 kg, Scr 1.4 mg/dL
= (82 × 70) / (72 × 1.4) × 0.85 = 48.4 mL/min`}
      >
        <p>
          Still the clearance estimate many drug labels reference for renal dose adjustment.
          Total body weight is used by default; clinicians commonly substitute ideal or adjusted
          body weight at the extremes of BMI — the tool passes through whichever weight is
          entered.
        </p>
      </Eq>

      <Eq
        n="5"
        title="KDIGO acute kidney injury staging"
        tag="AKI"
        source={
          <>
            KDIGO AKI Work Group. KDIGO Clinical Practice Guideline for Acute Kidney Injury.
            Kidney Int Suppl 2012;2:1–138.
          </>
        }
        example={`Stage 1:  Scr rise ≥0.3 mg/dL or 1.5–1.9× baseline, or urine output <0.5 mL/kg/h for 6–12 h
Stage 2:  Scr 2.0–2.9× baseline, or urine output <0.5 mL/kg/h for ≥12 h
Stage 3:  Scr ≥3× baseline or ≥4.0 mg/dL, or RRT started, or urine output <0.3 mL/kg/h for ≥24 h`}
      >
        <p>
          Included as an optional module since acute and chronic kidney disease coexist
          frequently. When a baseline creatinine or urine output is supplied, the higher of the
          two criteria determines the stage.
        </p>
      </Eq>

      <div className="rounded-[calc(var(--radius-base)+2px)] border border-amber-500/30 bg-amber-500/5 p-6 text-sm leading-relaxed text-muted">
        <h2 className="font-semibold text-text">Scope and limits</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            Estimates are population-level mathematics; individual variability can exceed the
            difference between equations.
          </li>
          <li>
            eGFR requires a steady-state creatinine; values are unreliable in acute injury,
            pregnancy, extremes of muscle mass, or dietary extremes.
          </li>
          <li>A single low eGFR does not diagnose CKD — chronicity requires persistence ≥ 3 months.</li>
          <li>This tool is not a medical device and does not constitute medical advice.</li>
        </ul>
      </div>
    </div>
  );
}
