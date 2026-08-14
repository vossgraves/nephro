import { NextResponse } from "next/server";
import {
  ImagingModality,
  MAX_ANALYSIS_FILE_BYTES,
  normalizeReport,
  parseJsonObject,
  RecognitionProvider,
  RecognitionRequest,
  recognitionSystemPrompt,
} from "@/lib/imaging-recognition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_MODALITIES = new Set<ImagingModality>(["xray", "chest-xray", "ultrasound", "ct-kub", "ct-abdomen", "ct-chest", "mri-brain", "other"]);

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

function parseImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Use a PNG, JPEG, or WebP image.");
  const [, mimeType, base64] = match;
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_ANALYSIS_FILE_BYTES) {
    throw new Error("For provider analysis, choose an image smaller than 4 MB.");
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("Unsupported image type.");
  return { mimeType, base64 };
}

function configured(provider: RecognitionProvider) {
  return provider === "openai" ? Boolean(process.env.OPENAI_API_KEY) : Boolean(process.env.GEMINI_API_KEY);
}

async function analyzeWithOpenAI(payload: RecognitionRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  const model = process.env.OPENAI_VISION_MODEL || "gpt-5-mini";
  const baseUrl = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: recognitionSystemPrompt(payload.modality, payload.clinicalQuestion) },
        {
          role: "user",
          content: [
            { type: "text", text: "Review this single exported image within the stated boundaries. Return only the requested JSON object." },
            { type: "image_url", image_url: { url: payload.imageDataUrl, detail: "high" } },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    await response.text();
    throw new Error(`OPENAI_REQUEST_FAILED:${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : content?.map((part) => part.text || "").join("\n");
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  return normalizeReport(parseJsonObject(text), "openai", model);
}

async function analyzeWithGemini(payload: RecognitionRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const { mimeType, base64 } = parseImageDataUrl(payload.imageDataUrl);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: recognitionSystemPrompt(payload.modality, payload.clinicalQuestion) },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await response.text();
    throw new Error(`GEMINI_REQUEST_FAILED:${response.status}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return normalizeReport(parseJsonObject(text), "gemini", model);
}

export async function GET() {
  return noStoreJson({
    configured: {
      openai: configured("openai"),
      gemini: configured("gemini"),
    },
    maxImageBytes: MAX_ANALYSIS_FILE_BYTES,
    privacy: "Images are sent to the selected configured provider only after client confirmation. The endpoint does not persist them.",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<RecognitionRequest>;
    const modality = body.modality;

    if (!modality || !ALLOWED_MODALITIES.has(modality)) {
      return noStoreJson({ error: "Choose an image modality." }, { status: 400 });
    }
    if (body.deidentifiedConfirmed !== true) {
      return noStoreJson({ error: "Confirm that the image is de-identified before sending it to a provider." }, { status: 400 });
    }
    if (typeof body.imageDataUrl !== "string") {
      return noStoreJson({ error: "Choose an image before requesting a review." }, { status: 400 });
    }

    parseImageDataUrl(body.imageDataUrl);
    const payload: RecognitionRequest = {
      provider: "gemini", // will be updated by the actual provider used
      modality,
      imageDataUrl: body.imageDataUrl,
      clinicalQuestion: typeof body.clinicalQuestion === "string" ? body.clinicalQuestion.slice(0, 600) : undefined,
      deidentifiedConfirmed: true,
    };

    // Try Gemini first, fall back to OpenAI
    let report;
    let usedProvider: RecognitionProvider = "gemini";

    try {
      if (process.env.GEMINI_API_KEY) {
        report = await analyzeWithGemini(payload);
      } else {
        throw new Error("GEMINI_NOT_CONFIGURED");
      }
    } catch (geminiError) {
      console.warn("Gemini analysis failed, attempting OpenAI fallback", { error: geminiError instanceof Error ? geminiError.message : String(geminiError) });

      if (process.env.OPENAI_API_KEY) {
        payload.provider = "openai";
        usedProvider = "openai";
        report = await analyzeWithOpenAI(payload);
      } else {
        throw new Error("NO_PROVIDERS_CONFIGURED");
      }
    }

    // Ensure report has the correct provider metadata
    if (report && usedProvider === "openai") {
      report.provider = "openai";
    }

    return noStoreJson({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    if (message === "NO_PROVIDERS_CONFIGURED") {
      return noStoreJson({
        error: "No AI providers configured. Add GEMINI_API_KEY and/or OPENAI_API_KEY as server-side environment variables.",
        code: "NO_PROVIDERS_CONFIGURED",
      }, { status: 503 });
    }
    if (message === "GEMINI_NOT_CONFIGURED" || message === "OPENAI_NOT_CONFIGURED") {
      return noStoreJson({
        error: "No available AI providers. Ensure GEMINI_API_KEY and/or OPENAI_API_KEY are configured.",
        code: "PROVIDER_NOT_CONFIGURED",
      }, { status: 503 });
    }
    console.error("Imaging review request failed", { code: message.split(":")[0] });
    return noStoreJson({ error: message.includes("REQUEST_FAILED") ? "Both providers failed. Try again later." : message }, { status: 422 });
  }
}
