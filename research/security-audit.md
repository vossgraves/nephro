# Nephro security audit — §37 checklist

Initial audit: 2026-08-16. Re-verified 2026-08-16 against the merged
imaging upgrade (branch `feat/nephro-production-upgrade`, worker B routes and
orchestrator now in place). Method: static review of `src/` against the §37
security checklist from the product plan. Re-verify the statuses again before
any public launch (they describe the current branch state, not post-launch
traffic).

Status legend: **Pass** = verified in current code. **Partial** = mitigation
exists but has gaps. **Fixed** = previously flagged, now resolved.
**Risk (accepted)** = by design.

| # | Item | Status | Evidence / location | Notes |
|---|---|---|---|---|
| 1 | Upload MIME validation | Pass | `validateImageDataUrl` in `src/lib/ai/orchestrator.ts` (single enforcement point shared by both routes): regex `data:image/(png\|jpeg\|webp);base64,...`; client-side gate in `ImagingWorkspace.tsx` | Violations throw `RequestValidationError` → 422. Gap remains: no magic-byte sniffing after decode; a renamed file with a valid header passes. Low risk, see follow-ups. |
| 2 | Upload size validation | Pass | Decoded-image cap 4 MB (`MAX_ANALYSIS_FILE_BYTES`) in `validateImageDataUrl` → 422; request-body cap 7 MB (`MAX_REQUEST_BODY_BYTES` in `api/imaging/shared.ts`) enforced twice: content-length header check before reading (413) and raw text length after reading (413), on both `/api/imaging/analyze` and `/api/imaging/chat` | The 7 MB cap is the base64 overhead (~4/3×) over the 4 MB image limit because the guard runs pre-parse. Response code `PAYLOAD_TOO_LARGE`. |
| 3 | Consent gate (de-identification) | Pass | Both routes require `deidentifiedConfirmed === true`, else 400; send button disabled client-side until confirmed | Server trusts the boolean; no automated PHI detection. Documented limitation. |
| 4 | HTTP no-store | Pass | `noStoreJson` sets `Cache-Control: no-store, max-age=0` on every API response (including errors); provider fetches use `cache: "no-store"` (`openai.ts`, `gemini.ts`) | Prevents CDN/browser caching of image-bearing responses. |
| 5 | API keys server-only | Pass | Keys read only via `process.env` (`configuredProviders()` in `shared.ts`; `isConfigured()`/fetch in `openai.ts`, `gemini.ts`); never `NEXT_PUBLIC_`-prefixed; `.env.example` says the same | Env vars: `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_VISION_MODEL`, `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`, `DATABASE_URL`. Model defaults now match docs: `gpt-5-mini`, `gemini-2.5-flash`. |
| 6 | Rate limiting | Pass | `checkRateLimit` (`src/lib/ai/rate-limit.ts`): in-memory sliding window, keyed `analyze:{ip}` 6/min and `chat:{ip}` 20/min, 60 s window, checked before body read; capped at 10,000 tracked keys, fails closed on bad config | 429 + `Retry-After: 60` + friendly message (code `RATE_LIMITED`). Per-IP key from first `x-forwarded-for` hop, else `x-real-ip`, else `"unknown"`. Caveat (documented in `rate-limit.ts`): each serverless instance keeps its own window, so limits are per-instance, not global. |
| 7 | No PHI persistence | Pass | No database write for images; `db.ts` persists calculator records only; images exist only in the request body and the provider call | No localStorage/IndexedDB usage for images. |
| 8 | No authentication | Risk (accepted) | No auth on any route; documented design (single-user product, no accounts) | Rate limits and the consent gate are the abuse controls. Revisit before multi-user/launch. `GET /api/imaging/analyze` intentionally reveals which providers are configured; benign. |
| 9 | Prompt injection mitigations | Partial | `recognitionSystemPrompt` (analyze) and `buildChatSystemPrompt` (chat): fixed role framing ("never diagnose…"), modality-specific boundaries, strict JSON-only schema, pinned safety note, no fabricated measurements; user text capped at 600 chars at route and orchestrator level; chat answer clamped to ~300 words; output post-processed by `normalizeReport` (status allowlist, arrays capped, fixed safety note) | Image content can still carry adversarial text; the prompt rules are a mitigation, not a guarantee. |
| 10 | XSS: React escaping, no dangerouslySetInnerHTML | Pass | Grep across `src/` (re-run after imaging workspace merge): zero `dangerouslySetInnerHTML` matches; model output rendered through React JSX text nodes | A provider-returned `<script>` cannot execute. |
| 11 | Sensitive logging | Pass (with note) | Routes log only error messages (`"Imaging analysis request failed unexpectedly"`, `"Imaging chat request failed unexpectedly"`); providers log/throw status and kind, never keys, never image payloads, never full provider responses | Vercel function logs persist console output; do not enable request-body logging. |

## Fixed since the initial audit

1. **`parseJsonObject` raw-SyntaxError leak** — the integrator wrapped the
   fenced and embedded-object parses so every unreadable response now throws
   the fixed user-safe message; `imaging-recognition.test.ts` pins the
   friendly-message behavior. **Fixed.**
2. **Rate limiting wiring** — `checkRateLimit` is now wired into both routes
   (6/min analyze, 20/min chat, per-IP, 429 + Retry-After). **Implemented**;
   the remaining action below is verification, not code.
3. **Model default mismatch** — `analyze/route.ts` pre-upgrade defaults
   (`gpt-5.6-terra`, `gemini-3.6-flash`) replaced by `gpt-5-mini` and
   `gemini-2.5-flash`, matching `.env.example`. **Fixed.**
4. **7 MB body cap** — content-length guard (pre-parse) plus post-read text
   length check with 413 on both routes. **Implemented.**

## Residual risks and follow-ups

1. **Verify rate limiting with a burst test** after launch wiring: 7× analyze
   burst within a minute → 6th–7th requests expect 429 + `Retry-After: 60`;
   21× chat burst likewise. (Code is in place; this is behavioral
   verification.)
2. **Magic-byte sniffing** (PNG `\x89PNG`, JPEG `\xFF\xD8`, WebP `RIFF....WEBP`)
   would make the MIME check robust to mislabeled files. Cheap; optional.
3. **Rate-limit key hardening** — the key uses the first `x-forwarded-for`
   hop, which the platform proxy is trusted to set. Behind a multi-hop proxy,
   use the rightmost trusted hop instead.
4. **No auth** — accepted for the single-user deployment; revisit before
   multi-user/launch. Keep the chat endpoint's guards identical to analyze.
5. **Provider data handling** — image data URLs are transmitted to
   OpenAI/Gemini and processed by them; vendor data policies are out of scope
   here. The de-identification gate is the product-level control.
6. **Per-instance rate windows on serverless** — implemented and documented;
   a determined attacker can rotate instances. Not a launch blocker for this
   product, but a shared store (Redis/Upstash) would be required for strict
   global limits.