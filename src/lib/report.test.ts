/** Run: npx tsx src/lib/report.test.ts */
import assert from "node:assert/strict";
import type { ReportInput } from "./report";
import { buildReviewReport } from "./report";
import type { RecognitionReport } from "./imaging-recognition";
import type { ImageQualityMetrics } from "./image-quality";

const GEN = new Date("2026-08-16T09:34:23.535Z");
const CANONICAL_SAFETY_NOTE =
  "AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician.";

const QUALITY: ImageQualityMetrics = {
  score: 87,
  resolution: 92,
  contrast: 75,
  brightness: 81,
  noise: 60,
  visibility: 90,
  stats: {
    width: 1024,
    height: 768,
    meanLuminance: 125,
    stddevLuminance: 40,
    highFreqEnergy: 6,
    clippedFraction: 0.05,
    percentileSpread: 150,
  },
};

const REPORT: RecognitionReport = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  reviewStatus: "reviewable",
  summary: "Good contrast, minimal motion artifact.",
  imageQuality: { assessment: "Clear image.", limitations: ["Single slice view", "No volumetric data"] },
  observedVisualFeatures: [
    "Bilateral kidneys visible",
    "Normal parenchymal echogenicity pattern",
    "Possible stone in left renal pelvis",
  ],
  notAssessableFromThisImage: ["Renal function", "Degree of hydronephrosis"],
  clinicianQuestions: ["Any history of stone disease?", "Are ureteric jets visible on ultrasound?"],
  uncertainty: "Single image cannot determine clinical significance.",
  safetyNote: CANONICAL_SAFETY_NOTE,
};

/* ---- full input: deterministic snapshot ----------------------------------- */
const FULL: ReportInput = {
  modality: "ct-kub",
  generatedAt: GEN,
  fileName: "scan.png",
  imageInfo: { width: 1024, height: 768, sizeBytes: 421_888 },
  quality: QUALITY,
  report: REPORT,
  findingStates: [
    { text: "Bilateral kidneys visible", status: "confirmed" },
    { text: "Normal parenchymal echogenicity pattern", status: "edited", editedText: "Parenchyma appears homogeneous" },
    { text: "Possible stone in left renal pelvis", status: "rejected" },
  ],
  checklistSelections: [
    "Enhancing soft-tissue nodule or irregular thickening (\u22654 mm)",
    "Multiple (\u22654) septa or minimally thickened smooth walls/septa",
  ],
  measurements: [
    { label: "Distance", value: "1,234 px" },
    { label: "Area (ROI)", value: "56,789 px\u00b2" },
  ],
};

const FULL_SNAPSHOT = `# Imaging Review Report
- **Modality:** CT KUB (Kidney, Ureters, Bladder)
- **Generated:** 2026-08-16 09:34 UTC
- **File:** scan.png
- **Image:** 1024 × 768 (412 KB)

## Technical image-quality metrics — not clinical measurements
Overall technical score: 87/100
- Resolution: 92/100
- Contrast: 75/100
- Brightness: 81/100
- Noise: 60/100
- Visibility: 90/100

## AI visual review
**Summary:** Good contrast, minimal motion artifact.
**Visible features (with review status):**
- [confirmed] Bilateral kidneys visible
- [edited] Normal parenchymal echogenicity pattern — edited: Parenchyma appears homogeneous
**1 of 3 finding(s) rejected and excluded.**
**Questions for the clinician:**
- Any history of stone disease?
- Are ureteric jets visible on ultrasound?

## Limitations
- Renal function
- Degree of hydronephrosis
- Single slice view
- No volumetric data

## Checklist selection
- Enhancing soft-tissue nodule or irregular thickening (≥4 mm)
- Multiple (≥4) septa or minimally thickened smooth walls/septa

## Measurements (pixels)
- Distance: 1,234 px
- Area (ROI): 56,789 px²

---
*AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician.*

This report is not a diagnosis.`;

assert.equal(buildReviewReport(FULL), FULL_SNAPSHOT, "full input must match the pinned snapshot");

/* ---- section order in the full report ------------------------------------- */
const fullOut = buildReviewReport(FULL);
const order = ["## Technical image-quality metrics — not clinical measurements", "## AI visual review", "## Limitations", "## Checklist selection", "## Measurements (pixels)", "---"];
let cursor = 0;
for (const heading of order) {
  const idx = fullOut.indexOf(heading);
  assert.ok(idx > cursor, `section "${heading}" must appear in order`);
  cursor = idx;
}

/* ---- empty sections are omitted; safety notice always present ------------- */
const MINIMAL: ReportInput = { modality: "ultrasound", generatedAt: GEN };

const MINIMAL_SNAPSHOT = `# Imaging Review Report
- **Modality:** Ultrasound
- **Generated:** 2026-08-16 09:34 UTC

---
*${CANONICAL_SAFETY_NOTE}*

This report is not a diagnosis.`;

const minimalOut = buildReviewReport(MINIMAL);
assert.equal(minimalOut, MINIMAL_SNAPSHOT, "no report/quality -> header + notice only");
for (const absent of ["Technical image-quality metrics", "AI visual review", "Limitations", "Checklist selection", "Measurements (pixels)"]) {
  assert.ok(!minimalOut.includes(absent), `"${absent}" must be omitted when there is no data`);
}

