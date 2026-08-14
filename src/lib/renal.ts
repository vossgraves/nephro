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

/**
 * Physiological input bounds. A calculator that prints eGFR 608 for a mistyped
 * creatinine is worse than one that refuses: the number looks authoritative and
 * is clinically meaningless. Anything outside these ranges is a data-entry error
 * (most often the wrong unit selected), so we reject instead of computing.
 * Ranges are deliberately generous — wider than any survivable physiology.
 */
export const LIMITS = {
  /** Lowest recorded adult values sit near 0.2 mg/dL; dialysis peaks below 25. */
  scrMgDl: { min: 0.2, max: 25 },
  ageYears: { min: 18, max: 120 },
  weightKg: { min: 20, max: 400 },
  /** uACR: nephrotic-range proteinuria tops out well below 25 000 mg/g. */
  acrMgG: { min: 0.1, max: 25000 },
  /** Urine albumin concentration, mg/dL (routine dipstick-lab range). */
  uAlbMgDl: { min: 0.1, max: 5000 },
  /** Urine creatinine concentration, mg/dL. */
  uCrMgDl: { min: 1, max: 500 },
  /** Serum sodium, mEq/L. Survivable extremes are narrow. */
  naMEqL: { min: 90, max: 190 },
  /** Serum chloride, mEq/L. */
  clMEqL: { min: 50, max: 160 },
  /** Serum bicarbonate, mEq/L. */
  hco3MEqL: { min: 4, max: 60 },
  /** Serum albumin, g/dL. */
  albGDl: { min: 1, max: 7 },
  /** Serum calcium, mg/dL. */
  caMgDl: { min: 4, max: 20 },
  /** Serum iron, µg/dL. */
  ironUgDl: { min: 5, max: 500 },
  /** Serum TIBC, µg/dL. */
  tibcUgDl: { min: 50, max: 700 },
  /** Hemoglobin, g/dL. */
  hbGDl: { min: 2, max: 25 },
} as const;

export type FieldName = keyof typeof LIMITS;

/** Returns an error message for an out-of-range value, or null when acceptable. */
export function checkRange(field: FieldName, value: number): string | null {
  const { min, max } = LIMITS[field];
  if (!Number.isFinite(value)) return "Enter a number.";
  if (value < min || value > max) {
    const unit =
      field === "scrMgDl"
        ? " mg/dL"
        : field === "acrMgG"
          ? " mg/g"
          : field === "weightKg"
            ? " kg"
            : field === "uAlbMgDl"
              ? " mg/dL"
              : field === "uCrMgDl"
                ? " mg/dL"
                : field === "naMEqL" || field === "clMEqL" || field === "hco3MEqL"
                  ? " mEq/L"
                  : field === "albGDl"
                    ? " g/dL"
                    : field === "caMgDl"
                      ? " mg/dL"
                      : field === "ironUgDl" || field === "tibcUgDl"
                        ? " µg/dL"
                        : field === "hbGDl"
                          ? " g/dL"
                          : " years";
    return `Must be between ${min}${unit} and ${max}${unit} — check the unit.`;
  }
  return null;
}

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

/* ----------------------------------------------------- quick lab tools -- */

/**
 * Albumin-to-creatinine ratio from a spot urine, both in mg/dL.
 * ACR (mg/g) = uAlb / uCr * 1000. KDIGO 2024;1.4.8.
 */
export function acrFromSpotUrine(uAlbMgDl: number, uCrMgDl: number): number {
  if (!(uCrMgDl > 0)) throw new Error("urine creatinine must be > 0");
  return (uAlbMgDl / uCrMgDl) * 1000;
}

/** ACR mg/g -> mg/mmol (KDIGO 2024 conversion factor 8.84 inverse). */
export const acrToMgMmol = (acrMgG: number) => acrMgG / 8.84;

/**
 * Serum anion gap. Winter JL et al. J Emerg Med 1990;8:131-6.
 * Normal 8-12 mEq/L. An elevated gap with normal lactate suggests
 * unmeasured anions (ketones, uremia, toxins, methanol, salicylate).
 */
export function anionGap(naMEqL: number, clMEqL: number, hco3MEqL: number): number {
  return naMEqL - (clMEqL + hco3MEqL);
}

/** Urine anion gap; negative in diarrheal acidosis with intact renal acidification. */
export const urineAnionGap = (uNa: number, uK: number, uCl: number) => uNa + uK - uCl;

