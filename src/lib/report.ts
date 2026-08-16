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
import type { ImageQualityMetrics } from "@/lib/image-quality";

export type ReportFindingStatus = "confirmed" | "edited" | "rejected";

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
 * Assemble the Markdown review report. Must always include:
 * - a header with modality + generation date (UTC, ISO-ish human format)
 * - technical image-quality scores, explicitly labelled "Technical
 *   image-quality metrics — not clinical measurements"
 * - the AI summary + visible features, with user review status per finding
 *   (confirmed / edited (show edited text) / rejected (excluded from the
 *   findings list, noted in a count))
 * - checklist selections and measurements (pixels only) when present
 * - limitations (notAssessableFromThisImage + quality limitations)
 * - the AI-assistance notice: safetyNote plus "This report is not a diagnosis."
 * Sections with no data are omitted except the safety notice (always present).
 */
export function buildReviewReport(input: ReportInput): string {
  void input;
  throw new Error("buildReviewReport is implemented by worker D");
}
