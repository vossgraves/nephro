# Nephro production upgrade — implementation plan (Kimi/architect)

Baseline verified 2026-08-16: typecheck PASS, tests PASS, build PASS, lint configured (eslint 9 flat).
Safety branch: `backup/pre-nephro-improvements` (pushed). Work branch: `feat/nephro-production-upgrade`.

## File ownership matrix (strict — do not edit files owned by another worker)

| Worker | Owns (create/edit) | Must NOT touch |
|---|---|---|
| A imaging-core | `src/components/imaging/**`, `src/app/imaging/page.tsx`, `src/lib/image-quality.ts` (add `extractImageStats`), `src/lib/annotations.ts`, `src/lib/measurements.ts` | `src/lib/ai/**`, `src/lib/imaging-recognition.ts`, `src/app/api/**`, hero/landing files, `globals.css` |
| B ai-backend | `src/lib/ai/**` (openai.ts, gemini.ts, orchestrator.ts, rate-limit.ts; types.ts exists — extend, don't break exports), `src/app/api/imaging/**` (analyze refactor + new chat route) | imaging components, hero/landing, tests, `globals.css` |
| C landing-3d | `src/components/hero/**`, `src/app/page.tsx`, `src/components/SiteNav.tsx`, `src/components/SplashGate.tsx`, `src/components/Reveal.tsx` (additive only, keep API), `src/app/layout.tsx` (additive metadata only) | imaging, api, lib (except nothing), `globals.css` tail-append ONLY if unavoidable |
| D tests-docs | `src/lib/*.test.ts` (new files only), `README.md`, `DEPLOYMENT_GUIDE.md`, `.env.example` (comments/names only), `research/security-audit.md` (new), `package.json` `test` script (run all tests) | any `src/**` non-test source, api routes, components |

Shared files nobody edits except me (integrator): `src/lib/renal.ts`, `src/lib/db.ts`, `tsconfig.json`, `next.config.ts`, `src/app/calculator/page.tsx`, `src/app/records/*`, `src/app/methods/page.tsx`, `src/app/tools/page.tsx`.

## Contracts (fixed by architect)

1. `src/lib/ai/types.ts` — EXISTS, do not change its exported names. `VisionProvider`,
   `VisionInput`, `VisionAnalysis`, `ChatInput`, `ChatAnswer`, `ProviderError`,
   `AnalysisOutcome`, `ChatOutcome`, `ProviderFailureKind`.
2. `src/lib/image-quality.ts` — EXISTS with `ImageStats`, `ImageQualityMetrics`,
   `scoreFromStats` (implemented, pure). Worker A ADDS:
   `export function extractImageStats(image: HTMLImageElement, maxSampleEdge?: number): ImageStats`
   (canvas downsample ≤ 256px edge, compute mean/stddev luminance, Laplacian-kernel
   high-frequency energy, clipped fraction at <4 or >251, p95−p5 spread).
3. `src/lib/bosniak.ts` — EXISTS (`BOSNIAK_FEATURES`, `bosniakClass`). Worker A updates
   `ImagingWorkspace.tsx` to import from it and deletes the local copies (also removes the
   now-unused `BosniakFeatureId` lint warning there).

## Worker A — imaging workspace (core feature work)

In `ImagingWorkspace.tsx` (rewrite in place, keep existing design language: CSS vars
`--bg/--surface/--surface-raised/--surface-inset/--border/--text/--muted/--accent/--accent-fg/--radius-base/--shadow-card`, inline styles, `pressable` class, breakpoint helper 720/1120):

1. **Viewer tools**: add rotate (90° steps, drawn into canvas transform), fullscreen
   (Fullscreen API on the viewer card), fit-to-screen button. Existing zoom/pan/brightness/
   contrast/invert/grid/pixel-probe stay working.
2. **Technical image quality panel** (§22): `extractImageStats` + `scoreFromStats`, render
   score 0–100 + 5 sub-scores, labelled "Technical image-quality metrics — not clinical
   measurements". Recompute when a new image loads. Show modality + processing state in the
   file-facts area (§21).
3. **Annotations** (§31): overlay canvas aligned with the image canvas. Tools: arrow,
   circle, rectangle, freehand, text (prompt for text via small inline input). Undo, redo,
   delete selected, clear all. Store shapes in IMAGE-RELATIVE coordinates (fractions of
   natural width/height) so they survive zoom/pan/resize/rotate/fullscreen. Selected shape
   highlight + drag to move is a stretch goal.
4. **Measurements** (§32): distance (px), angle (3 points), area (rectangle ROI, px²).
   Label clearly "pixels — no calibration data". Toggleable measurement mode that doesn't
   fight annotation mode (one active tool at a time).
5. Keep everything working on phone breakpoint (touch: pointer events already used).
6. Do NOT fake anything; no new npm dependencies; strict TS; no `any`.

Also fix while in file: remove unused `viewerHeight` variable.

## Worker B — AI backend (server architecture, §23–28, §37)

Create `src/lib/ai/`:
- `openai.ts`: `class OpenAIProvider implements VisionProvider`. Fetch
  `{OPENAI_API_BASE||https://api.openai.com/v1}/chat/completions`, JSON mode, `detail:"high"`,
  model `OPENAI_VISION_MODEL || "gpt-5-mini"`, temperature 0.1, system prompt from
  `recognitionSystemPrompt`. Timeout 45s via AbortController (combined with caller signal).
  Map HTTP statuses to `ProviderError` kinds (401/403 auth, 404 unavailable-model, 429
  rate-limited, 5xx/ECONN/AbortError timeout-network). Parse with existing
  `parseJsonObject` + `normalizeReport`.
- `gemini.ts`: same contract against generativelanguage v1beta, model
  `GEMINI_VISION_MODEL || "gemini-2.5-flash"`, responseMimeType json. IMPORTANT: keep
  `gemini-2.5-flash` as the default (`.env.example` documents it); do not invent model names.
- `orchestrator.ts`: `analyzeImage({imageDataUrl, modality, clinicalQuestion, provider?})`
  and `chatAboutImage({...})`. Provider order: explicit request first, then the other
  configured provider as fallback; default order gemini → openai (preserve current
  behavior). Validate the data URL (reuse the same MIME/size rules), return
  `AnalysisOutcome`/`ChatOutcome` discriminated unions. One retry per provider ONLY on
  network/5xx (never on 4xx or timeout), 800 ms backoff.
- `rate-limit.ts`: in-memory sliding window (per-IP): analyze 6/min, chat 20/min.
  `export function checkRateLimit(key: string, limit: number, windowMs: number): boolean`.
  Document that serverless instances each have their own window (acceptable here).
- Routes:
  - `src/app/api/imaging/analyze/route.ts` — rewrite as a thin handler over the
    orchestrator. KEEP the existing response contract: GET `{configured, maxImageBytes, privacy}`;
    POST success `{report}`; errors `{error, code?, providerDetails?}` with the same status
    codes as today (400 validation, 503 no-provider/both-failed, 422 other). Add: optional
    `provider` field ("openai"|"gemini") to prefer one; content-length guard
    (reject > 7 MB before parsing, 413); rate limit (429 with friendly message);
    keep `no-store` + consent gate `deidentifiedConfirmed === true`.
  - NEW `src/app/api/imaging/chat/route.ts` — POST `{imageDataUrl, modality, question,
    deidentifiedConfirmed, priorReport?}` → `{ answer, provider, model }`. Same guards.
    System prompt: answer questions about the visible image within the same non-diagnostic
    boundaries; reference `priorReport` JSON if provided; plain-text answer, max ~300 words.
- No new dependencies. Strict TS. Never log secrets or image data.

## Worker C — landing / Three.js (§12–13, §18–19)

Keep the existing design identity (it is ours, not the friend's). Files owned per matrix.

1. **WebGL fallback**: in `KidneyScene.tsx` (and any R3F canvas mount), detect WebGL
   support before creating a context; on failure render the existing poster
   `/media/nephro-kidney-tablet-desktop-poster.png` in a styled frame. Also add
   `onCreated` error tolerance and an error boundary so a WebGL crash can't blank the page.
2. **Performance tiers** (§13): `getPerfTier()` helper (new file under
   `src/components/hero/`): low = dpr 1, particles 90, no fresnel-time animation;
   mid = dpr ≤1.25, particles 180; high = current settings. Base it on
   `navigator.hardwareConcurrency`, `deviceMemory` (guard undefined), mobile pointer
   coarse, and honor `prefers-reduced-motion` (already partially handled — keep).
   Keep the IntersectionObserver frameloop pause.
3. **Interaction** (from OUR design handoff, not the friend's UI): add the
   pointer-repel ripple — on pointerdown/drag over the hero canvas, nearby particles
   repel outward with damped spring-back (velocity += force, damped per frame). Implement
   on the existing `Particles` system; keep particle cap ≤ 340.
4. **Hero polish**: keep `HeroVideo` poster behavior; make sure the video isn't fetched on
   `prefers-reduced-motion` or save-data. Check `HeroStats` count-up respects reduced motion.
5. **Nav/accessibility**: SiteNav horizontal-scroll edge-fade mask (CSS mask-image) so
   labels don't clip mid-glyph; focus-visible rings on all nav links; aria-current on the
   active route.
6. Landing copy stays medically safe. No new dependencies.

## Worker D — tests + docs (§39, §43, §37)

1. `src/lib/imaging-recognition.test.ts` — normalizeReport (garbage input → safe defaults,
   arrays capped, bad reviewStatus → "limited"), parseJsonObject (fenced, embedded, invalid
   throws), prompt contains safety boundaries for each modality.
2. `src/lib/bosniak.test.ts` — every class path incl. precedence (solid > nodule/irregular >
   many-septa > thin/few septa > thin-wall), empty set → null.
3. `src/lib/image-quality.test.ts` — `scoreFromStats` pure tests: perfect stats → high 90s,
   black image (zero spread) → low contrast, over/under-exposed brightness penalties,
   clamping bounds, determinism.
4. Update `package.json` test script to run all `src/lib/*.test.ts` files via tsx
   (e.g. `tsx --test` is NOT needed — follow the existing simple style:
   `tsx src/lib/renal.test.ts && tsx src/lib/imaging-recognition.test.ts && ...`) and make
   each new test file exit non-zero on failure like the existing one.
5. `research/security-audit.md` — audit list from §37 with status per item (upload MIME +
   size validation present, consent gate present, no-store, keys server-only, rate limiting
   (lands with worker B), no PHI persistence, no auth by design (documented risk), prompt
   injection mitigations in system prompt, XSS: React escaping + no dangerouslySetInnerHTML
   (verify), sensitive logging check).
6. README: document the AI provider layer, chat endpoint, imaging tools, quality metrics
   disclaimer, rate limits, and the `OPENAI_VISION_MODEL`/`GEMINI_VISION_MODEL` defaults.
   Keep tone factual (no marketing slop).
7. Verify `.env.example` matches the code's variable names (report mismatches, fix comments
   only). Do NOT print or add secret values.
8. Run ONLY `pnpm test` (fast, pure-node tsx). No installs, no builds, no dev server.

## Power/device constraint (all workers)
This runs on a phone (Termux). Do NOT run: pnpm install, pnpm build, next dev,
typecheck loops. You may run `pnpm exec tsc --noEmit` at most ONCE at the very end of your
task (or not at all if you're confident — integrator verifies centrally). No watch modes.

## Phase 2 (after merge): integrator (me) adds
Report generation UI (copy/download/print), findings confirm/edit/reject, "Ask about this
image" chat panel (wired to B's endpoint), image comparison mode if time allows, then
typecheck/lint/test/build + browser verification + Vercel preview.
