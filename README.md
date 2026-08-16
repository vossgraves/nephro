# Renal Function — validated kidney calculators

A clinical calculator that runs the exact published equations nephrologists
trust, shows every intermediate value, and cites each constant. No training
data, no randomness, no fake scan animation.

**Routes**

| Route | What it is |
|---|---|
| `/` | Landing page — Three.js hero (custom GLSL kidney shader + particle field), anime.js entrance choreography |
| `/calculator` | The tool: CKD-EPI 2021 eGFR, Cockcroft–Gault, KDIGO staging + risk heat map, 4-variable KFRE (both regional calibrations), optional KDIGO AKI staging, guideline-derived guidance |
| `/imaging` | Imaging workspace: local viewer tools, technical image-quality metrics, annotations, pixel measurements, Bosniak v2019 checklist, optional AI-assisted visual review |
| `/records` | Saved assessments (Neon/Postgres) |
| `/methods` | Every equation with formula, constants, worked example, and primary source |

## Imaging review (AI-assisted visual review)

The `/imaging` workspace is a viewer plus an optional, clinician-gated review:

- **Viewer tools**: zoom, pan, brightness/contrast, invert, grid, pixel probe,
  rotate, fit-to-screen, fullscreen. All client-side.
- **Technical image-quality metrics**: pixel-statistics scoring (resolution,
  contrast, brightness, noise, visibility) computed in the browser. These are
  **technical image-quality metrics, not clinical measurements** — the UI
  labels them as such.
- **Annotations and measurements**: arrow/circle/rectangle/freehand/text
  overlays, plus pixel distance/angle/area tools. Measurements are labelled
  "pixels — no calibration data"; they are not clinical measurements.
- **Bosniak v2019 checklist**: a structured feature checklist that maps to the
  published classification (decision logic in `src/lib/bosniak.ts`).
- **AI-assisted visual review** (optional, opt-in per image): sends the image
  to a server-side AI provider and returns a normalized, non-diagnostic
  technical review.

### AI provider layer

Server-side only. The browser never holds provider API keys.

- Providers: OpenAI and Gemini, implemented behind one `VisionProvider`
  interface (`src/lib/ai/types.ts`). Default order is Gemini first, OpenAI as
  fallback; a specific provider can be preferred per request.
- Requests use JSON mode with a per-modality system prompt that restricts
  output to technical/structural observations, forbids diagnosis, and pins a
  fixed safety note. Responses are normalized and capped client-side-safe
  (`normalizeReport` in `src/lib/imaging-recognition.ts`).
- One retry per provider only on network/5xx failures (never on 4xx or
  timeouts), 800 ms backoff, 45 s per-request timeout.
- Model defaults: `OPENAI_VISION_MODEL` → `gpt-5-mini`;
  `GEMINI_VISION_MODEL` → `gemini-2.5-flash`. `OPENAI_API_BASE` is optional
  and only needed for an OpenAI-compatible gateway.

### Endpoints

| Endpoint | Purpose | Guards |
|---|---|---|
| `GET /api/imaging/analyze` | Provider configuration status + limits | none (public, benign) |
| `POST /api/imaging/analyze` | Analyze one image (`{imageDataUrl, modality, clinicalQuestion?, deidentifiedConfirmed, provider?}`) → `{report}` | modality allowlist, PNG/JPEG/WebP + ≤4 MB decoded, consent flag required, content-length guard (413), rate limit |
| `POST /api/imaging/chat` | Ask a question about an image (`{imageDataUrl, modality, question, deidentifiedConfirmed, priorReport?}`) → `{answer, provider, model}` | same guards as analyze |

Errors use the shape `{error, code?, providerDetails?}`; unknown failures map
to 422, no-provider/both-failed to 503, validation to 400.

### Rate limits

Per-IP, in-memory sliding window, enforced server-side: **6 analyze
requests/minute**, **20 chat requests/minute**; excess requests get 429 with a
friendly message. Caveat: each serverless instance keeps its own window, so
limits are per-instance rather than global. This is acceptable for the current
deployment.

### Privacy

Images are sent to the configured provider only after the user confirms
de-identification. Nothing is persisted: no database writes, no image storage.
All responses are `no-store`. See `research/security-audit.md` for the
itemized §37 audit, including accepted risks (no auth by design, per-instance
rate windows).

## Run locally

```bash
npm install
npm run dev
```

Configure providers by copying `.env.example` to `.env.local` and adding
`OPENAI_API_KEY` and/or `GEMINI_API_KEY`. The imaging page works without keys
(local review only); the AI review shows "providers unavailable".

## Verify the math

```bash
npm test        # sequential unit tests: renal equations, imaging-report
                # normalization, Bosniak classification, image-quality scoring
npm run typecheck
npm run build
```

## Connect Neon (optional but recommended for Records)

1. Create a Neon project, copy the connection string.
2. Add it as `DATABASE_URL` in `.env.local`:
   ```
   DATABASE_URL=postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
3. The `kidney_records` table is created automatically on first use.

The calculator works fully without a database — only saving is disabled.

## Deploy to Vercel

```bash
npm i -g vercel
vercel          # link the project
vercel env add DATABASE_URL   # production
vercel env add OPENAI_API_KEY # production (and GEMINI_API_KEY, optional)
vercel --prod
```

## Design notes

- Design tokens in `src/app/globals.css` (OKLCH, light/dark via
  `prefers-color-scheme`, `color-scheme` synced).
- The 3D hero is client-only (`next/dynamic`, `ssr: false` inside a client
  wrapper) so the landing stays a static prerender.
- Equations live in `src/lib/renal.ts` — pure functions, no React, unit-tested.
- Imaging logic lives in `src/lib/imaging-recognition.ts` (prompt + report
  normalization), `src/lib/bosniak.ts` (classification), and
  `src/lib/image-quality.ts` (pure scoring) — all unit-tested.
- KFRE defaults to the non-North-American calibration (S0 2yr 0.9832 / 5yr
  0.9365) because that's the correct default outside US/Canada; North American
  is selectable (0.9751 / 0.9240). Using the wrong one is the most common
  implementation error.

**Not a medical device.** Every result must be interpreted by a clinician.