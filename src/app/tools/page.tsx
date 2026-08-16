"use client";

import { useMemo, useState } from "react";
import { Card, Field, inputClass } from "@/components/Field";
import {
  acrFromSpotUrine,
  acrToMgMmol,
  adrogueMadias,
  albStage,
  anionGap,
  checkRange,
  correctedCalcium,
  dosingByEgfr,
  feNa,
  ganzoniIronDeficit,
  INFUSATE_NA,
  tsat,
  type Sex,
} from "@/lib/renal";

function ToolStat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-muted">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</p> : null}
    </div>
  );
}

function SectionIntro({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-pretty"
      style={{
        margin: 0,
        maxWidth: "62ch",
        fontSize: "15px",
        lineHeight: 1.55,
        letterSpacing: "-0.01em",
        color: "var(--muted)",
      }}
    >
      {children}
    </p>
  );
}

/* -------------------------------------------------------- ACR tool ----- */

function AcrTool() {
  const [alb, setAlb] = useState("");
  const [cr, setCr] = useState("");
  const albN = Number(alb);
  const crN = Number(cr);
  const errors = useMemo(
    () => ({
      alb: checkRange("uAlbMgDl", albN),
      cr: checkRange("uCrMgDl", crN),
    }),
    [albN, crN],
  );
  const valid = !errors.alb && !errors.cr && albN > 0 && crN > 0;
  const acr = valid ? acrFromSpotUrine(albN, crN) : null;
  return (
    <Card
      title="Spot urine ACR / UPCR"
      description="Derive the albumin-to-creatinine ratio from raw urine concentrations — handy when the lab reports the components, not the ratio."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Urine albumin" htmlFor="acr-alb" hint="mg/dL" error={errors.alb ?? undefined}>
          <input id="acr-alb" type="number" min={0.1} step="any" inputMode="decimal" className={inputClass} value={alb} onChange={(e) => setAlb(e.target.value)} placeholder="e.g. 25" />
        </Field>
        <Field label="Urine creatinine" htmlFor="acr-cr" hint="mg/dL" error={errors.cr ?? undefined}>
          <input id="acr-cr" type="number" min={1} step="any" inputMode="decimal" className={inputClass} value={cr} onChange={(e) => setCr(e.target.value)} placeholder="e.g. 120" />
        </Field>
      </div>
      {acr !== null ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ToolStat label="ACR" value={acr.toFixed(1)} unit="mg/g" />
          <ToolStat label="ACR (SI)" value={acrToMgMmol(acr).toFixed(1)} unit="mg/mmol" />
          <ToolStat
            label="Albuminuria"
            value={albStage(acr)}
            sub={acr >= 300 ? "Severely increased" : acr >= 30 ? "Moderately increased" : "Normal–mildly increased"}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {errors.alb || errors.cr ? "One or both values are outside physiological range." : "Enter both values to compute the ratio."}
        </p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        ACR = albumin (mg/dL) ÷ creatinine (mg/dL) × 1000. KDIGO categories: A1 &lt;30, A2 30–300, A3 &gt;300 mg/g.
      </p>
    </Card>
  );
}

/* ---------------------------------------------------- anion gap tool -- */

function AnionGapTool() {
  const [na, setNa] = useState("140");
  const [cl, setCl] = useState("104");
  const [hco3, setHco3] = useState("24");
  const [uNa, setUNa] = useState("");
  const [uK, setUK] = useState("");
  const [uCl, setUCl] = useState("");
  const naN = Number(na);
  const clN = Number(cl);
  const hco3N = Number(hco3);
  const valid = [naN, clN, hco3N].every((v) => v > 0) && !checkRange("naMEqL", naN) && !checkRange("clMEqL", clN) && !checkRange("hco3MEqL", hco3N);
  const gap = valid ? anionGap(naN, clN, hco3N) : null;
  const uag = uNa && uK && uCl ? urineAnionGapValues(Number(uNa), Number(uK), Number(uCl)) : null;
  return (
    <Card
      title="Anion gap"
      description="Screen for unmeasured anions in metabolic acidosis. An elevated gap with normal lactate suggests ketones, uremia, or toxins."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sodium (Na⁺)" htmlFor="ag-na" hint="mEq/L">
          <input id="ag-na" type="number" step="any" inputMode="decimal" className={inputClass} value={na} onChange={(e) => setNa(e.target.value)} />
        </Field>
        <Field label="Chloride (Cl⁻)" htmlFor="ag-cl" hint="mEq/L">
          <input id="ag-cl" type="number" step="any" inputMode="decimal" className={inputClass} value={cl} onChange={(e) => setCl(e.target.value)} />
        </Field>
        <Field label="Bicarbonate (HCO₃⁻)" htmlFor="ag-hco3" hint="mEq/L">
          <input id="ag-hco3" type="number" step="any" inputMode="decimal" className={inputClass} value={hco3} onChange={(e) => setHco3(e.target.value)} />
        </Field>
      </div>
      {gap !== null ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ToolStat
            label="Serum anion gap"
            value={gap.toFixed(1)}
            unit="mEq/L"
            sub={gap > 12 ? "Elevated — check lactate and unmeasured anions." : gap < 8 ? "Low — consider hypoalbuminemia." : "Within reference range."}
          />
          {uag ? (
            <ToolStat
              label="Urine anion gap"
              value={uag.toFixed(1)}
              unit="mEq/L"
              sub={uag < 0 ? "Negative — suggests intact renal acidification." : "Positive — consider renal tubular acidosis."}
            />
          ) : (
            <div className="rounded-[calc(var(--radius-base)-2px)] border border-dashed border-border bg-bg/40 px-4 py-3 text-xs text-muted">
              Optional: enter urine Na⁺, K⁺, Cl⁻ below for the urine anion gap (RTA workup).
            </div>
          )}
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Urine Na⁺" htmlFor="ag-una" hint="mEq/L (optional)">
          <input id="ag-una" type="number" step="any" inputMode="decimal" className={inputClass} value={uNa} onChange={(e) => setUNa(e.target.value)} />
        </Field>
        <Field label="Urine K⁺" htmlFor="ag-uk" hint="mEq/L (optional)">
          <input id="ag-uk" type="number" step="any" inputMode="decimal" className={inputClass} value={uK} onChange={(e) => setUK(e.target.value)} />
        </Field>
        <Field label="Urine Cl⁻" htmlFor="ag-ucl" hint="mEq/L (optional)">
          <input id="ag-ucl" type="number" step="any" inputMode="decimal" className={inputClass} value={uCl} onChange={(e) => setUCl(e.target.value)} />
        </Field>
      </div>
    </Card>
  );
}

function urineAnionGapValues(uNa: number, uK: number, uCl: number) {
  return uNa + uK - uCl;
}

/* ------------------------------------------------------ calcium tool -- */

function CalciumTool() {
  const [ca, setCa] = useState("9.0");
  const [alb, setAlb] = useState("4.0");
  const caN = Number(ca);
  const albN = Number(alb);
  const valid = caN > 0 && albN > 0 && !checkRange("caMgDl", caN) && !checkRange("albGDl", albN);
  const corrected = valid ? correctedCalcium(caN, albN) : null;
  return (
    <Card
      title="Corrected calcium"
      description="Adjust total calcium for hypoalbuminemia — 0.8 mg/dL per 1 g/dL of albumin below 4.0."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Total calcium" htmlFor="ca-ca" hint="mg/dL">
          <input id="ca-ca" type="number" step="any" inputMode="decimal" className={inputClass} value={ca} onChange={(e) => setCa(e.target.value)} />
        </Field>
        <Field label="Serum albumin" htmlFor="ca-alb" hint="g/dL">
          <input id="ca-alb" type="number" step="any" inputMode="decimal" className={inputClass} value={alb} onChange={(e) => setAlb(e.target.value)} />
        </Field>
      </div>
      {corrected !== null ? (
        <div className="mt-4">
          <ToolStat
            label="Corrected calcium"
            value={corrected.toFixed(2)}
            unit="mg/dL"
            sub={corrected > 10.4 ? "Above the upper reference limit — investigate." : "Within the usual adult reference range."}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Enter both values to compute the correction.</p>
      )}
    </Card>
  );
}

/* -------------------------------------------------------- iron tool -- */

function IronTool() {
  const [iron, setIron] = useState("60");
  const [tibc, setTibc] = useState("300");
  const [weight, setWeight] = useState("70");
  const [targetHb, setTargetHb] = useState("12");
  const [hb, setHb] = useState("9");
  const ironN = Number(iron);
  const tibcN = Number(tibc);
  const weightN = Number(weight);
  const targetN = Number(targetHb);
  const hbN = Number(hb);
  const sat = ironN > 0 && tibcN > 0 && !checkRange("ironUgDl", ironN) && !checkRange("tibcUgDl", tibcN) ? tsat(ironN, tibcN) : null;
  const deficit = weightN > 0 && targetN > hbN && hbN > 0 && !checkRange("weightKg", weightN) && !checkRange("hbGDl", hbN) && !checkRange("hbGDl", targetN) ? ganzoniIronDeficit(weightN, targetN, hbN) : null;
  return (
    <Card
      title="Iron status"
      description="Transferrin saturation and the Ganzoni deficit estimate for iron replacement planning."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Serum iron" htmlFor="fe-iron" hint="µg/dL">
          <input id="fe-iron" type="number" step="any" inputMode="decimal" className={inputClass} value={iron} onChange={(e) => setIron(e.target.value)} />
        </Field>
        <Field label="TIBC" htmlFor="fe-tibc" hint="µg/dL">
          <input id="fe-tibc" type="number" step="any" inputMode="decimal" className={inputClass} value={tibc} onChange={(e) => setTibc(e.target.value)} />
        </Field>
      </div>
      {sat !== null ? (
        <div className="mt-4">
          <ToolStat
            label="Transferrin saturation"
            value={sat.toFixed(1)}
            unit="%"
            sub={sat <= 30 ? "≤30% — KDIGO 2026 suggests considering IV iron (with ferritin ≤500 ng/mL)." : "Above the KDIGO re-evaluation threshold of 30%."}
          />
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Weight" htmlFor="fe-wt" hint="kg">
          <input id="fe-wt" type="number" step="any" inputMode="decimal" className={inputClass} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label="Target Hb" htmlFor="fe-tgt" hint="g/dL">
          <input id="fe-tgt" type="number" step="any" inputMode="decimal" className={inputClass} value={targetHb} onChange={(e) => setTargetHb(e.target.value)} />
        </Field>
        <Field label="Current Hb" htmlFor="fe-hb" hint="g/dL">
          <input id="fe-hb" type="number" step="any" inputMode="decimal" className={inputClass} value={hb} onChange={(e) => setHb(e.target.value)} />
        </Field>
      </div>
      {deficit !== null ? (
        <div className="mt-4">
          <ToolStat label="Ganzoni iron deficit" value={deficit.toFixed(0)} unit="mg" sub="Rough estimate — product-specific dosing tables still apply." />
        </div>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------- sodium tool */

function SodiumTool() {
  const [na, setNa] = useState("120");
  const [weight, setWeight] = useState("70");
  const [sex, setSex] = useState<Sex>("female");
  const [infusate, setInfusate] = useState<keyof typeof INFUSATE_NA>("halfNormal");
  const naN = Number(na);
  const weightN = Number(weight);
  const valid = naN > 0 && weightN > 0 && !checkRange("naMEqL", naN) && !checkRange("weightKg", weightN);
  const delta = valid ? adrogueMadias(naN, INFUSATE_NA[infusate], weightN, sex) : null;
  const hoursTo8 = delta && delta > 0 ? Math.min(Math.ceil(10 / delta), 20) : null;
  return (
    <Card
      title="Sodium correction (Adrogué–Madias)"
      description="Expected serum sodium change per liter of a chosen infusate, and how long a 10 mEq/L correction takes at the ≤0.5 mEq/L/h safety limit."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Serum sodium" htmlFor="na-na" hint="mEq/L">
          <input id="na-na" type="number" step="any" inputMode="decimal" className={inputClass} value={na} onChange={(e) => setNa(e.target.value)} />
        </Field>
        <Field label="Weight" htmlFor="na-wt" hint="kg">
          <input id="na-wt" type="number" step="any" inputMode="decimal" className={inputClass} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label="Sex / TBW" htmlFor="na-sex">
          <select id="na-sex" className={inputClass} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="female">Female · 0.5</option>
            <option value="male">Male · 0.6</option>
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Infusate" htmlFor="na-inf">
          <select id="na-inf" className={inputClass} value={infusate} onChange={(e) => setInfusate(e.target.value as keyof typeof INFUSATE_NA)}>
            <option value="d5w">D5W · 0 mEq/L</option>
            <option value="halfNormal">0.45% saline · 77 mEq/L</option>
            <option value="normal">0.9% saline · 154 mEq/L</option>
            <option value="hypertonic3">3% saline · 513 mEq/L</option>
          </select>
        </Field>
      </div>
      {delta !== null ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ToolStat
            label="Δ Na⁺ per liter"
            value={delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
            unit="mEq/L"
            sub="Change per liter of infusate infused."
          />
          {delta > 0 ? (
            <ToolStat
              label="Time for 10 mEq/L rise"
              value={hoursTo8 !== null ? `${hoursTo8} h` : "—"}
              unit="minimum"
              sub="At the ≤0.5 mEq/L/h ceiling; slower is safer (8 mEq/L/day is the conventional cap)."
            />
          ) : (
            <div className="rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 px-4 py-3 text-xs text-muted">
              Infusate sodium is below serum sodium — this infusate would lower serum Na⁺.
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Enter sodium and weight to see the correction rate.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Adrogué HJ, Madias NE. N Engl J Med 2000;342:1581–9. Never correct hyponatremia faster than 8–10 mEq/L per day — osmotic demyelination is irreversible.
      </p>
    </Card>
  );
}

/* ---------------------------------------------------------- FENa tool */

function FenaTool() {
  const [uNa, setUNa] = useState("40");
  const [scr, setScr] = useState("1.2");
  const [sNa, setSNa] = useState("138");
  const [uCr, setUCr] = useState("80");
  const uNaN = Number(uNa);
  const scrN = Number(scr);
  const sNaN = Number(sNa);
  const uCrN = Number(uCr);
  const valid = uNaN > 0 && scrN > 0 && sNaN > 0 && uCrN > 0 && !checkRange("naMEqL", uNaN) && !checkRange("naMEqL", sNaN) && !checkRange("scrMgDl", scrN) && !checkRange("uCrMgDl", uCrN);
  const fen = valid ? feNa(uNaN, scrN, sNaN, uCrN) : null;
  return (
    <Card
      title="Fractional excretion of sodium"
      description="FENa distinguishes prerenal azotemia from intrinsic acute kidney injury in oliguric patients."
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Urine Na⁺" htmlFor="fen-una" hint="mEq/L">
          <input id="fen-una" type="number" step="any" inputMode="decimal" className={inputClass} value={uNa} onChange={(e) => setUNa(e.target.value)} />
        </Field>
        <Field label="Serum Cr" htmlFor="fen-scr" hint="mg/dL">
          <input id="fen-scr" type="number" step="any" inputMode="decimal" className={inputClass} value={scr} onChange={(e) => setScr(e.target.value)} />
        </Field>
        <Field label="Serum Na⁺" htmlFor="fen-sna" hint="mEq/L">
          <input id="fen-sna" type="number" step="any" inputMode="decimal" className={inputClass} value={sNa} onChange={(e) => setSNa(e.target.value)} />
        </Field>
        <Field label="Urine Cr" htmlFor="fen-ucr" hint="mg/dL">
          <input id="fen-ucr" type="number" step="any" inputMode="decimal" className={inputClass} value={uCr} onChange={(e) => setUCr(e.target.value)} />
        </Field>
      </div>
      {fen !== null ? (
        <div className="mt-4">
          <ToolStat
            label="FENa"
            value={`${fen.toFixed(1)}%`}
            sub={fen < 1 ? "<1% — favors prerenal (also true in contrast nephropathy and glomerulonephritis)." : fen > 2 ? ">2% — favors intrinsic AKI (especially with diuretics)." : "1–2% — indeterminate; diuretics raise FENa."}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Enter all four values to compute FENa.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        FENa = (uNa × sCr) ÷ (sNa × uCr) × 100. Values lose discrimination in patients on diuretics — consider FEUrea (&lt;35% favors prerenal).
      </p>
    </Card>
  );
}

/* ------------------------------------------------------ dosing table -- */

function DosingTable() {
  const [egfr, setEgfr] = useState("42");
  const egfrN = Number(egfr);
  const rows = egfrN > 0 && egfrN <= 150 ? dosingByEgfr(egfrN) : null;
  return (
    <Card
      title="Nephro-active drug dosing by eGFR"
      description="Educational reference from KDIGO 2024 Chapter 4 and FDA labeling. Enter a patient's eGFR to filter the guidance."
    >
      <div className="mb-4 max-w-xs">
        <Field label="Patient eGFR" htmlFor="dose-egfr" hint="mL/min/1.73 m²">
          <input id="dose-egfr" type="number" min={1} max={150} step="any" inputMode="decimal" className={inputClass} value={egfr} onChange={(e) => setEgfr(e.target.value)} placeholder="e.g. 42" />
        </Field>
      </div>
      {rows ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Dosing guidance by eGFR</caption>
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Drug</th>
                <th scope="col" className="px-3 py-2 font-medium">eGFR</th>
                <th scope="col" className="px-3 py-2 font-medium">Guidance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.drug}>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">{row.drug}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted whitespace-nowrap">{row.egfrRange}</td>
                  <td className="px-3 py-2.5 text-muted">{row.guidance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">Enter a physiological eGFR (1–150) to see dosing guidance.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Reference only — always verify against the current label and the prescribing clinician&apos;s judgment. This is not medical advice.
      </p>
    </Card>
  );
}

/* --------------------------------------------------------------- page -- */

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p
          className="eyebrow"
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            lineHeight: 1.4,
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          Clinical utilities
        </p>
        <h1
          className="display-1 text-balance"
          style={{
            margin: "0.875rem 0 0",
            fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            fontWeight: 700,
            color: "var(--text)",
            textWrap: "balance",
          }}
        >
          Clinical toolbox
        </h1>
        <div
          className="rule"
          aria-hidden="true"
          style={{
            height: "1px",
            margin: "1.5rem 0 1.25rem",
            background: "var(--border-strong)",
            border: 0,
          }}
        />
        <SectionIntro>
          Quick, published-equation tools for everyday kidney workup — spot urine ACR, anion gap,
          calcium correction, iron status, sodium correction, FENa, and eGFR-based dosing. Every
          result is computed client-side from a cited formula; nothing is randomized or AI-generated.
        </SectionIntro>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AcrTool />
        <AnionGapTool />
        <CalciumTool />
        <IronTool />
        <SodiumTool />
        <FenaTool />
      </div>

      <DosingTable />
    </div>
  );
}
