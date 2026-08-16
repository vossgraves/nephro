/**
 * AI provider orchestration.
 *
 * Provider order: explicit `provider` preference first, then the other
 * configured provider as fallback; when no preference is given the default
 * order is gemini -> openai (preserves the previous route behavior).
 *
 * Retry policy: one retry per provider, only on network-level failures or
 * provider 5xx responses, with an 800 ms backoff. 4xx responses, timeouts,
 * auth errors and parse failures are never retried.
 *
 * The input data URL is validated here (same MIME and size rules as before)
 * so both routes and both providers share one enforcement point.
 */

import {
  MAX_ANALYSIS_FILE_BYTES,
  modalityLabel,
  type ImagingModality,
  type RecognitionProvider,
  type RecognitionReport,
} from "@/lib/imaging-recognition";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import {
  ProviderError,
  type AnalysisOutcome,
  type ChatAnswer,
  type ChatInput,
  type ChatOutcome,
  type VisionAnalysis,
  type VisionInput,
  type VisionProvider,
} from "./types";

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const RETRY_BACKOFF_MS = 800;
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const MAX_CHAT_ANSWER_WORDS = 300;
const MAX_CLINICAL_QUESTION_CHARS = 600;

const providers: Record<RecognitionProvider, VisionProvider> = {
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
};

export type AnalyzeImageRequest = {
  imageDataUrl: string;
  modality: ImagingModality;
  clinicalQuestion?: string;
  /** Optional provider preference; the other configured provider is the fallback. */
  provider?: RecognitionProvider;
};

export type ChatAboutImageRequest = AnalyzeImageRequest & {
  question: string;
  priorReport?: RecognitionReport;
};

/**
 * Validates a full data URL (MIME + decoded size) and returns the parts the
 * providers need. Throws RequestValidationError on any violation.
 */
export function validateImageDataUrl(dataUrl: unknown): { mimeType: VisionInput["mimeType"]; base64: string } {
  if (typeof dataUrl !== "string") {
    throw new RequestValidationError("Choose an image before requesting a review.");
  }
  const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);
  if (!match) throw new RequestValidationError("Use a PNG, JPEG, or WebP image.");
  const mimeType = match[1] as VisionInput["mimeType"];
  const base64 = match[2];
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_ANALYSIS_FILE_BYTES) {
    throw new RequestValidationError("For provider analysis, choose an image smaller than 4 MB.");
  }
  return { mimeType, base64 };
}

/**
 * Builds the chat system prompt with the same non-diagnostic boundaries as
 * the analysis prompt, embedding the prior automated report (if any) as
 * context. Plain-text answer, under ~300 words.
 */
export function buildChatSystemPrompt(request: { modality: ImagingModality; priorReport?: RecognitionReport }): string {
  const priorReportBlock = request.priorReport
    ? `\n\nA previous automated visual review of this image (produced by this same non-diagnostic tool) may exist as context. It can contain errors and is NOT a diagnosis. Use it only for consistency; if the image clearly contradicts it, say so plainly. Prior report JSON:\n${JSON.stringify(request.priorReport)}\n`
    : "";
  return `You are an AI-assisted visual-review assistant inside a healthcare product. You are NOT a radiologist: never diagnose, rule out disease, prescribe, estimate risk, or claim regulatory or clinical validation. Answer only questions about what is directly visible in the provided single image: technical quality, visible structures, artifacts, positioning, and limitations. If the question asks for a diagnosis, prognosis, treatment, or anything that cannot be determined from this single image, say clearly and briefly that you cannot determine it instead of guessing. Do not infer patient identity, age, sex, or medical history from the image.

The uploaded image is labeled by the user as: ${modalityLabel[request.modality]}. It may be a single exported slice/frame, not a complete study.${priorReportBlock}

Answer in plain text only, in under 300 words. No JSON, no markdown headings, no fabricated measurements or percentages.`;
}