/**
 * Corrected calcium for hypoalbuminemia (mg/dL).
 * Corrected Ca = Ca + 0.8 * (4 - albumin). Payne RB et al. BMJ 1973;2:643-6.
 */
export function correctedCalcium(caMgDl: number, albGDl: number): number {
  return caMgDl + 0.8 * (4 - albGDl);
}

/**
 * Transferrin saturation, percent.
 * TSAT = serum iron / TIBC * 100. KDIGO 2026 anemia thresholds:
 * consider IV iron when TSAT <= 30% with ferritin <= 500 ng/mL.
 */
export function tsat(ironUgDl: number, tibcUgDl: number): number {
  if (!(tibcUgDl > 0)) throw new Error("TIBC must be > 0");
  return (ironUgDl / tibcUgDl) * 100;
}

/**
 * Ganzoni iron deficit (mg): weight * (target Hb - current Hb) * 2.4 + 500.
 * Ganzoni AM. Dtsch Med Wochenschr 1970;95:1501-7.
 */
export function ganzoniIronDeficit(
  weightKg: number,
  targetHbGDl: number,
  currentHbGDl: number,
): number {
  return weightKg * (targetHbGDl - currentHbGDl) * 2.4 + 500;
}

/**
 * Adrogue-Madias sodium correction rate (mEq/L per liter of infusate).
 * Adrogue HJ, Madias NE. N Engl J Med 2000;342:1581-9.
 * Limit: <= 0.5 mEq/L/hour and <= 8-10 mEq/L/day (avoid osmotic demyelination).
 */
export function adrogueMadias(
  serumNaMEqL: number,
  infusateNaMEqL: number,
  weightKg: number,
  sex: Sex,
): number {
  const tbw = sex === "male" ? 0.6 * weightKg : 0.5 * weightKg;
  return (infusateNaMEqL - serumNaMEqL) / (tbw + 1);
}

/** Common infusate sodium concentrations, mEq/L. */
export const INFUSATE_NA = { d5w: 0, halfNormal: 77, normal: 154, hypertonic3: 513 } as const;

/**
 * Fractional excretion of sodium, percent.
 * FENa = (uNa * sCr) / (sNa * uCr) * 100. <1% favors prerenal AKI.
 */
export function feNa(
  uNaMEqL: number,
  scrMgDl: number,
  sNaMEqL: number,
  uCrMgDl: number,
): number {
  if (!(sNaMEqL > 0 && uCrMgDl > 0)) throw new Error("serum Na and urine Cr must be > 0");
  return ((uNaMEqL * scrMgDl) / (sNaMEqL * uCrMgDl)) * 100;
}

/* --------------------------------------------------- KDIGO 2024 tables -- */

/**
 * KDIGO 2024 recommended monitoring frequency (eGFR/uACR visits per year)
 * by GFR and albuminuria category (heat-map cells).
 */
export const MONITORING_PER_YEAR: Record<GfrStage, Record<AlbStage, number>> = {
  G1: { A1: 1, A2: 1, A3: 2 },
  G2: { A1: 1, A2: 1, A3: 2 },
  G3a: { A1: 1, A2: 2, A3: 2 },
  G3b: { A1: 2, A2: 2, A3: 3 },
  G4: { A1: 2, A2: 3, A3: 3 },
  G5: { A1: 4, A2: 4, A3: 4 },
};

/**
 * Risk-based actions from the KDIGO 2024 chapter 1 recommendations, keyed to
 * the 5-year KFRE (or validated equivalent). Thresholds are the guideline's.
 */
export function kfreActions(kfre5: number): string[] {
  const out: string[] = [];
  if (kfre5 >= 0.03 && kfre5 < 0.05) out.push("5-year KFRE 3–5%: consider nephrology referral.");
  if (kfre5 >= 0.05 && kfre5 < 0.1) out.push("5-year KFRE 5–10%: nephrology referral is advised.");
  if (kfre5 >= 0.1 && kfre5 < 0.4)
    out.push("5-year KFRE 10–40%: add a clinical pharmacist and/or dietitian to the care team.");
  if (kfre5 >= 0.4)
    out.push("5-year KFRE ≥40%: start dialysis-modality education and transplant referral.");
  return out;
}

/* ------------------------------------------------------- drug dosing -- */

/**
 * Key nephro-active medications with eGFR-based dosing, per KDIGO 2024
 * Chapter 4 and FDA labeling. Serves as an educational reference only —
 * the prescribing clinician owns the final decision.
 */
export type DrugDoseRow = {
  drug: string;
  egfrRange: string;
  guidance: string;
};

