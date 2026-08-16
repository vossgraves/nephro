export type RecognitionProvider = "openai" | "gemini";

export type ImagingModality = "xray" | "chest-xray" | "ultrasound" | "ct-kub" | "ct-abdomen" | "ct-chest" | "mri-brain" | "other";

export type RecognitionReport = {
  provider: RecognitionProvider;
  model: string;
  reviewStatus: "reviewable" | "limited" | "not-reviewable";
  summary: string;
  imageQuality: {
    assessment: string;
    limitations: string[];
  };
  observedVisualFeatures: string[];
  notAssessableFromThisImage: string[];
  clinicianQuestions: string[];
  uncertainty: string;
  safetyNote: string;
};

export type RecognitionRequest = {
  provider: RecognitionProvider;
  imageDataUrl: string;
  modality: ImagingModality;
  clinicalQuestion?: string;
  deidentifiedConfirmed: boolean;
};

export const MAX_ANALYSIS_FILE_BYTES = 4 * 1024 * 1024;

export const providerLabel: Record<RecognitionProvider, string> = {
  openai: "OpenAI Vision",
  gemini: "Gemini Vision",
};

export const modalityLabel: Record<ImagingModality, string> = {
  "chest-xray": "Chest X-ray",
  "ct-kub": "CT KUB (Kidney, Ureters, Bladder)",
  "ct-abdomen": "CT Abdomen",
  "ct-chest": "CT Chest",
  xray: "General X-ray / Radiograph",
  ultrasound: "Ultrasound",
  "mri-brain": "MRI Brain",
  other: "Other exported image",
};

export const REPORT_FORMAT_EXAMPLE: RecognitionReport = {
  provider: "openai",
  model: "example-model",
  reviewStatus: "limited",
  summary: "The image can be reviewed for visible characteristics, with important limitations noted below.",
  imageQuality: {
    assessment: "Example only",
    limitations: ["Example only"],
  },
  observedVisualFeatures: ["Example only"],
  notAssessableFromThisImage: ["Example only"],
  clinicianQuestions: ["Example only"],
  uncertainty: "Example only",
  safetyNote:
    "AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician.",
};

export function recognitionSystemPrompt(modality: ImagingModality, clinicalQuestion?: string) {
  const question = clinicalQuestion?.trim()
    ? `The user’s non-identifying review question is: ${clinicalQuestion.trim()}`
    : "No clinical question was provided.";

  const modalityGuidance: Record<ImagingModality, string> = {
    "chest-xray": "Focus on visible anatomy, technical quality (penetration, rotation, positioning), and image artifacts. Do not identify pathology.",
    "ct-kub": "Note CT quality (motion artifact, contrast phases if visible), scout positioning, and any visible anatomic landmarks (kidney size, laterality, spine). No disease interpretation.",
    "ct-abdomen": "Assess image quality, slice artifact, contrast timing, and visible organ boundaries. Describe only directly visualized structures.",
    "ct-chest": "Evaluate technical factors: motion, contrast arrival, positioning, and visible mediastinal/pleural anatomy. No diagnostic claims.",
    xray: "General radiograph review: assess technique (exposure, alignment), positioning, and image quality. Do not diagnose.",
    ultrasound: "Evaluate ultrasound technique (probe artifact, shadowing), image clarity, and directly visible tissue characteristics. No diagnoses.",
    "mri-brain": "Assess MRI sequence quality, artifacts, clearly visible anatomy (ventricles, sulci, gray/white matter). No clinical interpretation.",
    other: "Review the image for technical quality and visible characteristics only. Avoid any disease-specific interpretation.",
  };

  return `You are an AI-assisted visual-review tool inside a healthcare product. You are NOT a radiologist and must not diagnose, rule out disease, prescribe, estimate risk, or claim regulatory/clinical validation. Analyze only directly visible image characteristics, technical quality, and limitations. Do not infer patient identity, age, sex, or medical history from the image. Do not mention a disease unless the image itself visibly contains text naming it.

The uploaded image is labeled by the user as: ${modalityLabel[modality]}. It may be a single exported slice/frame, not a complete study.

${modalityGuidance[modality]}

${question}

Return strict JSON only, matching this exact schema:
{
  "reviewStatus": "reviewable" | "limited" | "not-reviewable",
  "summary": "one brief, factual summary of image quality and directly visible features, without diagnosis",
  "imageQuality": {"assessment": "brief assessment of technical quality, artifacts, and limitations", "limitations": ["specific technical limitation", "positioning issue", "artifact or quality factor"]},
  "observedVisualFeatures": ["directly visible anatomic structure or technical feature", "no disease claims"],
  "notAssessableFromThisImage": ["information that cannot be determined from this single image"],
  "clinicianQuestions": ["question a qualified clinician should ask about the original study"],
  "uncertainty": "brief note on why a clinician must review the original study",
  "safetyNote": "AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician."
}

Rules: Use empty arrays instead of inventing findings. Never fabricate measurements, regions, confidence percentages, or pathology. Keep the summary and features purely technical and structural.`;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 8)
    : [];
}

export function normalizeReport(value: unknown, provider: RecognitionProvider, model: string): RecognitionReport {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = raw.reviewStatus;
  const imageQuality = raw.imageQuality && typeof raw.imageQuality === "object"
    ? raw.imageQuality as Record<string, unknown>
    : {};

  return {
    provider,
    model,
    reviewStatus: status === "reviewable" || status === "limited" || status === "not-reviewable" ? status : "limited",
    summary: asString(raw.summary, "The model returned an incomplete visual review. A qualified clinician should assess the original study."),
    imageQuality: {
      assessment: asString(imageQuality.assessment, "Image quality could not be reliably characterized."),
      limitations: asStringArray(imageQuality.limitations),
    },
    observedVisualFeatures: asStringArray(raw.observedVisualFeatures),
    notAssessableFromThisImage: asStringArray(raw.notAssessableFromThisImage),
    clinicianQuestions: asStringArray(raw.clinicianQuestions),
    uncertainty: asString(raw.uncertainty, "This is a general-purpose AI visual review, not a validated medical-imaging interpretation."),
    safetyNote: "AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician.",
  };
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        // fall through to the embedded-object attempt
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // fall through to the user-safe error below
      }
    }
    throw new Error("The provider returned an unreadable analysis response.");
  }
}