function resolveProviderOrder(preferred?: RecognitionProvider): RecognitionProvider[] {
  const defaultOrder: RecognitionProvider[] = ["gemini", "openai"];
  if (preferred === "openai" || preferred === "gemini") {
    return preferred === "gemini" ? ["gemini", "openai"] : ["openai", "gemini"];
  }
  return defaultOrder;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toProviderError(provider: RecognitionProvider, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error) {
    if (error.name === "AbortError") return new ProviderError(provider, "timeout", error.message);
    return new ProviderError(provider, "network", error.message);
  }
  return new ProviderError(provider, "unknown", String(error));
}

/** Retry only on network-level failures or provider 5xx; never on 4xx or timeouts. */
function isRetryableFailure(error: ProviderError): boolean {
  return error.kind === "network" || (typeof error.status === "number" && error.status >= 500);
}

async function callWithRetry<T>(provider: VisionProvider, attempt: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastError: ProviderError | null = null;
  for (let tries = 0; tries < MAX_ATTEMPTS_PER_PROVIDER; tries += 1) {
    if (tries > 0) {
      await sleep(RETRY_BACKOFF_MS);
      if (signal?.aborted) {
        throw new ProviderError(provider.name, "timeout", "The request was aborted before a retry could start.");
      }
    }
    try {
      return await attempt();
    } catch (error) {
      lastError = toProviderError(provider.name, error);
      if (!isRetryableFailure(lastError)) throw lastError;
    }
  }
  throw lastError;
}

function clampToWordLimit(text: string, maxWords: number): string {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter((word) => word.length > 0);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(" ")} …`;
}

export async function analyzeImage(request: AnalyzeImageRequest): Promise<AnalysisOutcome> {
  const validated = validateImageDataUrl(request.imageDataUrl);
  const attempted: RecognitionProvider[] = [];
  const failures: ProviderError[] = [];

  for (const name of resolveProviderOrder(request.provider)) {
    const provider = providers[name];
    if (!provider.isConfigured()) {
      failures.push(new ProviderError(name, "not-configured", `${name} is not configured (missing API key).`));
      continue;
    }
    attempted.push(name);
    const input: VisionInput = {
      imageDataUrl: request.imageDataUrl,
      mimeType: validated.mimeType,
      base64: validated.base64,
      modality: request.modality,
      clinicalQuestion: request.clinicalQuestion?.slice(0, MAX_CLINICAL_QUESTION_CHARS),
    };
    try {
      const analysis: VisionAnalysis = await callWithRetry(provider, () => provider.analyzeImage(input), input.signal);
      return { ok: true, analysis, attempted };
    } catch (error) {
      failures.push(toProviderError(name, error));
    }
  }
  return { ok: false, attempted, failures };
}

export async function chatAboutImage(request: ChatAboutImageRequest): Promise<ChatOutcome> {
  const validated = validateImageDataUrl(request.imageDataUrl);
  if (!request.question.trim()) {
    throw new RequestValidationError("Ask a question about the image.");
  }
  const attempted: RecognitionProvider[] = [];
  const failures: ProviderError[] = [];
  const systemPrompt = buildChatSystemPrompt(request);

  for (const name of resolveProviderOrder(request.provider)) {
    const provider = providers[name];
    if (!provider.isConfigured()) {
      failures.push(new ProviderError(name, "not-configured", `${name} is not configured (missing API key).`));
      continue;
    }
    attempted.push(name);
    const input: ChatInput = {
      imageDataUrl: request.imageDataUrl,
      mimeType: validated.mimeType,
      base64: validated.base64,
      modality: request.modality,
      clinicalQuestion: request.clinicalQuestion?.slice(0, MAX_CLINICAL_QUESTION_CHARS),
      question: request.question.slice(0, MAX_CLINICAL_QUESTION_CHARS),
      priorReport: request.priorReport,
      systemPrompt,
    };
    try {
      const result: ChatAnswer = await callWithRetry(provider, () => provider.chatAboutImage(input), input.signal);
      result.answer = clampToWordLimit(result.answer, MAX_CHAT_ANSWER_WORDS);
      return { ok: true, result, attempted };
    } catch (error) {
      failures.push(toProviderError(name, error));
    }
  }
  return { ok: false, attempted, failures };
}