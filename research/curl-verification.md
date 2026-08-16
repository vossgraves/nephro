# Live curl verification — production server at http://127.0.0.1:3111

Date: 2026-08-16 (approx. 10:07–10:09 UTC)
Method: curl only (no browser, no dev server changes). Server: `next start` production build on 127.0.0.1:3111. Local environment has NO provider API keys, so provider calls exercise the graceful no-provider path.

## 1. GET / → PASS

- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3111/` → `200`
- Body contains hero heading: `grep -c "Kidney numbers"` → `1`
- Body contains footer disclaimer: `grep -c "Not a medical device"` → `1`, `grep -c "does not diagnose"` → `1`

## 2. Static page status + headings → PASS (all 200)

| Page | Status | Expected heading string | Present |
|---|---|---|---|
| /calculator | 200 | `Clinical calculator` | 1 |
| /imaging | 200 | `Real visual review` | 1 |
| /records | 200 | `Patient records` | 1 |
| /methods | 200 | `Methods &amp; sources` | 1 |
| /tools | 200 | `Clinical toolbox` | 1 |

All returned `heading=<count>` of ≥1 in the HTML body.

## 3. POST /api/imaging/analyze — graceful no-provider path → PASS

Payload: real 1×1 PNG data URL, `modality: "ultrasound"`, `deidentifiedConfirmed: true`.

- HTTP status: `503 Service Unavailable`
- Body:

```json
{"error":"No AI providers configured. Add GEMINI_API_KEY and/or OPENAI_API_KEY as server-side environment variables.","code":"NO_PROVIDERS_CONFIGURED"}
```

- Response headers include `cache-control: no-store, max-age=0`, `content-type: application/json`.

## 4. POST /api/imaging/chat — graceful no-provider path → PASS

Payload: same PNG, plus `question: "Is this image sharp?"`.

- HTTP status: `503 Service Unavailable`
- Body:

```json
{"error":"No AI providers configured. Add GEMINI_API_KEY and/or OPENAI_API_KEY as server-side environment variables.","code":"NO_PROVIDERS_CONFIGURED"}
```

- Response headers include `cache-control: no-store, max-age=0`.

## 5. Rate limit — 7 rapid analyze POSTs from same IP → PASS

Observed status sequence (all within the same sliding window; the item 3 check consumed one of the 6 allowed per-minute slots, so the 6th rapid call was already the 7th request in the window):

```
rapid 1..5 -> 503 (allowed by rate limiter, then no-provider path)
rapid 6    -> 429 {"error":"Too many requests. Please wait about a minute and try again.","code":"RATE_LIMITED"}
rapid 7    -> 429 (same body)
```

- The 7th rapid POST returns `429` as required, with `Retry-After: 60` on subsequent 429 responses:

```
HTTP/1.1 429 Too Many Requests
cache-control: no-store, max-age=0
content-type: application/json
retry-after: 60
```

- Rate limiting is per serverless-instance memory (in-memory sliding window); on this single local instance the 6/min/IP limit holds exactly: requests 1–6 accepted, 7+ rejected. Multi-instance deployments get per-instance windows (documented in `src/lib/ai/rate-limit.ts`).

## 6. Security headers spot-check → PASS

| Endpoint/method | Status | Cache-Control |
|---|---|---|
| GET /api/imaging/analyze | 200 | `no-store, max-age=0` |
| POST /api/imaging/analyze (503) | 503 | `no-store, max-age=0` |
| POST /api/imaging/chat (503) | 503 | `no-store, max-age=0` |
| POST /api/imaging/analyze (429) | 429 | `no-store, max-age=0` |

GET /api/imaging/analyze body confirms config probe shape:

```json
{"configured":{"openai":false,"gemini":false},"maxImageBytes":4194304,"privacy":"Images are sent to the selected configured provider only after client confirmation. The endpoint does not persist them."}
```

## Summary

| # | Check | Result |
|---|---|---|
| 1 | GET / hero + footer disclaimer | PASS |
| 2 | /calculator /imaging /records /methods /tools → 200 + headings | PASS |
| 3 | POST analyze → 503 NO_PROVIDERS_CONFIGURED | PASS |
| 4 | POST chat → 503 NO_PROVIDERS_CONFIGURED | PASS |
| 5 | 7th rapid analyze POST → 429 + Retry-After | PASS |
| 6 | no-store headers on API | PASS |

No app code was modified; no commits made.