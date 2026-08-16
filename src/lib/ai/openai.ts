/**
 * OpenAI Vision provider adapter.
 *
 * Calls {OPENAI_API_BASE || https://api.openai.com/v1}/chat/completions with
 * the shared recognition system prompt, JSON mode and detail:"high". Every
 * request runs under a 45s AbortController timeout combined with the caller's
 * signal. Never log secrets or image data.
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

type TimeoutSignal = { signal: AbortSignal; dispose: () => void };

function signalWithTimeout(caller?: AbortSignal): TimeoutSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  if (caller?.aborted) {
    controller.abort();
  } else {
    caller?.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
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

function extractContent(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  const choices = (data as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return undefined;
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return undefined;
  return (message as Record<string, unknown>).content;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is Record<string, unknown> => typeof part === "object" && part !== null)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n");
}

export class OpenAIProvider implements VisionProvider {
  readonly name = "openai" as const;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private get model(): string {
    return process.env.OPENAI_VISION_MODEL || "gpt-5-mini";
  }

  private get baseUrl(): string {
    return (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  private async postChatCompletion(body: Record<string, unknown>, callerSignal?: AbortSignal): Promise<unknown> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(this.name, "not-configured", "OPENAI_API_KEY is not set.");
    }
    const timeout = signalWithTimeout(callerSignal);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: timeout.signal,
      });
    } catch (error) {
      throw errorFromFetch(this.name, error);
    } finally {
      timeout.dispose();
    }
    if (!response.ok) {
      throw new ProviderError(this.name, kindForStatus(response.status), `The ${this.name} provider rejected the request.`, response.status);
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new ProviderError(this.name, "invalid-response", "The provider returned an unreadable body.");
    }
  }

  private userMessage(text: string, imageDataUrl: string): Record<string, unknown> {
    return {
      role: "user",
      content: [
        { type: "text", text },
        { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
      ],
    };
  }

  async analyzeImage(input: VisionInput): Promise<VisionAnalysis> {
    const model = this.model;
    const startedAt = Date.now();
    const data = await this.postChatCompletion(
      {
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: recognitionSystemPrompt(input.modality, input.clinicalQuestion) },
          this.userMessage("Review this single exported image within the stated boundaries. Return only the requested JSON object.", input.imageDataUrl),
        ],
      },
      input.signal,
    );
    const text = textFromContent(extractContent(data)).trim();
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
    const data = await this.postChatCompletion(
      {
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          this.userMessage(input.question, input.imageDataUrl),
        ],
      },
      input.signal,
    );
    const answer = textFromContent(extractContent(data)).trim();
    if (!answer) {
      throw new ProviderError(this.name, "invalid-response", "The provider returned an empty answer.");
    }
    return { answer, provider: this.name, model, latencyMs: Date.now() - startedAt };
  }
}