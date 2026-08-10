/**
 * Validated nephrology equations. No "AI", no training, no randomness.
 * Every constant below is from a published source, cited inline.
 */

export type Sex = "male" | "female";

/* ---------------------------------------------------------------- units -- */

/** Serum creatinine umol/L -> mg/dL (molar mass 88.4). */
export const scrToMgDl = (umolL: number) => umolL / 88.4;
/** uACR mg/mmol -> mg/g (KDIGO conversion factor 8.84). */
export const acrToMgG = (mgMmol: number) => mgMmol * 8.84;

/* ------------------------------------------------------------- CKD-EPI -- */

/**
 * CKD-EPI 2021 creatinine equation (race-free).
 * Inker LA et al. N Engl J Med 2021;385:1737-49.
 * eGFR = 142 * min(Scr/k,1)^a * max(Scr/k,1)^-1.200 * 0.9938^age * 1.012 [female]
 * Source: National Kidney Foundation, kidney.org/ckd-epi-creatinine-equation-2021
 */
export function egfrCkdEpi2021(scrMgDl: number, age: number, sex: Sex): number {
  if (!(scrMgDl > 0) || !(age > 0)) throw new Error("scr and age must be > 0");
  const k = sex === "female" ? 0.7 : 0.9;
  const a = sex === "female" ? -0.241 : -0.302;
  const ratio = scrMgDl / k;
  return (
    142 *
    Math.pow(Math.min(ratio, 1), a) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) *
    (sex === "female" ? 1.012 : 1)
  );
}

/**
 * Cockcroft-Gault creatinine clearance (mL/min), for drug dosing.
 * Cockcroft DW, Gault MH. Nephron 1976;16:31-41.
 * Uses the weight the prescriber selects; ideal/adjusted body weight is
 * conventional when BMI is high. ponytail: caller owns the weight choice.
 */
export function cockcroftGault(
  age: number,
  weightKg: number,
  scrMgDl: number,
  sex: Sex,
): number {
  if (!(scrMgDl > 0)) throw new Error("scr must be > 0");
  return (((140 - age) * weightKg) / (72 * scrMgDl)) * (sex === "female" ? 0.85 : 1);
}

/* ---------------------------------------------------------------- KDIGO -- */

export type GfrStage = "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5";
export type AlbStage = "A1" | "A2" | "A3";
export type RiskLevel = "low" | "moderate" | "high" | "very-high";

/** KDIGO 2012/2024 GFR categories (mL/min/1.73 m2). */
export function gfrStage(egfr: number): GfrStage {
  if (egfr >= 90) return "G1";
  if (egfr >= 60) return "G2";
  if (egfr >= 45) return "G3a";
  if (egfr >= 30) return "G3b";
  if (egfr >= 15) return "G4";
  return "G5";
}

/** KDIGO albuminuria categories by uACR in mg/g. */
export function albStage(acrMgG: number): AlbStage {
  if (acrMgG < 30) return "A1";
  if (acrMgG <= 300) return "A2";
  return "A3";
}

/** KDIGO "heat map" of prognosis by GFR and albuminuria category. */
const HEATMAP: Record<GfrStage, Record<AlbStage, RiskLevel>> = {
  G1: { A1: "low", A2: "moderate", A3: "high" },
  G2: { A1: "low", A2: "moderate", A3: "high" },
  G3a: { A1: "moderate", A2: "high", A3: "very-high" },
  G3b: { A1: "high", A2: "very-high", A3: "very-high" },
  G4: { A1: "very-high", A2: "very-high", A3: "very-high" },
  G5: { A1: "very-high", A2: "very-high", A3: "very-high" },
};

export const kdigoRisk = (g: GfrStage, a: AlbStage): RiskLevel => HEATMAP[g][a];

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderately increased risk",
  high: "High risk",
  "very-high": "Very high risk",
};

/* ----------------------------------------------------------------- KFRE -- */

/**
 * 4-variable Kidney Failure Risk Equation.
 * Tangri N et al. JAMA 2011;305:1553-9 (derivation)
 * Tangri N et al. JAMA 2016;315:164-74 (multinational recalibration)
 *
 * L = -0.2201*(age/10 - 7.036) + 0.2467*(male - 0.5642)
 *     - 0.5567*(eGFR/5 - 7.222) + 0.4510*(ln(uACR mg/g) - 5.137)
 * Risk = 1 - S0^exp(L)
 *
 * Baseline survival differs by region; using the wrong one materially
 * overestimates risk outside North America.
 */
const KFRE_S0 = {
  northAmerica: { 2: 0.9751, 5: 0.924 },
  other: { 2: 0.9832, 5: 0.9365 },
} as const;

