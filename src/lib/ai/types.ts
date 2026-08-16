/**
 * Server-side AI orchestration contract for imaging analysis.
 *
 * Architecture (master prompt §23–24):
 *   Frontend → /api/imaging/* routes → orchestrator → OpenAI | Gemini → normalized result
 *
 * This file defines the shared types. Implementations live in:
 *   ./openai.ts, ./gemini.ts, ./orchestrator.ts, ./rate-limit.ts
 *
 * The public report shape stays `RecognitionReport` from
 * `@/lib/imaging-recognition` (backward-compatible with the existing UI).
 */

import type {
  ImagingModality,
  RecognitionProvider,
  RecognitionReport,
} from "@/lib/imaging-recognition";

export type VisionInput = {
  /** Full data URL (data:image/...;base64,...) — already validated. */
  imageDataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
  modality: ImagingModality;
  clinicalQuestion?: string;
  /** Abort signal owned by the caller (per-provider timeout). */
  signal?: AbortSignal;
};

export type VisionAnalysis = {
  report: RecognitionReport;
  provider: RecognitionProvider;
  model: string;
  latencyMs: number;
};

export type ChatInput = VisionInput & {
  question: string;
  priorReport?: RecognitionReport;
};

export type ChatAnswer = {
  answer: string;
  provider: RecognitionProvider;
  model: string;
  latencyMs: number;
};

export interface VisionProvider {
  readonly name: RecognitionProvider;
  isConfigured(): boolean;
  analyzeImage(input: VisionInput): Promise<VisionAnalysis>;
  chatAboutImage(input: ChatInput): Promise<ChatAnswer>;
}

export type ProviderFailureKind =
  | "not-configured"
  | "authentication"
  | "rate-limited"
  | "timeout"
  | "network"
  | "invalid-response"
  | "unavailable-model"
  | "unknown";

export class ProviderError extends Error {
  constructor(
    public provider: RecognitionProvider,
    public kind: ProviderFailureKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type AnalysisOutcome =
  | { ok: true; analysis: VisionAnalysis; attempted: RecognitionProvider[] }
  | { ok: false; attempted: RecognitionProvider[]; failures: ProviderError[] };

export type ChatOutcome =
  | { ok: true; result: ChatAnswer; attempted: RecognitionProvider[] }
  | { ok: false; attempted: RecognitionProvider[]; failures: ProviderError[] };
