/**
 * Shared helpers for the imaging API routes (/api/imaging/analyze,
 * /api/imaging/chat). Keeps the handlers thin while preserving one source of
 * truth for guards, headers, and provider-failure responses.
 */

import { NextResponse } from "next/server";
import type { ProviderError, ProviderFailureKind } from "@/lib/ai/types";
import type { ImagingModality, RecognitionProvider } from "@/lib/imaging-recognition";

/** Hard cap for request bodies (base64 data URLs are ~4/3 of the raw image). */
export const MAX_REQUEST_BODY_BYTES = 7 * 1024 * 1024;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export const ALLOWED_MODALITIES: ReadonlySet<ImagingModality> = new Set<ImagingModality>([
  "xray",
  "chest-xray",
  "ultrasound",
  "ct-kub",
  "ct-abdomen",
  "ct-chest",
  "mri-brain",
  "other",
]);

export function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function configuredProviders(): RecognitionProvider[] {
  const result: RecognitionProvider[] = [];
  if (process.env.OPENAI_API_KEY) result.push("openai");
  if (process.env.GEMINI_API_KEY) result.push("gemini");
  return result;
}

export function providerFailureLabel(kind: ProviderFailureKind): string {
  switch (kind) {
    case "authentication":
      return "API key rejected (check the configured key)";
    case "unavailable-model":
      return "model unavailable (check the model name)";
    case "rate-limited":
      return "rate limited";
    case "not-configured":
      return "not configured";
    case "timeout":
      return "timed out";
    case "network":
      return "temporarily unavailable";
    default:
      return "unavailable";
  }
}

/**
 * Maps collected provider failures to the stable error response shape:
 * { error, code: "BOTH_PROVIDERS_FAILED", providerDetails }.
 */
export function failureResponseBody(failures: ProviderError[]): { error: string; code: string; providerDetails: string[] } {
  const providerDetails = failures.map((failure) => `${failure.provider}: ${providerFailureLabel(failure.kind)}`);
  const hasAuthFailure = failures.some((failure) => failure.kind === "authentication");
  const hasTransientFailure = failures.some((failure) => failure.kind === "network" || failure.kind === "timeout");
  const error = hasAuthFailure
    ? "Provider API keys are being rejected. Check the GEMINI_API_KEY and OPENAI_API_KEY environment variables in Vercel."
    : hasTransientFailure
      ? "AI providers are temporarily unavailable. Wait a few seconds and try again."
      : failures.length <= 1
        ? "The AI provider could not complete the request. Try again later."
        : "Both providers failed. Try again later.";
  return { error, code: "BOTH_PROVIDERS_FAILED", providerDetails };
}

export function rateLimitedResponse(): NextResponse {
  return noStoreJson(
    { error: "Too many requests. Please wait about a minute and try again.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export function payloadTooLargeResponse(): NextResponse {
  return noStoreJson(
    { error: "The request is too large. Choose an image smaller than 4 MB and try again.", code: "PAYLOAD_TOO_LARGE" },
    { status: 413 },
  );
}