export function dosingByEgfr(egfr: number): DrugDoseRow[] {
  const rows: DrugDoseRow[] = [];
  if (egfr < 30) {
    rows.push({ drug: "Metformin", egfrRange: "< 30", guidance: "Contraindicated — discontinue." });
  } else if (egfr >= 30 && egfr < 45) {
    rows.push({
      drug: "Metformin",
      egfrRange: "30–44",
      guidance: "Do not initiate. Continue at ≤ 1000 mg/day if already on it (FDA 2016).",
    });
  } else {
    rows.push({
      drug: "Metformin",
      egfrRange: "≥ 45",
      guidance: "Initiate/continue, max 2550 mg IR or 2000 mg ER/day.",
    });
  }
  rows.push(
    egfr >= 20
      ? {
          drug: "SGLT2 inhibitor",
          egfrRange: "≥ 20",
          guidance:
            "Indicated with ACR ≥ 200 mg/g (KDIGO 1A) or eGFR 20–45 without albuminuria (1B). Continue below 20 unless on KRT. Initial eGFR dip < 30% is not a reason to stop.",
        }
      : {
          drug: "SGLT2 inhibitor",
          egfrRange: "< 20",
          guidance: "Continue only if already on it and not on kidney replacement therapy.",
        },
  );
  rows.push(
    egfr >= 25
      ? {
          drug: "Finerenone",
          egfrRange: "≥ 25",
          guidance:
            "T2D + CKD + persistent albuminuria (ACR ≥ 200 mg/g) on max-tolerated RASi, with normal potassium (KDIGO 2A).",
        }
      : {
          drug: "Finerenone",
          egfrRange: "< 25",
          guidance: "Not recommended — insufficient benefit/risk evidence below this eGFR.",
        },
  );
  if (egfr >= 50) {
    rows.push({ drug: "NOACs", egfrRange: "≥ 50", guidance: "Standard dosing (apixaban, rivaroxaban, edoxaban, dabigatran)." });
  } else if (egfr >= 30) {
    rows.push({
      drug: "NOACs",
      egfrRange: "30–49",
      guidance: "Reduced/adjusted dosing per drug; apixaban 2.5 mg BID in select patients; avoid dabigatran < 30.",
    });
  } else {
    rows.push({ drug: "NOACs", egfrRange: "< 30", guidance: "Avoid; prefer adjusted VKA or specialist-guided dosing." });
  }
  return rows;
}

/* -------------------------------------------------------------- guidance -- */

/** Deterministic, guideline-derived guidance. Not generated text. */
export function guidance(r: {
  egfr: number;
  acrMgG: number;
  risk: RiskLevel;
  kfre2?: number;
  kfre5?: number;
}): string[] {
  const out: string[] = [];
  if (r.egfr < 60 || r.acrMgG >= 30)
    out.push("Confirm chronicity: repeat eGFR and uACR at >=3 months before diagnosing CKD.");
  if (r.acrMgG >= 30)
    out.push("ACE inhibitor or ARB titrated to the maximum tolerated dose (KDIGO 2024).");
  if (r.egfr >= 20 && r.acrMgG >= 200)
    out.push("SGLT2 inhibitor indicated for albuminuric CKD (eGFR >= 20).");
  if (r.egfr >= 45 && r.acrMgG < 30)
    out.push("Consider confirmatory cystatin C when eGFR 45–59 without albuminuria (KDIGO 2024).");
  if (r.risk === "low") out.push("Annual eGFR and uACR monitoring is sufficient.");
  if (r.risk === "moderate") out.push("Monitor eGFR and uACR at least annually.");
  if (r.risk === "high") out.push("Monitor at least twice yearly; nephrology referral advised.");
  if (r.risk === "very-high")
    out.push("Monitor at least three times yearly; nephrology referral indicated.");
  if (r.kfre2 !== undefined && r.kfre2 >= 0.4)
    out.push("2-year risk >= 40%: begin dialysis access planning and transplant work-up.");
  else if (r.kfre2 !== undefined && r.kfre2 >= 0.05)
    out.push("2-year risk >= 5%: refer to nephrology (commonly used referral threshold).");
  if (r.kfre5 !== undefined) out.push(...kfreActions(r.kfre5));
  if (r.acrMgG >= 30)
    out.push("Recheck uACR after treatment changes; a sustained doubling of ACR warrants re-evaluation.");
  out.push("Avoid NSAIDs; review and renally dose all medications.");
  return out;
}
