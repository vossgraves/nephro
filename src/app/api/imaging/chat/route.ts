import type { ImagingModality, RecognitionProvider, RecognitionReport } from "@/lib/imaging-recognition";
import { RequestValidationError, chatAboutImage, validateImageDataUrl } from "@/lib/ai/orchestrator";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  ALLOWED_MODALITIES,
  MAX_REQUEST_BODY_BYTES,
  RATE_LIMIT_WINDOW_MS,
  clientIp,
  configuredProviders,
  failureResponseBody,
  isRecord,
  noStoreJson,
  payloadTooLargeResponse,
  rateLimitedResponse,
} from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAT_RATE_LIMIT_PER_MINUTE = 20;

function isPriorReport(value: unknown): value is RecognitionReport {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.summary === "string" && typeof record.safetyNote === "string";
}

export async function POST(request: Request) {
  // Content-length guard: reject oversized bodies before reading or parsing.
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return payloadTooLargeResponse();
  }

  // Rate limit (in-memory sliding window, per IP).
  if (!checkRateLimit(`chat:${clientIp(request)}`, CHAT_RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS)) {
    return rateLimitedResponse();
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BODY_BYTES) return payloadTooLargeResponse();
    body = JSON.parse(raw);
  } catch {
    return noStoreJson({ error: "The request body is not valid JSON.", code: "INVALID_JSON" }, { status: 400 });
  }

  const record = isRecord(body) ? body : {};
  const modality = record.modality;
  if (typeof modality !== "string" || !ALLOWED_MODALITIES.has(modality as ImagingModality)) {
    return noStoreJson({ error: "Choose an image modality." }, { status: 400 });
  }
  if (record.deidentifiedConfirmed !== true) {
    return noStoreJson({ error: "Confirm that the image is de-identified before sending it to a provider." }, { status: 400 });
  }
  if (typeof record.imageDataUrl !== "string") {
    return noStoreJson({ error: "Choose an image before requesting a review." }, { status: 400 });
  }
  const question = typeof record.question === "string" ? record.question.trim().slice(0, 600) : "";
  if (!question) {
    return noStoreJson({ error: "Ask a question about the image." }, { status: 400 });
  }
  let provider: RecognitionProvider | undefined;
  if (record.provider !== undefined && record.provider !== null) {
    if (record.provider !== "openai" && record.provider !== "gemini") {
      return noStoreJson({ error: 'The provider field must be "openai" or "gemini".' }, { status: 400 });
    }
    provider = record.provider;
  }
  const priorReport = record.priorReport === undefined || record.priorReport === null ? undefined : record.priorReport;
  if (priorReport !== undefined && !isPriorReport(priorReport)) {
    return noStoreJson({ error: "priorReport must be a valid review report object." }, { status: 400 });
  }
  if (configuredProviders().length === 0) {
    return noStoreJson({
      error: "No AI providers configured. Add GEMINI_API_KEY and/or OPENAI_API_KEY as server-side environment variables.",
      code: "NO_PROVIDERS_CONFIGURED",
    }, { status: 503 });
  }

  try {
    validateImageDataUrl(record.imageDataUrl);
    const outcome = await chatAboutImage({
      imageDataUrl: record.imageDataUrl,
      modality: modality as ImagingModality,
      question,
      priorReport,
      provider,
    });
    if (outcome.ok) {
      return noStoreJson({
        answer: outcome.result.answer,
        provider: outcome.result.provider,
        model: outcome.result.model,
      });
    }
    return noStoreJson(failureResponseBody(outcome.failures), { status: 503 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return noStoreJson({ error: error.message }, { status: 422 });
    }
    console.error("Imaging chat request failed unexpectedly", { error: error instanceof Error ? error.message : String(error) });
    return noStoreJson({ error: error instanceof Error ? error.message : "Unexpected chat error." }, { status: 422 });
  }
}