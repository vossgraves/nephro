/**
 * Gemini Vision provider adapter.
 *
 * Calls the generativelanguage v1beta generateContent endpoint with the
 * shared recognition system prompt and JSON response mime type. Every request
 * runs under a 45s AbortController timeout combined with the caller's signal.
 * Default model: gemini-2.5-flash (see .env.example). Never log secrets or
 * image data.
 */

import {
  normalizeReport,
  parseJsonObject,
  recognitionSystemPrompt,
  type RecognitionProvider,
} from "@/lib/imaging-recognition";
import {
  CHAT_SYSTEM_PROMPT_FALLBACK,
  ProviderError,
  type ChatAnswer,
  type ChatInput,
  type ProviderFailureKind,
  type VisionAnalysis,
  type VisionInput,
  type VisionProvider,
} from "./types";

const PROVIDER_TIMEOUT_MS = 45_000;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type TimeoutSignal = { signal: AbortSignal; dispose: () => void };

function signalWithTimeout(caller?: AbortSignal): TimeoutSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (caller?.aborted) {
    controller.abort();
  } else {
    caller?.addEventListener("abort", onCallerAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      caller?.removeEventListener("abort", onCallerAbort);
    },
  };
}

function kindForStatus(status: number): ProviderFailureKind {
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "unavailable-model";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "network";
  return "unknown";
}

function errorFromFetch(provider: RecognitionProvider, error: unknown): ProviderError {
  if (error instanceof Error && error.name === "AbortError") {
    return new ProviderError(provider, "timeout", `The ${provider} request timed out after ${PROVIDER_TIMEOUT_MS / 1000}s.`);
  }
  if (error instanceof TypeError) {
    return new ProviderError(provider, "network", `The ${provider} request failed at the network level.`);
  }
  return new ProviderError(provider, "unknown", error instanceof Error ? error.message : String(error));
}

function extractGeminiText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const candidates = (data as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) return "";
  const first = candidates[0];
  if (typeof first !== "object" || first === null) return "";
  const content = (first as Record<string, unknown>).content;
  if (typeof content !== "object" || content === null) return "";
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part): part is Record<string, unknown> => typeof part === "object" && part !== null)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n");
}

export class GeminiProvider implements VisionProvider {
  readonly name = "gemini" as const;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private get model(): string {
    return process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  }

  private async generateContent(model: string, body: Record<string, unknown>, callerSignal?: AbortSignal): Promise<unknown> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(this.name, "not-configured", "GEMINI_API_KEY is not set.");
    }
    const timeout = signalWithTimeout(callerSignal);
    let response: Response;
    try {
      response = await fetch(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: timeout.signal,
      });
    } catch (error) {
      timeout.dispose();
      throw errorFromFetch(this.name, error);
    }
    if (!response.ok) {
      // Status only: the provider error body is never read, logged, or surfaced.
      timeout.dispose();
      throw new ProviderError(this.name, kindForStatus(response.status), `The ${this.name} provider rejected the request.`, response.status);
    }
    try {
      const data = (await response.json()) as unknown;
      // Timeout covered the full request + body read; only now dispose it.
      timeout.dispose();
      return data;
    } catch {
      timeout.dispose();
      throw new ProviderError(this.name, "invalid-response", "The provider returned an unreadable body.");
    }
  }

  async analyzeImage(input: VisionInput): Promise<VisionAnalysis> {
    const model = this.model;
    const startedAt = Date.now();
    const data = await this.generateContent(
      model,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: recognitionSystemPrompt(input.modality, input.clinicalQuestion) },
              { inline_data: { mime_type: input.mimeType, data: input.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      },
      input.signal,
    );
    const text = extractGeminiText(data).trim();
    if (!text) {
      throw new ProviderError(this.name, "invalid-response", "The provider returned an empty analysis response.");
    }
    let parsed: unknown;
    try {
      parsed = parseJsonObject(text);
    } catch {
      throw new ProviderError(this.name, "invalid-response", "The provider returned an unreadable analysis response.");
    }
    const report = normalizeReport(parsed, this.name, model);
    return { report, provider: this.name, model, latencyMs: Date.now() - startedAt };
  }

  async chatAboutImage(input: ChatInput): Promise<ChatAnswer> {
    const model = this.model;
    const startedAt = Date.now();
    const systemPrompt = input.systemPrompt ?? CHAT_SYSTEM_PROMPT_FALLBACK;
    const data = await this.generateContent(
      model,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: input.question },
              { inline_data: { mime_type: input.mimeType, data: input.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "text/plain",
        },
      },
      input.signal,
    );
    const answer = extractGeminiText(data).trim();
    if (!answer) {
      throw new ProviderError(this.name, "invalid-response", "The provider returned an empty answer.");
    }
    return { answer, provider: this.name, model, latencyMs: Date.now() - startedAt };
  }
}