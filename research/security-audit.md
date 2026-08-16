# Nephro security audit — §37 checklist

Audit date: 2026-08-16 (branch `feat/nephro-production-upgrade`).
Method: static review of `src/` against the §37 security checklist from the
product plan. Re-verify after the imaging upgrade (workers A–C) merges, and
again before any public launch.

Status legend: **Pass** = verified in current code. **Partial** = mitigation
exists but has gaps. **In progress** = required change is part of this upgrade
and has not landed at audit time. **Risk (accepted)** = by design.

| # | Item | Status | Evidence / location | Notes |
|---|---|---|---|---|
| 1 | Upload MIME validation | Pass | `analyze/route.ts` `ALLOWED_MIME_TYPES` (png/jpeg/webp) + base64 data-URL regex `parseImageDataUrl`; client gate in `ImagingWorkspace.tsx` | Regex enforces `data:image/(png\|jpeg\|webp);base64,` shape. Gap: no magic-byte sniffing after decode; a renamed file with a valid header passes. Low risk, see follow-ups. |
| 2 | Upload size validation | Pass (4 MB) | `MAX_ANALYSIS_FILE_BYTES` in `imaging-recognition.ts`; decoded-size check in `parseImageDataUrl`; client checks `file.size` | 7 MB content-length header guard (reject before JSON parse, HTTP 413) is a planned Worker B change; not present at audit time. |
| 3 | Consent gate (de-identification) | Pass | `analyze/route.ts` POST requires `deidentifiedConfirmed === true`, else 400; send button disabled client-side until confirmed | Gate is client-asserted and server-enforced. The server trusts the boolean; there is no automated PHI detection. Documented limitation. |
| 4 | HTTP no-store | Pass | `noStoreJson` sets `Cache-Control: no-store, max-age=0` on all API responses; provider fetches use `cache: "no-store"` | Prevents CDN/browser caching of image-bearing responses. |
| 5 | API keys server-only | Pass | Keys read only in `analyze/route.ts` via `process.env.*`; never `NEXT_PUBLIC_`-prefixed; `.env.example` says the same | Env var names used: `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_VISION_MODEL`, `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`, `DATABASE_URL`. |
| 6 | Rate limiting | In progress — core landed | `src/lib/ai/rate-limit.ts` `checkRateLimit` (sliding window per key, capped at 10,000 tracked keys, fails closed) landed during this audit | Route wiring (6/min analyze, 20/min chat per IP, 429 with friendly message) is still landing with Worker B. Documented caveat: each serverless instance keeps its own window, so limits are per-instance, not global. Re-verify with a burst test after merge. |
| 7 | No PHI persistence | Pass | No database write for images anywhere; `db.ts` persists calculator records only; images exist only in the request body and provider call | No localStorage/IndexedDB usage for images (localStorage is used by the calculator page for history/favorites only). |
| 8 | No authentication | Risk (accepted) | No auth on any route; documented design (single-user product, no accounts) | Without auth, the consent gate and rate limits are the only abuse controls. Acceptable for the current deployment; revisit before multi-user/launch. Also note: `GET /api/imaging/analyze` intentionally reveals which providers are configured; benign. |
| 9 | Prompt injection mitigations | Partial | `recognitionSystemPrompt`: fixed role framing ("must not diagnose…"), modality-specific boundaries, strict JSON-only schema, pinned safety note, forbidden fabricated measurements; client question capped at 600 chars at the API boundary | Image content itself can carry adversarial text; the prompt's "only mention a disease if the image visibly contains text naming it" rule is a mitigation, not a guarantee. Output is post-processed by `normalizeReport` (status allowlist, arrays capped, fixed safety note) which bounds the damage. Follow-ups below. |
| 10 | XSS: React escaping, no dangerouslySetInnerHTML | Pass | Grep across `src/` for `dangerouslySetInnerHTML`: zero matches; report rendered through React JSX text nodes | Model output is rendered as text, so a provider-returned `<script>` cannot execute. |
| 11 | Sensitive logging | Pass (with note) | `console.warn`/`console.error` in `analyze/route.ts` log error codes/status only (`GEMINI_REQUEST_FAILED:429`); never keys, never image payloads, never full provider responses | `CompositeProviderError` message interpolates provider status codes only. Note: Vercel function logs persist console output; do not enable request-body logging. |

## Residual risks and follow-ups

1. **Rate limiting needs route wiring + burst verification** — `checkRateLimit`
   has landed in `src/lib/ai/rate-limit.ts`; worker B must wire it into both
   routes (6/min analyze, 20/min chat per IP, 429). Verify with a 7× burst on
   `/api/imaging/analyze` after merge.
2. **`parseImageDataUrl` leaks a raw `SyntaxError`** for malformed provider
   JSON (found by `imaging-recognition.test.ts`, two-object embedded case).
   The route catches it and returns a 422, but the client sees the raw
   `JSON.parse` message. Suggestion: in `parseJsonObject`, wrap the
   brace-extraction `JSON.parse` so it throws the fixed user-safe message.
3. **Magic-byte sniffing** (PNG `\x89PNG`, JPEG `\xFF\xD8`, WebP `RIFF....WEBP`)
   would make the MIME check robust to mislabeled files. Cheap; optional.
4. **Rate-limit key hardening** — key on `x-forwarded-for` when behind a proxy;
   treat `x-forwarded-for` as untrusted and use the rightmost trusted hop.
5. **No auth** — accepted for the single-user deployment. If the chat endpoint
   ships Phase 2 UI, keep its guards identical to analyze (consent, size, rate).
6. **Provider data handling** — image data URLs are transmitted to
   OpenAI/Gemini and processed by them; vendor data policies are out of scope
   here. The de-identification gate is the product-level control.
7. **Per-instance rate windows** on serverless — acceptable per plan, but a
   determined attacker can rotate instances; not a launch blocker for this
   product, documented so the trade-off is explicit.