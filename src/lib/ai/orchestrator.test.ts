/**
 * Unit tests for the AI orchestration layer (src/lib/ai/orchestrator.ts).
 * Run: npx tsx src/lib/ai/orchestrator.test.ts
 *
 * All provider calls are mocked at the fetch boundary; no network is used.
 * Provider keys are stubbed so both providers count as configured.
 */
import assert from "node:assert/strict";
import type { RecognitionReport } from "@/lib/imaging-recognition";
import {
  analyzeImage,
  chatAboutImage,
  RequestValidationError,
  validateImageDataUrl,
} from "./orchestrator";

const originalFetch = globalThis.fetch;

const MAX_ANALYSIS_FILE_BYTES = 4 * 1024 * 1024;

const IMAGE_PNG = "data:image/png;base64,AAAA";
const IMAGE_JPEG = "data:image/jpeg;base64,AAAA";
const IMAGE_WEBP = "data:image/webp;base64,AAAA";

const REPORT_JSON = {
  reviewStatus: "reviewable",
  summary: "A technically adequate image of the kidneys.",
  imageQuality: { assessment: "Good", limitations: ["mild noise"] },
  observedVisualFeatures: ["Kidney outlines are visible"],
  notAssessableFromThisImage: ["Function"],
  clinicianQuestions: ["Confirm the study date?"],
  uncertainty: "Single slice only.",
  safetyNote: "AI-assisted visual review only.",
};

type MockCall = { url: string; kind: "gemini" | "openai"; body: unknown };
type Counts = { gemini: number; openai: number };

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const statusResponse = (status: number): Response => new Response("", { status });

const geminiAnalysisOk = (payload: unknown): Response =>
  jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] });

/** Gemini text payload placed verbatim (used for malformed-text cases). */
const geminiAnalysisTextOk = (text: string): Response =>
  jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });

const openaiAnalysisOk = (payload: unknown): Response =>
  jsonResponse({ choices: [{ message: { content: JSON.stringify(payload) } }] });

/** OpenAI content placed verbatim (used for malformed-text cases). */
const openaiAnalysisTextOk = (text: string): Response =>
  jsonResponse({ choices: [{ message: { content: text } }] });

const openaiChatOk = (answer: string): Response =>
  jsonResponse({ choices: [{ message: { content: answer } }] });

type Plan = { gemini: Response[]; openai: Response[] };

