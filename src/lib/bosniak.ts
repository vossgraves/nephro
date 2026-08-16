/**
 * Bosniak v2019 classification for cystic renal masses (CT/MRI).
 * Pure decision logic, extracted from the imaging workspace so it can be
 * unit-tested and reused. Educational aid only — never a diagnosis.
 *
 * Reference: Bosniak MA et al. Radiology 2019;292:475–488.
 */

export const BOSNIAK_FEATURES = [
  { id: "thin-wall", label: "Mass is a simple fluid-attenuating cyst (thin, non-enhancing wall)" },
  { id: "thin-septa", label: "Only thin (≤2 mm) septa, no enhancement" },
  { id: "few-septa", label: "Few (1–3) thin septa with possible perceived enhancement" },
  { id: "many-septa", label: "Multiple (≥4) septa or minimally thickened smooth walls/septa" },
  { id: "nodule", label: "Enhancing soft-tissue nodule or irregular thickening (≥4 mm)" },
  { id: "irregular", label: "Grossly irregular walls, or thick enhancing irregular septa" },
  { id: "solid", label: "Clearly enhancing solid mass" },
] as const;

export type BosniakFeatureId = (typeof BOSNIAK_FEATURES)[number]["id"];

export type BosniakResult = { klass: string; note: string };

/** Returns the strictest applicable Bosniak class, or null when nothing is selected. */
export function bosniakClass(selected: ReadonlySet<string>): BosniakResult | null {
  if (selected.size === 0) return null;
  if (selected.has("solid")) return { klass: "IV", note: "Clearly enhancing solid mass — malignant until proven otherwise." };
  if (selected.has("nodule") || selected.has("irregular")) return { klass: "III", note: "Indeterminate, suspicious — surgical consultation recommended." };
  if (selected.has("many-septa")) return { klass: "IIF", note: "Minimally complex — follow-up imaging advised." };
  if (selected.has("thin-septa") || selected.has("few-septa")) return { klass: "II", note: "Minimally complex benign — routine follow-up." };
  if (selected.has("thin-wall")) return { klass: "I", note: "Simple cyst — benign." };
  return { klass: "I–II", note: "Check your findings; the checklist maps to Bosniak v2019." };
}
