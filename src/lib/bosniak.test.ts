/** Run: npx tsx src/lib/bosniak.test.ts */
import assert from "node:assert/strict";
import type { BosniakFeatureId } from "./bosniak";
import { BOSNIAK_FEATURES, bosniakClass } from "./bosniak";

const set = (...ids: string[]) => new Set(ids);

/* ---- empty selection ------------------------------------------------------ */
assert.equal(bosniakClass(new Set()), null, "no features selected -> null");

/* ---- every single feature maps to its own class (never the fallback) ------ */
const single: Record<BosniakFeatureId, string> = {
  "thin-wall": "I",
  "thin-septa": "II",
  "few-septa": "II",
  "many-septa": "IIF",
  nodule: "III",
  irregular: "III",
  solid: "IV",
};
for (const feature of BOSNIAK_FEATURES) {
  const result = bosniakClass(set(feature.id));
  assert.ok(result, `${feature.id} alone must classify`);
  assert.equal(result.klass, single[feature.id], `single ${feature.id} -> ${single[feature.id]}`);
  assert.ok(result.note.trim().length > 0, `single ${feature.id} must carry a note`);
}

/* ---- same-tier combinations stay in tier ---------------------------------- */
assert.equal(bosniakClass(set("thin-septa", "few-septa"))?.klass, "II");
assert.equal(bosniakClass(set("nodule", "irregular"))?.klass, "III");

/* ---- precedence: solid > nodule/irregular > many-septa > thin/few septa > thin-wall */
assert.equal(bosniakClass(set("solid", "nodule"))?.klass, "IV");
assert.equal(bosniakClass(set("solid", "many-septa", "thin-septa", "thin-wall"))?.klass, "IV");
assert.equal(bosniakClass(set("nodule", "many-septa"))?.klass, "III");
assert.equal(bosniakClass(set("irregular", "few-septa", "thin-wall"))?.klass, "III");
assert.equal(bosniakClass(set("many-septa", "few-septa", "thin-septa"))?.klass, "IIF");
assert.equal(bosniakClass(set("many-septa", "thin-wall"))?.klass, "IIF");
assert.equal(bosniakClass(set("few-septa", "thin-wall"))?.klass, "II");
assert.equal(bosniakClass(set("thin-septa", "thin-wall"))?.klass, "II");

// Full checklist: strictest class wins.
assert.equal(bosniakClass(set("solid", "nodule", "irregular", "many-septa", "few-septa", "thin-septa", "thin-wall"))?.klass, "IV");
assert.equal(bosniakClass(set("nodule", "many-septa", "thin-septa", "thin-wall"))?.klass, "III");

/* ---- fallback: selected ids that match nothing ---------------------------- */
const unknown = bosniakClass(set("not-a-feature"));
assert.ok(unknown);
assert.equal(unknown.klass, "I\u2013II", "unknown ids fall back to the check-your-findings class");

console.log("all Bosniak classification checks passed");