// A report with nothing but empty fields also omits every data section.
const EMPTY_REPORT: ReportInput = {
  modality: "other",
  generatedAt: GEN,
  report: {
    provider: "openai",
    model: "gpt-5-mini",
    reviewStatus: "limited",
    summary: "",
    imageQuality: { assessment: "", limitations: [] },
    observedVisualFeatures: [],
    notAssessableFromThisImage: [],
    clinicianQuestions: [],
    uncertainty: "",
    safetyNote: "",
  },
  quality: null,
  findingStates: [],
  checklistSelections: [],
  measurements: [],
};
const emptyOut = buildReviewReport(EMPTY_REPORT);
assert.ok(emptyOut.includes("# Imaging Review Report"), "header always present");
assert.ok(emptyOut.includes("- **Modality:** Other exported image"));
assert.ok(emptyOut.includes("*" + CANONICAL_SAFETY_NOTE + "*"), "empty report falls back to canonical notice");
for (const absent of ["Technical image-quality metrics", "AI visual review", "Limitations", "Checklist selection", "Measurements (pixels)", "**Summary:**"]) {
  assert.ok(!emptyOut.includes(absent), `"${absent}" must be omitted for an empty report`);
}

/* ---- rejected findings: excluded from the list, still counted ------------- */
const rejectedOut = buildReviewReport({
  modality: "xray",
  generatedAt: GEN,
  report: { ...REPORT, summary: "Technical review only.", observedVisualFeatures: ["a", "b", "c"], clinicianQuestions: [] },
  findingStates: [
    { text: "a", status: "rejected" },
    { text: "b", status: "rejected" },
    { text: "c", status: "rejected" },
  ],
});
assert.ok(rejectedOut.includes("**3 of 3 finding(s) rejected and excluded.**"), "all-rejected count must render");
assert.ok(!rejectedOut.includes("**Visible features (with review status):**"), "no feature lines when all are rejected");
assert.ok(!rejectedOut.includes("- a\n") && !rejectedOut.includes("- b\n") && !rejectedOut.includes("- c\n"), "rejected features must not render");

/* ---- edited findings show the edited text --------------------------------- */
assert.ok(
  fullOut.includes("- [edited] Normal parenchymal echogenicity pattern — edited: Parenchyma appears homogeneous"),
  "edited finding shows edited text",
);
// Without editedText the original text is used.
const editedNoTextOut = buildReviewReport({
  modality: "ct-abdomen",
  generatedAt: GEN,
  report: { ...REPORT, summary: "Reviewed.", observedVisualFeatures: ["Liver edge visible"], clinicianQuestions: [] },
  findingStates: [{ text: "Liver edge visible", status: "edited" }],
});
assert.ok(editedNoTextOut.includes("- [edited] Liver edge visible — edited: Liver edge visible"), "edited without replacement falls back to original text");

/* ---- safety notice uses the report's safetyNote when present -------------- */
const customSafetyOut = buildReviewReport({
  modality: "chest-xray",
  generatedAt: GEN,
  report: { ...REPORT, safetyNote: "Custom safety note for this report.", summary: "X-ray reviewed.", clinicianQuestions: [] },
});
assert.ok(customSafetyOut.includes("*Custom safety note for this report.*"), "report safetyNote must be used");
assert.ok(customSafetyOut.includes("This report is not a diagnosis."), "not-a-diagnosis line always present");
assert.ok(!customSafetyOut.includes("*" + CANONICAL_SAFETY_NOTE + "*"), "canonical note not used when report supplies one");
assert.ok(!customSafetyOut.includes("Overall technical score"), "quality absent -> no quality section");

/* ---- quality section carries the non-clinical label ----------------------- */
assert.ok(fullOut.includes("## Technical image-quality metrics — not clinical measurements"), "quality label present");
assert.ok(fullOut.includes("Overall technical score: 87/100"));
for (const sub of ["Resolution: 92/100", "Contrast: 75/100", "Brightness: 81/100", "Noise: 60/100", "Visibility: 90/100"]) {
  assert.ok(fullOut.includes(`- ${sub}`), `sub-score ${sub} present`);
}

/* ---- limitations merge + dedupe ------------------------------------------- */
const dedupOut = buildReviewReport({
  modality: "ct-kub",
  generatedAt: GEN,
  report: { ...REPORT, summary: "Dup.", observedVisualFeatures: [], clinicianQuestions: [], notAssessableFromThisImage: ["Single slice view"], imageQuality: { assessment: "", limitations: ["Single slice view", "Another"] } },
  quality: null,
});
const limitationCount = dedupOut.split("\n").filter((l) => l === "- Single slice view").length;
assert.equal(limitationCount, 1, "duplicate limitation must be listed once");
assert.ok(dedupOut.includes("- Another"));

/* ---- determinism for a fixed generatedAt ---------------------------------- */
assert.equal(
  buildReviewReport({ ...FULL, generatedAt: new Date(GEN.toISOString()) }),
  FULL_SNAPSHOT,
  "same instant in a different Date object produces the same report",
);
assert.equal(buildReviewReport(FULL), buildReviewReport(FULL), "repeated calls are identical");

console.log("all report builder checks passed");