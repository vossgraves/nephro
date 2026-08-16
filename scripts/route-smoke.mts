/**
 * Route smoke test — exercises the imaging API handlers without a dev server.
 *
 * Imports the real POST/GET handlers from the analyze and chat routes and
 * drives them with synthetic `new Request(...)` objects under tsx. Asserts
 * status codes and key JSON fields, prints PASS/FAIL, exits non-zero on any
 * failure.
 *
 * Run: pnpm exec tsx scripts/route-smoke.mts
 */

import { GET as analyzeGet, POST as analyzePost } from "../src/app/api/imaging/analyze/route";
import { POST as chatPost } from "../src/app/api/imaging/chat/route";

const ANALYZE_URL = "http://localhost/api/imaging/analyze";
const CHAT_URL = "http://localhost/api/imaging/chat";

// A valid small PNG data URL (well under the 4 MB payload limit).
const DATA_URL = `data:image/png;base64,${"A".repeat(64)}`;

let passed = 0;
let failures = 0;

function report(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeJsonRequest(url: string, ip: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as unknown as Record<string, unknown>;
}

async function main(): Promise<void> {
  // Force the "no providers configured" state for the whole run.
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  // --- Analyze: validation guards (distinct IPs so rate limits never interfere) ---

  const noModality = await analyzePost(
    makeJsonRequest(ANALYZE_URL, "198.51.100.10", { imageDataUrl: DATA_URL, deidentifiedConfirmed: true }),
  );
  report("analyze: missing modality → 400", noModality.status === 400, `status=${noModality.status}`);
  {
    const json = await readJson(noModality);
    report("analyze: missing modality error message", typeof json.error === "string", JSON.stringify(json));
  }

  const noConsent = await analyzePost(
    makeJsonRequest(ANALYZE_URL, "198.51.100.11", { modality: "ultrasound", imageDataUrl: DATA_URL }),
  );
  report("analyze: missing consent → 400", noConsent.status === 400, `status=${noConsent.status}`);
  {
    const json = await readJson(noConsent);
    report("analyze: missing consent error message", typeof json.error === "string", JSON.stringify(json));
  }

  const noImage = await analyzePost(
    makeJsonRequest(ANALYZE_URL, "198.51.100.12", { modality: "ultrasound", deidentifiedConfirmed: true }),
  );
  report("analyze: missing image → 400", noImage.status === 400, `status=${noImage.status}`);
  {
    const json = await readJson(noImage);
    report("analyze: missing image error message", typeof json.error === "string", JSON.stringify(json));
  }

  const badProvider = await analyzePost(
    makeJsonRequest(ANALYZE_URL, "198.51.100.13", {
      modality: "ultrasound",
      imageDataUrl: DATA_URL,
      deidentifiedConfirmed: true,
      provider: "claude",
    }),
  );
  report("analyze: invalid provider → 400", badProvider.status === 400, `status=${badProvider.status}`);
  {
    const json = await readJson(badProvider);
    report("analyze: invalid provider error message", typeof json.error === "string", JSON.stringify(json));
  }

  const badJson = await analyzePost(makeJsonRequest(ANALYZE_URL, "198.51.100.14", "this is not json"));
  report("analyze: invalid JSON body → 400", badJson.status === 400, `status=${badJson.status}`);
  {
    const json = await readJson(badJson);
    report("analyze: invalid JSON code", json.code === "INVALID_JSON", JSON.stringify(json));
  }

  // --- Analyze: oversized content-length header → 413 (before parsing) ---

  const oversized = new Request(ANALYZE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(7 * 1024 * 1024 + 1),
      "x-forwarded-for": "198.51.100.15",
    },
    body: "",
  });
  const tooLarge = await analyzePost(oversized);
  report("analyze: oversized content-length → 413", tooLarge.status === 413, `status=${tooLarge.status}`);
  {
    const json = await readJson(tooLarge);
    report("analyze: oversized code", json.code === "PAYLOAD_TOO_LARGE", JSON.stringify(json));
  }

  // --- Analyze: no providers configured → 503 NO_PROVIDERS_CONFIGURED ---

  const noProviders = await analyzePost(
    makeJsonRequest(ANALYZE_URL, "198.51.100.20", {
      modality: "ultrasound",
      imageDataUrl: DATA_URL,
      deidentifiedConfirmed: true,
    }),
  );
  report("analyze: no providers → 503", noProviders.status === 503, `status=${noProviders.status}`);
  {
    const json = await readJson(noProviders);
    report(
      "analyze: no providers code",
      json.code === "NO_PROVIDERS_CONFIGURED" && typeof json.error === "string",
      JSON.stringify(json),
    );
  }

  // --- Analyze: GET probe shape ---

  const probe = await analyzeGet();
  report("analyze: GET → 200", probe.status === 200, `status=${probe.status}`);
  {
    const json = await readJson(probe);
    const configured = json.configured as unknown as Record<string, unknown> | undefined;
    report(
      "analyze: GET configured map + maxImageBytes",
      configured !== undefined &&
        configured.openai === false &&
        configured.gemini === false &&
        json.maxImageBytes === 4 * 1024 * 1024 &&
        typeof json.privacy === "string",
      JSON.stringify(json),
    );
  }

  // --- Analyze: rate limit — 7th call from the same IP in a minute → 429 ---

  const analyzeIp = "203.0.113.50";
  let seventhAnalyzeStatus = 0;
  for (let i = 0; i < 7; i += 1) {
    const response = await analyzePost(
      makeJsonRequest(ANALYZE_URL, analyzeIp, {
        modality: "ultrasound",
        imageDataUrl: DATA_URL,
        deidentifiedConfirmed: true,
      }),
    );
    await response.json();
    if (i === 5) {
      report("analyze: 6th call still allowed (503, not 429)", response.status === 503, `status=${response.status}`);
    }
    if (i === 6) seventhAnalyzeStatus = response.status;
  }
  report("analyze: 7th call → 429", seventhAnalyzeStatus === 429, `status=${seventhAnalyzeStatus}`);
  {
    const seventh = await analyzePost(
      makeJsonRequest(ANALYZE_URL, analyzeIp, {
        modality: "ultrasound",
        imageDataUrl: DATA_URL,
        deidentifiedConfirmed: true,
      }),
    );
    const json = await readJson(seventh);
    report("analyze: 429 body + Retry-After", seventh.status === 429 && json.code === "RATE_LIMITED" && typeof json.error === "string", JSON.stringify(json));
    report("analyze: 429 Retry-After header", seventh.headers.get("Retry-After") === "60", `Retry-After=${seventh.headers.get("Retry-After")}`);
  }

  // --- Chat: validation guard + rate limit — 21st call from the same IP → 429 ---

  const noQuestion = await chatPost(
    makeJsonRequest(CHAT_URL, "198.51.100.30", {
      modality: "ultrasound",
      imageDataUrl: DATA_URL,
      deidentifiedConfirmed: true,
    }),
  );
  report("chat: missing question → 400", noQuestion.status === 400, `status=${noQuestion.status}`);
  {
    const json = await readJson(noQuestion);
    report("chat: missing question error message", typeof json.error === "string", JSON.stringify(json));
  }

  const noChatConsent = await chatPost(
    makeJsonRequest(CHAT_URL, "198.51.100.31", {
      modality: "ultrasound",
      imageDataUrl: DATA_URL,
      question: "Is the image sharp?",
    }),
  );
  report("chat: missing consent → 400", noChatConsent.status === 400, `status=${noChatConsent.status}`);

  const chatIp = "203.0.113.60";
  let twentyFirstChatStatus = 0;
  for (let i = 0; i < 21; i += 1) {
    const response = await chatPost(
      makeJsonRequest(CHAT_URL, chatIp, {
        modality: "ultrasound",
        imageDataUrl: DATA_URL,
        deidentifiedConfirmed: true,
        question: "Is the image sharp?",
      }),
    );
    await response.json();
    if (i === 19) {
      report("chat: 20th call still allowed (503, not 429)", response.status === 503, `status=${response.status}`);
    }
    if (i === 20) twentyFirstChatStatus = response.status;
  }
  report("chat: 21st call → 429", twentyFirstChatStatus === 429, `status=${twentyFirstChatStatus}`);
  {
    const twentySecond = await chatPost(
      makeJsonRequest(CHAT_URL, chatIp, {
        modality: "ultrasound",
        imageDataUrl: DATA_URL,
        deidentifiedConfirmed: true,
        question: "Is the image sharp?",
      }),
    );
    const json = await readJson(twentySecond);
    report(
      "chat: 429 body + Retry-After",
      twentySecond.status === 429 && json.code === "RATE_LIMITED" && twentySecond.headers.get("Retry-After") === "60",
      JSON.stringify(json),
    );
  }

  console.log(`\n${passed} passed, ${failures} failed`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("route-smoke crashed:", error);
  process.exit(1);
});