export type Region = keyof typeof KFRE_S0;

export function kfre(opts: {
  age: number;
  sex: Sex;
  egfr: number;
  acrMgG: number;
  region: Region;
}): { risk2yr: number; risk5yr: number } {
  const { age, sex, egfr, acrMgG, region } = opts;
  if (!(acrMgG > 0)) throw new Error("uACR must be > 0 (equation takes its log)");
  const L =
    -0.2201 * (age / 10 - 7.036) +
    0.2467 * ((sex === "male" ? 1 : 0) - 0.5642) +
    -0.5567 * (egfr / 5 - 7.222) +
    0.451 * (Math.log(acrMgG) - 5.137);
  const expL = Math.exp(L);
  const s0 = KFRE_S0[region];
  return {
    risk2yr: 1 - Math.pow(s0[2], expL),
    risk5yr: 1 - Math.pow(s0[5], expL),
  };
}

/** KFRE only applies to CKD G3-G5 in non-dialysis, non-transplant adults. */
export const kfreApplies = (egfr: number) => egfr < 60;

/* ------------------------------------------------------------------ BSA -- */

/** Du Bois & Du Bois 1916. */
export const bsaDuBois = (h: number, w: number) =>
  0.007184 * Math.pow(h, 0.725) * Math.pow(w, 0.425);
/** Mosteller RD. N Engl J Med 1987;317:1098. */
export const bsaMosteller = (h: number, w: number) => Math.sqrt((h * w) / 3600);

/* ------------------------------------------------------------------ AKI -- */

export type AkiStage = 0 | 1 | 2 | 3;

/**
 * KDIGO 2012 AKI staging by creatinine and urine output; the higher of the
 * two criteria wins.
 */
export function akiStage(opts: {
  scrMgDl: number;
  baselineScrMgDl?: number;
  urineOutputMlKgH?: number;
  oliguriaHours?: number;
}): AkiStage {
  const { scrMgDl, baselineScrMgDl, urineOutputMlKgH, oliguriaHours = 0 } = opts;
  let byScr: AkiStage = 0;
  if (baselineScrMgDl && baselineScrMgDl > 0) {
    const ratio = scrMgDl / baselineScrMgDl;
    if (scrMgDl >= 4.0 || ratio >= 3.0) byScr = 3;
    else if (ratio >= 2.0) byScr = 2;
    else if (ratio >= 1.5 || scrMgDl - baselineScrMgDl >= 0.3) byScr = 1;
  }
  let byUo: AkiStage = 0;
  if (urineOutputMlKgH !== undefined) {
    if (urineOutputMlKgH < 0.3 && oliguriaHours >= 24) byUo = 3;
    else if (urineOutputMlKgH < 0.5 && oliguriaHours >= 12) byUo = 2;
    else if (urineOutputMlKgH < 0.5 && oliguriaHours >= 6) byUo = 1;
  }
  return Math.max(byScr, byUo) as AkiStage;
}

/* -------------------------------------------------------------- guidance -- */

/** Deterministic, guideline-derived guidance. Not generated text. */
export function guidance(r: {
  egfr: number;
  acrMgG: number;
  risk: RiskLevel;
  kfre2?: number;
}): string[] {
  const out: string[] = [];
  if (r.egfr < 60 || r.acrMgG >= 30)
    out.push("Confirm chronicity: repeat eGFR and uACR at >=3 months before diagnosing CKD.");
  if (r.acrMgG >= 30)
    out.push("ACE inhibitor or ARB titrated to the maximum tolerated dose (KDIGO 2024).");
  if (r.egfr >= 20 && r.acrMgG >= 200)
    out.push("SGLT2 inhibitor indicated for albuminuric CKD (eGFR >= 20).");
  if (r.risk === "low") out.push("Annual eGFR and uACR monitoring is sufficient.");
  if (r.risk === "moderate") out.push("Monitor eGFR and uACR at least annually.");
  if (r.risk === "high") out.push("Monitor at least twice yearly; nephrology referral advised.");
  if (r.risk === "very-high")
    out.push("Monitor at least three times yearly; nephrology referral indicated.");
  if (r.kfre2 !== undefined && r.kfre2 >= 0.4)
    out.push("2-year risk >= 40%: begin dialysis access planning and transplant work-up.");
  else if (r.kfre2 !== undefined && r.kfre2 >= 0.05)
    out.push("2-year risk >= 5%: refer to nephrology (commonly used referral threshold).");
  out.push("Avoid NSAIDs; review and renally dose all medications.");
  return out;
}
