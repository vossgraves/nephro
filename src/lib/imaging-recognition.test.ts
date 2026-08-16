/** Run: npx tsx src/lib/imaging-recognition.test.ts */
import assert from "node:assert/strict";
import type { ImagingModality } from "./imaging-recognition";
import {
  normalizeReport,
  parseJsonObject,
  recognitionSystemPrompt,
  modalityLabel,
} from "./imaging-recognition";

const SAFETY_NOTE =
  "AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician.";

const FALLBACK_SUMMARY =
  "The model returned an incomplete visual review. A qualified clinician should assess the original study.";
const FALLBACK_QUALITY = "Image quality could not be reliably characterized.";
const FALLBACK_UNCERTAINTY =
  "This is a general-purpose AI visual review, not a validated medical-imaging interpretation.";

/* ---- normalizeReport: garbage input degrades to safe defaults ------------- */
for (const junk of [null, undefined, 42, "text", [], true]) {
  const r = normalizeReport(junk, "openai", "m-test");
  assert.equal(r.reviewStatus, "limited", "garbage input must map to 'limited'");
  assert.equal(r.summary, FALLBACK_SUMMARY);
  assert.equal(r.imageQuality.assessment, FALLBACK_QUALITY);
  assert.equal(r.uncertainty, FALLBACK_UNCERTAINTY);
  assert.equal(r.safetyNote, SAFETY_NOTE, "safety note must always be pinned");
  assert.deepEqual(r.imageQuality.limitations, []);
  assert.deepEqual(r.observedVisualFeatures, []);
  assert.deepEqual(r.notAssessableFromThisImage, []);
  assert.deepEqual(r.clinicianQuestions, []);
  assert.equal(r.provider, "openai");
  assert.equal(r.model, "m-test");
}

/* ---- normalizeReport: reviewStatus validation ----------------------------- */
assert.equal(normalizeReport({ reviewStatus: "reviewable" }, "gemini", "m").reviewStatus, "reviewable");
assert.equal(normalizeReport({ reviewStatus: "not-reviewable" }, "gemini", "m").reviewStatus, "not-reviewable");
assert.equal(normalizeReport({ reviewStatus: "limited" }, "gemini", "m").reviewStatus, "limited");
for (const bad of ["REVIEWABLE", "bogus", "", 1, null, undefined, { x: 1 }]) {
  const r = normalizeReport({ reviewStatus: bad }, "gemini", "m");
  assert.equal(r.reviewStatus, "limited", `bad reviewStatus ${String(bad)} must map to 'limited'`);
}

/* ---- normalizeReport: string fields are trimmed, junk falls back ---------- */
const withStrings = normalizeReport(
  {
    summary: "  A short factual summary.  ",
    uncertainty: 123,
    imageQuality: { assessment: "  Clear image. ", limitations: "not an array" },
  },
  "openai",
  "m",
);
assert.equal(withStrings.summary, "A short factual summary.");
assert.equal(withStrings.uncertainty, FALLBACK_UNCERTAINTY, "non-string uncertainty falls back");
assert.equal(withStrings.imageQuality.assessment, "Clear image.");
assert.deepEqual(withStrings.imageQuality.limitations, [], "non-array limitations become []");
assert.equal(withStrings.safetyNote, SAFETY_NOTE);

/* ---- normalizeReport: arrays are filtered and capped at 8 ----------------- */
const longArrays = normalizeReport(
  {
    observedVisualFeatures: [1, "", "   ", "a", "b", "c", "d", "e", "f", "g", "h", null, "i"],
    notAssessableFromThisImage: ["only", "junk", 2],
    clinicianQuestions: [],
  },
  "openai",
  "m",
);
assert.deepEqual(longArrays.observedVisualFeatures, ["a", "b", "c", "d", "e", "f", "g", "h"],
  "non-string/blank items filtered, capped at 8");
assert.deepEqual(longArrays.notAssessableFromThisImage, ["only", "junk"]);
assert.deepEqual(longArrays.clinicianQuestions, []);

