"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KdigoHeatmap } from "@/components/KdigoHeatmap";
import { Card, Field, inputClass } from "@/components/Field";
import { saveRecord } from "@/app/records/actions";
import {
  RISK_LABEL,
  acrToMgG,
  akiStage,
  albStage,
  cockcroftGault,
  egfrCkdEpi2021,
  gfrStage,
  guidance,
  kdigoRisk,
  kfre,
  kfreApplies,
  scrToMgDl,
  type Region,
} from "@/lib/renal";

type ScrUnit = "mgdl" | "umol";
type AcrUnit = "mgg" | "mgmmol";

const RISK_COLOR: Record<string, string> = {
  low: "text-emerald-700 dark:text-emerald-300 bg-low/25",
  moderate: "text-yellow-800 dark:text-yellow-200 bg-moderate/30",
  high: "text-orange-800 dark:text-orange-300 bg-high/30",
  "very-high": "text-red-800 dark:text-red-300 bg-very-high/25",
};

function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-bg/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-muted">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export default function CalculatorPage() {
  const [name, setName] = useState("");
  const [sex, setSex] = useState<"male" | "female">("female");
  const [age, setAge] = useState("58");
  const [weight, setWeight] = useState("70");
  const [scr, setScr] = useState("1.4");
  const [scrUnit, setScrUnit] = useState<ScrUnit>("mgdl");
  const [acr, setAcr] = useState("180");
  const [acrUnit, setAcrUnit] = useState<AcrUnit>("mgg");
  const [region, setRegion] = useState<Region>("other");
  const [baseScr, setBaseScr] = useState("");
  const [urineOut, setUrineOut] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const r = useMemo(() => {
    const ageN = Number(age);
    const scrRaw = Number(scr);
    const acrRaw = Number(acr);
    const weightN = Number(weight);
    if (!(ageN > 0 && scrRaw > 0 && acrRaw > 0 && weightN > 0)) return null;
    const scrMgDl = scrUnit === "umol" ? scrToMgDl(scrRaw) : scrRaw;
    const acrMgG = acrUnit === "mgmmol" ? acrToMgG(acrRaw) : acrRaw;
    const egfr = egfrCkdEpi2021(scrMgDl, ageN, sex);
    const crcl = cockcroftGault(ageN, weightN, scrMgDl, sex);
    const g = gfrStage(egfr);
    const a = albStage(acrMgG);
    const risk = kdigoRisk(g, a);
    const kf = kfreApplies(egfr)
      ? kfre({ age: ageN, sex, egfr, acrMgG, region })
      : null;
    const aki = akiStage({
      scrMgDl,
      baselineScrMgDl: baseScr ? Number(baseScr) : undefined,
      urineOutputMlKgH: urineOut ? Number(urineOut) : undefined,
    });
    return {
      scrMgDl,
      acrMgG,
      egfr,
      crcl,
      g,
      a,
      risk,
      kf,
      aki,
      guidance: guidance({ egfr, acrMgG, risk, kfre2: kf?.risk2yr }),
    };
  }, [age, scr, scrUnit, acr, acrUnit, weight, sex, region, baseScr, urineOut]);

  async function handleSave() {
    if (!r) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await saveRecord({
      patientName: name || "Unnamed patient",
      age: Number(age),
      sex,
      scrMgDl: r.scrMgDl,
      uacrMgG: r.acrMgG,
      region,
      egfr: r.egfr,
      gfrStage: r.g,
      albStage: r.a,
      kdigoRisk: r.risk,
      kfre2yr: r.kf ? r.kf.risk2yr : null,
      kfre5yr: r.kf ? r.kf.risk5yr : null,
      crcl: r.crcl,
      guidance: r.guidance,
    });
    setSaving(false);
    setSaveMsg(res.ok ? "Saved to records." : res.error ?? "Could not save.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinical calculator</h1>
        <p className="mt-1 text-sm text-muted">
          Enter routine lab values. Everything below is computed from published equations — see{" "}
          <Link href="/methods" className="text-primary underline underline-offset-2">
            Methods
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card title="Patient & labs" description="Age, sex, serum creatinine, urine ACR.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Field label="Patient name" htmlFor="name" hint="Optional — for saving to records.">
              <input
                id="name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. J. Doe"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sex" htmlFor="sex">
                <select
                  id="sex"
                  className={inputClass}
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "male" | "female")}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </Field>
              <Field label="Age (years)" htmlFor="age">
                <input
                  id="age"
                  type="number"
                  min={18}
                  max={120}
                  className={inputClass}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Serum creatinine"
                htmlFor="scr"
                hint="Standardized (IDMS) value."
              >
                <div className="flex gap-1.5">
                  <input
                    id="scr"
                    type="number"
                    min={0.1}
                    step="any"
                    className={inputClass}
                    value={scr}
                    onChange={(e) => setScr(e.target.value)}
                  />
                  <select
                    aria-label="Creatinine unit"
                    className={`${inputClass} w-28`}
                    value={scrUnit}
                    onChange={(e) => setScrUnit(e.target.value as ScrUnit)}
                  >
                    <option value="mgdl">mg/dL</option>
                    <option value="umol">µmol/L</option>
                  </select>
                </div>
              </Field>
              <Field label="Weight (kg)" htmlFor="weight" hint="Used for Cockcroft–Gault.">
                <input
                  id="weight"
                  type="number"
                  min={1}
                  className={inputClass}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Urine ACR" htmlFor="acr" hint="Albumin-to-creatinine ratio.">
                <div className="flex gap-1.5">
                  <input
                    id="acr"
                    type="number"
                    min={0.1}
                    step="any"
                    className={inputClass}
                    value={acr}
                    onChange={(e) => setAcr(e.target.value)}
                  />
                  <select
                    aria-label="ACR unit"
                    className={`${inputClass} w-28`}
                    value={acrUnit}
                    onChange={(e) => setAcrUnit(e.target.value as AcrUnit)}
                  >
                    <option value="mgg">mg/g</option>
                    <option value="mgmmol">mg/mmol</option>
                  </select>
                </div>
              </Field>
              <Field label="Region" htmlFor="region" hint="KFRE calibration factor.">
                <select
                  id="region"
                  className={inputClass}
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                >
                  <option value="other">Non-North American</option>
                  <option value="northAmerica">North American</option>
                </select>
              </Field>
            </div>

            <details className="rounded-[var(--radius-base)] border border-border bg-bg/50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted">
                Optional: AKI staging inputs
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Field label="Baseline creatinine (mg/dL)" htmlFor="baseScr">
                  <input
                    id="baseScr"
                    type="number"
                    min={0.1}
                    step="any"
                    className={inputClass}
                    value={baseScr}
                    onChange={(e) => setBaseScr(e.target.value)}
                    placeholder="e.g. 1.0"
                  />
                </Field>
                <Field
                  label="Urine output (mL/kg/h)"
                  htmlFor="urineOut"
                  hint="Adds the KDIGO oliguria criteria."
                >
                  <input
                    id="urineOut"
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={urineOut}
                    onChange={(e) => setUrineOut(e.target.value)}
                    placeholder="e.g. 0.4"
                  />
                </Field>
              </div>
            </details>

            <button
              type="submit"
              disabled={!r || saving}
              className="w-full rounded-[var(--radius-base)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save to records"}
            </button>
            {saveMsg ? (
              <p
                className={`text-xs ${saveMsg.includes("Saved") ? "text-emerald-700 dark:text-emerald-300" : "text-muted"}`}
              >
                {saveMsg}
              </p>
            ) : null}
          </form>
        </Card>

        <div className="space-y-6">
          <Card
            title="Results"
            description="All values recomputed live from the inputs above — nothing is randomized."
          >
            {!r ? (
              <p className="text-sm text-muted">
                Enter age, creatinine, and uACR to see results.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    label="eGFR (CKD-EPI 2021)"
                    value={r.egfr.toFixed(1)}
                    unit="mL/min/1.73m²"
                  />
                  <Stat label="CrCl (Cockcroft–Gault)" value={r.crcl.toFixed(0)} unit="mL/min" />
                  <Stat label="CKD stage" value={`${r.g}${r.a}`} sub={RISK_LABEL[r.risk]} />
                  <div className="rounded-[var(--radius-base)] border border-border bg-bg/60 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      KDIGO risk
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-sm font-semibold ${RISK_COLOR[r.risk]}`}
                    >
                      {RISK_LABEL[r.risk]}
                    </span>
                  </div>
                </div>

                {r.kf ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      label="Kidney failure risk — 2 yr"
                      value={`${(r.kf.risk2yr * 100).toFixed(1)}%`}
                      sub="Tangri 4-variable KFRE"
                    />
                    <Stat
                      label="Kidney failure risk — 5 yr"
                      value={`${(r.kf.risk5yr * 100).toFixed(1)}%`}
                      sub={`${region === "northAmerica" ? "North American" : "Non-North American"} calibration`}
                    />
                  </div>
                ) : (
                  <p className="rounded-[var(--radius-base)] border border-border bg-bg/60 px-4 py-3 text-xs text-muted">
                    KFRE not computed: the equation is validated for CKD stages G3–G5 (eGFR &lt;
                    60). Current eGFR is {r.egfr.toFixed(0)}.
                  </p>
                )}

                <div>
                  <h3 className="text-sm font-semibold">KDIGO heat map</h3>
                  <p className="mb-3 text-xs text-muted">
                    Risk of adverse outcomes by GFR category and albuminuria category. The
                    patient&apos;s cell is highlighted.
                  </p>
                  <KdigoHeatmap g={r.g} a={r.a} />
                </div>

                {r.aki > 0 ? (
                  <div className="rounded-[var(--radius-base)] border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                    <p className="text-sm font-semibold">
                      KDIGO AKI stage {r.aki} — acute kidney injury criteria met
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Staging uses creatinine rise (with baseline) and urine output; the higher
                      criterion wins.
                    </p>
                  </div>
                ) : null}

                <div>
                  <h3 className="text-sm font-semibold">Guideline-derived guidance</h3>
                  <ul className="mt-2 space-y-2">
                    {r.guidance.map((g) => (
                      <li key={g} className="flex gap-2.5 text-sm text-pretty">
                        <span className="mt-0.5 text-accent" aria-hidden="true">
                          ✓
                        </span>
                        {g}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted">
                    Rules derived from KDIGO 2024 CKD guideline thresholds. Not medical advice —
                    a clinician must interpret every result.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