/** Replaces globalThis.fetch with a per-provider queue mock; returns restore(). */
function installFetchMock(plan: Plan): { counts: Counts; calls: MockCall[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const counts: Counts = { gemini: 0, openai: 0 };
  const calls: MockCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const kind = url.includes("generativelanguage.googleapis.com") ? "gemini" : "openai";
    counts[kind] += 1;
    const next = plan[kind].shift();
    if (!next) throw new TypeError(`unexpected ${kind} fetch call (#${counts[kind]})`);
    let body: unknown;
    try {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    } catch {
      body = init?.body;
    }
    calls.push({ url, kind, body });
    return next;
  }) as unknown as typeof fetch;
  return {
    counts,
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

async function main(): Promise<void> {
  const priorGeminiKey = process.env.GEMINI_API_KEY;
  const priorOpenaiKey = process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "test";
  process.env.OPENAI_API_KEY = "test";
  let mock: ReturnType<typeof installFetchMock> | null = null;
  try {
    /* ---- 1. validateImageDataUrl ----------------------------------------- */
    assert.deepEqual(validateImageDataUrl(IMAGE_PNG), { mimeType: "image/png", base64: "AAAA" });
    assert.deepEqual(validateImageDataUrl(IMAGE_JPEG), { mimeType: "image/jpeg", base64: "AAAA" });
    assert.deepEqual(validateImageDataUrl(IMAGE_WEBP), { mimeType: "image/webp", base64: "AAAA" });
    // Bad MIME is rejected even when the payload looks like base64.
    assert.throws(
      () => validateImageDataUrl("data:image/gif;base64,AAAA"),
      (err: unknown) => err instanceof RequestValidationError,
    );
    assert.throws(
      () => validateImageDataUrl("data:image/svg+xml;base64,AAAA"),
      (err: unknown) => err instanceof RequestValidationError,
    );
    // Non-base64 payloads and non-data-URL strings are rejected.
    assert.throws(
      () => validateImageDataUrl("data:image/png;base64,!!!not base64!!!"),
      (err: unknown) => err instanceof RequestValidationError,
    );
    assert.throws(
      () => validateImageDataUrl("hello"),
      (err: unknown) => err instanceof RequestValidationError,
    );
    // Decoded size over 4MB is rejected; the exact maximum boundary passes.
    assert.throws(
      () => validateImageDataUrl(`data:image/png;base64,${"A".repeat(6_000_000)}`),
      (err: unknown) => err instanceof RequestValidationError,
    );
    assert.throws(
      () => validateImageDataUrl(`data:image/png;base64,${"A".repeat(5_592_407)}`),
      (err: unknown) => err instanceof RequestValidationError,
    );
    const maxBoundary = validateImageDataUrl(`data:image/png;base64,${"A".repeat(5_592_406)}`);
    assert.equal(Math.floor((maxBoundary.base64.length * 3) / 4), MAX_ANALYSIS_FILE_BYTES);
    // Non-string inputs are rejected.
    for (const bad of [undefined, null, 123, {}, []]) {
      assert.throws(
        () => validateImageDataUrl(bad as never),
        (err: unknown) => err instanceof RequestValidationError,
      );
    }

    /* ---- 2. Provider order + retry on 5xx, fallback ---------------------- */
    mock = installFetchMock({
      gemini: [statusResponse(500), statusResponse(500)],
      openai: [openaiAnalysisOk(REPORT_JSON)],
    });
    const fallback = await analyzeImage({ imageDataUrl: IMAGE_PNG, modality: "ultrasound" });
    if (!fallback.ok) throw new Error("expected fallback success");
    assert.equal(fallback.analysis.provider, "openai", "fallback must deliver the openai result");
    assert.deepEqual(fallback.attempted, ["gemini", "openai"]);
    assert.equal(mock.counts.gemini, 2, "gemini must be called exactly twice (initial + 1 retry)");
    assert.equal(mock.counts.openai, 1, "openai must be called exactly once");
    mock.restore();
    mock = null;

    // Explicit preference: openai is tried first; it gets the same 5xx retry.
    mock = installFetchMock({
      gemini: [geminiAnalysisOk(REPORT_JSON)],
      openai: [statusResponse(500), statusResponse(500)],
    });
    const preferred = await analyzeImage({
      imageDataUrl: IMAGE_PNG,
      modality: "xray",
      provider: "openai",
    });
    if (!preferred.ok) throw new Error("expected preference fallback success");
    assert.equal(preferred.analysis.provider, "gemini");
    assert.deepEqual(preferred.attempted, ["openai", "gemini"]);
    assert.equal(mock.counts.openai, 2, "preferred openai must be retried once on 5xx");
    assert.equal(mock.counts.gemini, 1);
    assert.ok(
      mock.calls[0].url.includes("chat/completions"),
      "openai must be the first provider attempted when preferred",
    );
    mock.restore();
    mock = null;

    /* ---- 3. No retry on 4xx ---------------------------------------------- */
    mock = installFetchMock({
      gemini: [statusResponse(429)],
      openai: [openaiAnalysisOk(REPORT_JSON)],
    });
    const rateLimited = await analyzeImage({ imageDataUrl: IMAGE_PNG, modality: "ultrasound" });
    if (!rateLimited.ok) throw new Error("expected openai fallback success");
    assert.equal(rateLimited.analysis.provider, "openai");
    assert.deepEqual(rateLimited.attempted, ["gemini", "openai"]);
    assert.equal(mock.counts.gemini, 1, "gemini 429 must NOT be retried");
    assert.equal(mock.counts.openai, 1);
    mock.restore();
    mock = null;

    /* ---- 4. Both fail: failures carry provider + mapped kind -------------- */
    mock = installFetchMock({
      gemini: [statusResponse(401)],
      openai: [statusResponse(404)],
    });
    const bothFailed = await analyzeImage({ imageDataUrl: IMAGE_PNG, modality: "ct-abdomen" });
    assert.equal(bothFailed.ok, false, "both providers failing must yield ok:false");
    if (bothFailed.ok) throw new Error("unreachable");
    assert.deepEqual(bothFailed.attempted, ["gemini", "openai"]);
    assert.equal(bothFailed.failures.length, 2);
    assert.equal(bothFailed.failures[0].provider, "gemini");
    assert.equal(bothFailed.failures[0].kind, "authentication", "401 must map to authentication");
    assert.equal(bothFailed.failures[1].provider, "openai");
    assert.equal(bothFailed.failures[1].kind, "unavailable-model", "404 must map to unavailable-model");
    assert.equal(mock.counts.gemini, 1, "401 must not be retried");
    assert.equal(mock.counts.openai, 1, "404 must not be retried");
    mock.restore();
    mock = null;

    /* ---- 5. chatAboutImage ----------------------------------------------- */
    await assert.rejects(
      chatAboutImage({ imageDataUrl: IMAGE_PNG, modality: "ct-kub", question: "   " }),
      (err: unknown) => err instanceof RequestValidationError,
      "empty question must throw RequestValidationError",
    );

    const priorReport: RecognitionReport = {
      provider: "openai",
      model: "gpt-5-mini",
      reviewStatus: "limited",
      summary: "Prior review: mild motion artifact.",
      imageQuality: { assessment: "Fair", limitations: ["motion artifact"] },
      observedVisualFeatures: ["Kidney outlines visible"],
      notAssessableFromThisImage: ["Function"],
      clinicianQuestions: ["Confirm positioning"],
      uncertainty: "Single frame.",
      safetyNote: "AI-assisted visual review only.",
    };
    const words400 = Array.from({ length: 400 }, (_, i) => `w${i + 1}`).join(" ");
    mock = installFetchMock({ openai: [openaiChatOk(words400)], gemini: [] });
    const chat = await chatAboutImage({
      imageDataUrl: IMAGE_PNG,
      modality: "ct-kub",
      question: "Is the image rotated?",
      priorReport,
      provider: "openai",
    });
    if (!chat.ok) throw new Error("expected chat success");
    const tokens = chat.result.answer.split(/\s+/).filter((token) => token.length > 0);
    assert.equal(tokens.length, 301, "answer must be 300 words plus the ellipsis marker");
    assert.equal(tokens[300], "…", "clamped answer must end with the ellipsis marker");
    assert.equal(
      tokens.slice(0, 300).join(" "),
      words400.split(" ").slice(0, 300).join(" "),
      "clamped answer must keep the first 300 words in order",
    );
    assert.equal(chat.result.provider, "openai");
    assert.deepEqual(chat.attempted, ["openai"]);
    assert.equal(mock.counts.openai, 1);
    assert.equal(mock.counts.gemini, 0, "gemini must not be called when openai succeeds");

    const sent = mock.calls[0].body as { messages: Array<{ role: string; content: unknown }> };
    const systemMessage = sent.messages.find((message) => message.role === "system");
    assert.ok(systemMessage, "request body must carry a system message");
    assert.ok(
      typeof systemMessage.content === "string" &&
        systemMessage.content.includes("Prior report JSON:") &&
        systemMessage.content.includes(JSON.stringify(priorReport)),
      "prior report must be embedded in the system prompt sent to fetch",
    );
    assert.ok(
      sent.messages.some((message) => JSON.stringify(message).includes(IMAGE_PNG)),
      "the image data URL must be part of the request body",
    );
    mock.restore();
    mock = null;

    /* ---- 6. Malformed JSON from a provider is an invalid-response failure - */
    mock = installFetchMock({
      gemini: [geminiAnalysisTextOk("this is not json at all")],
      openai: [openaiAnalysisTextOk("definitely { not json")],
    });
    const malformed = await analyzeImage({ imageDataUrl: IMAGE_PNG, modality: "other" });
    assert.equal(malformed.ok, false, "malformed provider JSON must not crash; ok:false");
    if (malformed.ok) throw new Error("unreachable");
    assert.deepEqual(malformed.attempted, ["gemini", "openai"]);
    assert.equal(malformed.failures.length, 2);
    for (const failure of malformed.failures) {
      assert.equal(failure.kind, "invalid-response", "unparseable text must map to invalid-response");
    }
    assert.equal(mock.counts.gemini, 1, "invalid-response must not be retried");
    assert.equal(mock.counts.openai, 1);

    console.log("all AI orchestrator checks passed");
  } finally {
    mock?.restore();
    globalThis.fetch = originalFetch;
    if (priorGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorGeminiKey;
    if (priorOpenaiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorOpenaiKey;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});