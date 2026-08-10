/** Run: npx tsx src/lib/renal.test.ts */
import assert from "node:assert/strict";
import {
  egfrCkdEpi2021,
  cockcroftGault,
  gfrStage,
  albStage,
  kdigoRisk,
  kfre,
  bsaMosteller,
  bsaDuBois,
  akiStage,
  scrToMgDl,
  acrToMgG,
  checkRange,
  LIMITS,
} from "./renal";

const near = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ~${b}`);

// CKD-EPI 2021, hand-computed from the published formula.
// Female, 50y, Scr 1.2 -> ratio 1.714 > 1 so max-branch only.
near(egfrCkdEpi2021(1.2, 50, "female"), 55.15, 0.05, "CKD-EPI F 50y 1.2");
// Male, 60y, Scr 1.0 -> ratio 1.111.
near(egfrCkdEpi2021(1.0, 60, "male"), 86.16, 0.05, "CKD-EPI M 60y 1.0");
// Below kappa uses the alpha branch: female, 30y, Scr 0.6.
near(egfrCkdEpi2021(0.6, 30, "female"), 123.76, 0.05, "CKD-EPI F 30y 0.6");
// Female multiplier and kappa must actually differentiate the sexes.
assert.notEqual(egfrCkdEpi2021(1.0, 40, "male"), egfrCkdEpi2021(1.0, 40, "female"));
// Monotonic: higher creatinine must never raise eGFR.
for (let s = 0.4; s < 5; s += 0.1)
  assert.ok(egfrCkdEpi2021(s + 0.1, 55, "male") < egfrCkdEpi2021(s, 55, "male"));

// KFRE worked example (terican/renalcarematters, non-North-American S0):
// 60y male, eGFR 25, uACR 300 -> 5-year risk ~30.5%.
const k = kfre({ age: 60, sex: "male", egfr: 25, acrMgG: 300, region: "other" });
near(k.risk5yr, 0.3352, 0.002, "KFRE 5yr non-NA");
near(k.risk2yr, 0.1001, 0.002, "KFRE 2yr non-NA");
assert.ok(k.risk2yr < k.risk5yr, "2-year risk must be below 5-year risk");
// North American calibration must yield a strictly higher risk.
const kNA = kfre({ age: 60, sex: "male", egfr: 25, acrMgG: 300, region: "northAmerica" });
assert.ok(kNA.risk5yr > k.risk5yr, "NA calibration should exceed non-NA");
// Worse albuminuria and worse eGFR both raise risk.
assert.ok(
  kfre({ age: 60, sex: "male", egfr: 25, acrMgG: 900, region: "other" }).risk2yr > k.risk2yr,
);
assert.ok(
  kfre({ age: 60, sex: "male", egfr: 15, acrMgG: 300, region: "other" }).risk2yr > k.risk2yr,
);
assert.throws(() => kfre({ age: 60, sex: "male", egfr: 25, acrMgG: 0, region: "other" }));

// KDIGO staging boundaries.
assert.equal(gfrStage(90), "G1");
assert.equal(gfrStage(89.9), "G2");
assert.equal(gfrStage(45), "G3a");
assert.equal(gfrStage(44.9), "G3b");
assert.equal(gfrStage(29.9), "G4");
assert.equal(gfrStage(14.9), "G5");
assert.equal(albStage(29.9), "A1");
assert.equal(albStage(30), "A2");
assert.equal(albStage(300), "A2");
assert.equal(albStage(300.1), "A3");
assert.equal(kdigoRisk("G1", "A1"), "low");
assert.equal(kdigoRisk("G1", "A3"), "high");
assert.equal(kdigoRisk("G3a", "A1"), "moderate");
assert.equal(kdigoRisk("G3b", "A2"), "very-high");
assert.equal(kdigoRisk("G5", "A1"), "very-high");

// Cockcroft-Gault: 60y, 70kg, Scr 1.0. (140-60)*70/72 = 77.8; female x0.85.
near(cockcroftGault(60, 70, 1.0, "male"), 77.8, 0.2, "CG male");
near(cockcroftGault(60, 70, 1.0, "female"), 66.1, 0.2, "CG female");

// BSA: 180cm/75kg -> Mosteller sqrt(13500/3600)=1.936; Du Bois ~1.94.
near(bsaMosteller(180, 75), 1.936, 0.005, "Mosteller");
near(bsaDuBois(180, 75), 1.94, 0.02, "Du Bois");

// Unit conversions.
near(scrToMgDl(88.4), 1.0, 1e-9, "umol/L -> mg/dL");
near(acrToMgG(1), 8.84, 1e-9, "mg/mmol -> mg/g");

// KDIGO AKI staging, creatinine and urine-output criteria.
assert.equal(akiStage({ scrMgDl: 1.0, baselineScrMgDl: 1.0 }), 0);
assert.equal(akiStage({ scrMgDl: 1.3, baselineScrMgDl: 1.0 }), 1); // +0.3
assert.equal(akiStage({ scrMgDl: 2.1, baselineScrMgDl: 1.0 }), 2);
assert.equal(akiStage({ scrMgDl: 3.2, baselineScrMgDl: 1.0 }), 3);
assert.equal(akiStage({ scrMgDl: 4.5, baselineScrMgDl: 4.0 }), 3); // absolute >=4.0
// Urine output alone can stage, and the higher criterion wins.
assert.equal(akiStage({ scrMgDl: 1.0, urineOutputMlKgH: 0.4, oliguriaHours: 7 }), 1);
assert.equal(akiStage({ scrMgDl: 1.0, urineOutputMlKgH: 0.2, oliguriaHours: 24 }), 3);
assert.equal(
  akiStage({ scrMgDl: 1.3, baselineScrMgDl: 1.0, urineOutputMlKgH: 0.2, oliguriaHours: 24 }),
  3,
);

/* ---- input range guards ------------------------------------------------- */
// Regression: a creatinine of 0.02 mg/dL (a mistyped or wrong-unit value) used to
// produce eGFR 236-608 — an impossible number rendered with full confidence.
assert.ok(checkRange("scrMgDl", 0.02), "implausibly low creatinine must be rejected");
assert.ok(checkRange("scrMgDl", scrToMgDl(1.4)), "1.4 read as umol/L must be rejected");
assert.ok(checkRange("scrMgDl", 40), "implausibly high creatinine must be rejected");
assert.equal(checkRange("scrMgDl", 1.4), null, "a normal creatinine must pass");
assert.equal(checkRange("scrMgDl", scrToMgDl(124)), null, "124 umol/L is ~1.4 mg/dL");
// The equation must never be reachable with a value that yields a fantasy eGFR.
assert.ok(egfrCkdEpi2021(LIMITS.scrMgDl.min, 18, "female") < 400);
assert.ok(checkRange("ageYears", 4), "paediatric age is out of scope for CKD-EPI adult");
assert.ok(checkRange("acrMgG", 99999), "absurd uACR must be rejected");
assert.equal(checkRange("acrMgG", 180), null);
assert.equal(checkRange("weightKg", 70), null);

console.log("all renal equation checks passed");
