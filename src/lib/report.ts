/**
 * Pure review-report assembly (master prompt §34).
 *
 * Turns the current workspace state (AI report, user-reviewed findings,
 * checklist selections, measurements, technical quality) into a plain
 * Markdown review report. No DOM, no network — unit-testable.
 *
 * Types are FIXED by the architect. Implementation by worker D.
 */

import type { ImagingModality, RecognitionReport } from "@/lib/imaging-recognition";
import { modalityLabel } from "@/lib/imaging-recognition";
import type { ImageQualityMetrics } from "@/lib/image-quality";

export type ReportFindingStatus = "pending" | "confirmed" | "edited" | "rejected";

export type ReportFindingState = {
  /** Original observation text from the AI report. */
  text: string;
  status: ReportFindingStatus;
  /** Replacement text when status === "edited". */
  editedText?: string;
};

export type ReportMeasurementEntry = {
  /** e.g. "Distance", "Angle", "Area (ROI)" */
  label: string;
  /** Pre-formatted pixel value, e.g. "1,234 px" */
  value: string;
};

export type ReportInput = {
  modality: ImagingModality;
  /** Passed in by the caller so the function stays deterministic in tests. */
  generatedAt: Date;
  fileName?: string;
  imageInfo?: { width: number; height: number; sizeBytes?: number };
  /** Technical (non-clinical) image-quality metrics, when computed. */
  quality?: ImageQualityMetrics | null;
  /** The AI visual-review report, when one exists. */
  report?: RecognitionReport | null;
  /** User review decisions keyed to observed features. */
  findingStates?: ReportFindingState[];
  /** Selected structured-checklist items (labels). */
  checklistSelections?: string[];
  /** Pixel measurements, pre-formatted by the caller. */
  measurements?: ReportMeasurementEntry[];
};

/**
 * Canonical notice used when no AI report exists to supply one.
 */
const FALLBACK_SAFETY_NOTE =
  "AI-assisted visual review only. This output is not a diagnosis, radiology report, or treatment recommendation and must be reviewed by a qualified clinician.";

/** "2026-08-16 09:34 UTC" from any Date (deterministic, UTC). */
function formatGeneratedAt(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

/**
 * Assemble the Markdown review report. Must always include:
 * - a header with modality + generation date (UTC, ISO-ish human format)
 * - technical image-quality scores, explicitly labelled "Technical
 *   image-quality metrics — not clinical measurements"
 * - the AI summary + visible features, with user review status per finding
 *   (pending (listed, marked "not reviewed") / confirmed / edited (show edited
 *   text) / rejected (excluded from the findings list, noted in a count))
 * - checklist selections and measurements (pixels only) when present
 * - limitations (notAssessableFromThisImage + quality limitations)
 * - the AI-assistance notice: safetyNote plus "This report is not a diagnosis."
 * Sections with no data are omitted except the safety notice (always present).
 */
export function buildReviewReport(input: ReportInput): string {
  const blocks: string[] = [];

  // Header — modality and generation date are always present.
  const header = [
    "# Imaging Review Report",
    `- **Modality:** ${modalityLabel[input.modality]}`,
    `- **Generated:** ${formatGeneratedAt(input.generatedAt)}`,
  ];
  if (input.fileName?.trim()) header.push(`- **File:** ${input.fileName.trim()}`);
  if (input.imageInfo) {
    const { width, height, sizeBytes } = input.imageInfo;
    const size = typeof sizeBytes === "number" && sizeBytes > 0 ? ` (${formatFileSize(sizeBytes)})` : "";
    header.push(`- **Image:** ${width} × ${height}${size}`);
  }
  blocks.push(header.join("\n"));

  // Technical image-quality metrics (non-clinical by definition).
  const quality = input.quality ?? null;
  if (quality) {
    blocks.push(
      [
        "## Technical image-quality metrics — not clinical measurements",
        `Overall technical score: ${quality.score}/100`,
        `- Resolution: ${quality.resolution}/100`,
        `- Contrast: ${quality.contrast}/100`,
        `- Brightness: ${quality.brightness}/100`,
        `- Noise: ${quality.noise}/100`,
        `- Visibility: ${quality.visibility}/100`,
      ].join("\n"),
    );
  }

  // AI visual review with per-finding user review status.
  const report = input.report ?? null;
  if (report) {
    const review: string[] = ["## AI visual review"];
    let hasReviewContent = false;
    if (report.summary.trim()) {
      review.push(`**Summary:** ${report.summary}`);
      hasReviewContent = true;
    }

    const statesByText = new Map<string, ReportFindingState>();
    for (const state of input.findingStates ?? []) {
      const key = state.text.trim();
      if (!statesByText.has(key)) statesByText.set(key, state);
    }
    const totalFindings = report.observedVisualFeatures.length;
    const rejectedCount = (input.findingStates ?? []).filter((s) => s.status === "rejected").length;

    const featureLines: string[] = [];
    for (const feature of report.observedVisualFeatures) {
      const state = statesByText.get(feature.trim());
      if (state?.status === "rejected") continue; // excluded, only counted
      if (state?.status === "edited") {
        const edited = state.editedText?.trim() || feature;
        featureLines.push(`- [edited] ${feature} — edited: ${edited}`);
      } else if (state?.status === "confirmed") {
        featureLines.push(`- [confirmed] ${feature}`);
      } else {
        featureLines.push(`- ${feature}`);
      }
    }
    if (featureLines.length > 0) {
      review.push("**Visible features (with review status):**", ...featureLines);
      hasReviewContent = true;
    }
    if (rejectedCount > 0) {
      review.push(`**${rejectedCount} of ${totalFindings} finding(s) rejected and excluded.**`);
      hasReviewContent = true;
    }

    const questions = report.clinicianQuestions.filter((q) => q.trim());
    if (questions.length > 0) {
      review.push("**Questions for the clinician:**", ...questions.map((q) => `- ${q.trim()}`));
      hasReviewContent = true;
    }
    if (hasReviewContent) blocks.push(review.join("\n"));
  }

  // Limitations: notAssessableFromThisImage + quality limitations, deduped.
  const limitations: string[] = [];
  if (report) {
    limitations.push(...(report.notAssessableFromThisImage ?? []));
    limitations.push(...(report.imageQuality?.limitations ?? []));
  }
  const uniqueLimitations = [...new Set(limitations.map((l) => l.trim()).filter((l) => l.length > 0))];
  if (uniqueLimitations.length > 0) {
    blocks.push(`## Limitations\n${uniqueLimitations.map((l) => `- ${l}`).join("\n")}`);
  }

  const checklist = (input.checklistSelections ?? []).map((c) => c.trim()).filter((c) => c.length > 0);
  if (checklist.length > 0) {
    blocks.push(`## Checklist selection\n${checklist.map((c) => `- ${c}`).join("\n")}`);
  }

  const measurements = (input.measurements ?? []).filter((m) => m.label.trim().length > 0);
  if (measurements.length > 0) {
    blocks.push(`## Measurements (pixels)\n${measurements.map((m) => `- ${m.label.trim()}: ${m.value}`).join("\n")}`);
  }

  // Safety notice — always present, even with no report or quality data.
  const safetyNote = report?.safetyNote?.trim() || FALLBACK_SAFETY_NOTE;
  blocks.push(["---", `*${safetyNote}*`, "", "This report is not a diagnosis."].join("\n"));

  return blocks.join("\n\n");
}