/* ---- normalizeReport: malformed imageQuality object ----------------------- */
const badQuality = normalizeReport({ imageQuality: null }, "openai", "m");
assert.equal(badQuality.imageQuality.assessment, FALLBACK_QUALITY);
const badQuality2 = normalizeReport({ imageQuality: "nope" }, "openai", "m");
assert.equal(badQuality2.imageQuality.assessment, FALLBACK_QUALITY);

/* ---- parseJsonObject ------------------------------------------------------ */
assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 }, "plain JSON");
assert.deepEqual(parseJsonObject('  {"a":1,"b":[2,3]}  '), { a: 1, b: [2, 3] }, "trimmed JSON");
assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 }, "fenced with json label");
assert.deepEqual(parseJsonObject('```\n{"a":1}\n```'), { a: 1 }, "fenced without label");
assert.deepEqual(
  parseJsonObject('Here is the result: {"a":1,"nested":{"b":2}} thank you'),
  { a: 1, nested: { b: 2 } },
  "embedded JSON extracted from prose",
);
assert.deepEqual(parseJsonObject("[1,2]"), [1, 2], "valid non-object JSON also parses");
// Two separate JSON objects in prose are unreadable by design (no fence): must throw
// the fixed, user-safe message (raw SyntaxError leak fixed by integrator).
assert.throws(
  () => parseJsonObject('prefix {"a":1} {"b":2} suffix'),
  (err: unknown) => err instanceof Error && err.message === "The provider returned an unreadable analysis response.",
);

// Invalid input must throw the fixed, user-safe error.
for (const bad of ["", "   ", "no json here", "{unclosed", '{"a":1', "text { broken"] ) {
  assert.throws(
    () => parseJsonObject(bad),
    (err: unknown) => err instanceof Error && err.message === "The provider returned an unreadable analysis response.",
    `parseJsonObject(${JSON.stringify(bad)}) must throw the fixed message`,
  );
}

/* ---- recognitionSystemPrompt: safety boundaries per modality -------------- */
const MODALITIES: ImagingModality[] = [
  "chest-xray",
  "ct-kub",
  "ct-abdomen",
  "ct-chest",
  "xray",
  "ultrasound",
  "mri-brain",
  "other",
];

const modalityGuidance: Record<ImagingModality, string> = {
  "chest-xray": "Do not identify pathology.",
  "ct-kub": "No disease interpretation.",
  "ct-abdomen": "Describe only directly visualized structures.",
  "ct-chest": "No diagnostic claims.",
  xray: "Do not diagnose.",
  ultrasound: "No diagnoses.",
  "mri-brain": "No clinical interpretation.",
  other: "Avoid any disease-specific interpretation.",
};

for (const modality of MODALITIES) {
  const prompt = recognitionSystemPrompt(modality, "Is the stone visible?");
  assert.ok(prompt.includes("You are an AI-assisted visual-review tool inside a healthcare product"),
    `${modality}: role framing present`);
  assert.ok(prompt.includes("must not diagnose"), `${modality}: no-diagnosis boundary present`);
  assert.ok(
    prompt.includes("must not diagnose, rule out disease, prescribe, estimate risk, or claim regulatory/clinical validation"),
    `${modality}: full prohibition sentence present`,
  );
  assert.ok(prompt.includes(modalityLabel[modality]), `${modality}: modality label present`);
  assert.ok(prompt.includes(modalityGuidance[modality]), `${modality}: modality guidance present`);
  assert.ok(prompt.includes("Return strict JSON only"), `${modality}: JSON schema instruction present`);
  assert.ok(prompt.includes(SAFETY_NOTE.split(".")[0]), `${modality}: safety note instruction present`);
  assert.ok(prompt.includes("Is the stone visible?"), `${modality}: clinical question included`);
}

// Without a question, the prompt must say so instead of inventing one.
assert.ok(recognitionSystemPrompt("ct-kub").includes("No clinical question was provided."));
assert.ok(recognitionSystemPrompt("ct-kub", "   ").includes("No clinical question was provided."));
// Overlong questions are the API layer's job to cap; the prompt must still embed it verbatim.
assert.ok(recognitionSystemPrompt("ct-kub", "Where is the stone?").includes("Where is the stone?"));

console.log("all imaging-recognition checks passed");