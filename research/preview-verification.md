# Live preview verification — Vercel (Worker C)

Run: 2026-08-16 ~10:44-10:55 UTC against
**https://nephro-mnjh2hpp5-mhsmdactcs-projects.vercel.app** (protection disabled by
coordinator). Tooling: agent-browser 0.34.0 + chromium, named session
`nephro-live-82d1e51c30b0`. Test image: `/tmp/nephro-test.png` (2.0 KB, 320×240).
This is the master prompt's "never claim without testing" gate: the live AI + DB
paths were exercised for real, not assumed.

## Summary

| # | Item | Result |
|---|---|---|
| 1 | All 6 routes 200 + home screenshot | **PASS** |
| 2 | /imaging real AI analysis + report | **FAIL** (both providers error at call time — exact errors captured) |
| 3 | Chat real answer | **FAIL** (same provider error) |
| 4 | Findings confirm/edit + report + copy + download | **SKIP** for confirm/edit (no AI findings exist); report generation **PASS**; COPY **PARTIAL**; DOWNLOAD **PASS** |
| 5 | Calculator save → records row → delete | **FAIL** at save (DATABASE_URL missing at runtime on preview); delete **SKIP** (no row) |
| 6 | axe on /calculator + /imaging (fixes) | **PASS** — 0 violations on both |
| 7 | Console errors + failed HTTP per route | **PASS** — 0 console errors, 0 HTTP ≥400 page loads |

Provider answered: **neither.** Both providers failed on real calls (see item 2).
No provider/model line could be produced — that report feature is unverifiable
until the credentials/model are fixed.

## Item details

### 1. Routes + home — PASS
All six routes returned 200: `/` (3.2 s first hit, cold), `/calculator` 0.70 s,
`/imaging` 0.90 s, `/records` 0.84 s, `/methods` 0.69 s, `/tools` 0.74 s.
Provider probe: `{"configured":{"openai":true,"gemini":true}}`. Home renders with
title; screenshot `research/shots/live-home.png`. Console: only the known
`THREE.Clock` deprecation warning.

### 2. /imaging real analysis — FAIL with exact provider errors
- Upload, viewer canvas, file facts ("nephro-test.png 2.0 KB · 320 × 240 px"),
  "Technical image quality" panel: **PASS**.
- Consent checkbox: **PASS** (checked).
- Provider status: **PASS** — badge "Ready to analyze" (probe reports both
  providers configured).
- `Request AI review`: honest progress stage **"Uploading image…" observed**;
  on the warm instance the provider error then surfaced in ~1-2 s (server time
  per HAR: **808 ms**); the first (cold) attempt took ~70 s to error. The
  "Waiting for provider…" stage was not observed on live because both providers
  fail immediately on this instance — the stage logic was already verified on
  the local build.
- **Exact server response** (HAR `research/shots/har-live-analyze.json`):

  ```
  HTTP 503
  {"error":"Provider API keys are being rejected. Check the GEMINI_API_KEY and
   OPENAI_API_KEY environment variables in Vercel.",
   "code":"BOTH_PROVIDERS_FAILED",
   "providerDetails":[
     "gemini: model unavailable (check the model name)",
     "openai: API key rejected (check the configured key)"]}
  ```

  UI shows the friendly error verbatim (role=alert); no crash, no blank page.
  Screenshot: `research/shots/live-imaging-analyze-error.png`.
- Interpretation for the push gate: the `configured:true` probe only checks env
  **presence**, not validity. Real calls show (a) the **OpenAI key is rejected**
  (401-class), and (b) the **Gemini model is unavailable** — i.e. the default
  `gemini-2.5-flash` returns a model-not-found for this key/setup (candidate:
  model id retired/changed; try `gemini-2.5-flash-latest` or the current id in
  the plan's provider layer). Both need coordinator action before AI can be
  claimed working.

### 3. Chat — FAIL (same cause)
Question "Describe the visible structures." → send enabled (consent + text),
request sent, **no answer**; the same 503-family error renders in the chat
alert area. Screenshot: `research/shots/live-imaging-chat.png`. This is the
honest failure path, not a crash — but the real-answer flow cannot be verified
while both providers error.

### 4. Findings review + report
- **Confirm one finding / edit another: SKIP.** Findings are populated only from
  a successful AI report (no manual-add path in the workspace). With both
  providers failing, no findings render, so the Confirm / Reject / Edit controls
  (`Edit finding N` textarea, Confirm/Reject buttons) cannot be exercised
  end-to-end. Re-verify after the provider fix.
- **Generate review report (checklist-driven): PASS.** Selecting 2 Bosniak
  checklist items enabled the button; click rendered
  `#generated-review-report` (826 chars) with modality, file facts, technical
  quality metrics, checklist items, and the AI-assistance notice. Buttons:
  Copy / Download .md / Print. Screenshot: `research/shots/live-imaging-report.png`.
- **COPY: PARTIAL.** Clicking Copy flipped the button to **"Copy failed"** —
  the honest failure feedback works, but the success path could not be verified
  because headless chromium denies `navigator.clipboard.writeText` permission.
  A human/browser pass is needed to confirm "Copied" + clipboard content.
- **DOWNLOAD: PASS.** `agent-browser download` produced
  `research/shots/live-report.md` (663 B) — valid Markdown (quality metrics
  etc.). Note: the sticky header covered the button's click point once; after
  scrolling it into center view the download worked (automation artifact).

### 5. Calculator → records → delete — FAIL at save
- Values (age 58, female, Scr 1.4 mg/dL, weight 70, uACR 180) → results
  computed (eGFR 43.6, save enabled): **PASS**.
- **Save to records: FAIL.** The server action responded (HTTP 200, Next
  server-action framing — HAR `research/shots/har-live-save.json`):

  ```
  1:{"ok":false,"error":"Database not configured (DATABASE_URL missing)."}
  ```

  UI showed exactly that message (screenshot
  `research/shots/live-calculator-save-error.png`).
- `/records`: shows the **"No records yet"** empty state, 0 rows, and **no**
  "Database not connected" banner (screenshot `research/shots/live-records.png`)
  even though the save action says DATABASE_URL is missing. `isDbConfigured()`
  is `Boolean(process.env.DATABASE_URL)` evaluated per call (`src/lib/db.ts:11`);
  the discrepancy suggests the records page may be a statically prerendered
  snapshot while the server action sees the runtime env — either way the live
  preview does **not** have a usable DATABASE_URL at runtime.
- **Delete: SKIP** (no row exists to delete; the window.confirm path was
  therefore never exercised).

### 6. axe on live (fix confirmation) — PASS
- `/calculator`: **0 violations** (heatmap "very-high" cells now pass; the
  4.32:1 → ≥4.5:1 token fix is effective). Incomplete (manual review only):
  10 color-contrast nodes (translucent header/nav, muted small text).
- `/imaging`: **0 violations** (the two unlabeled range sliders are now
  labeled; the critical `label` finding is resolved). Incomplete: 10 color-
  contrast nodes (manual review).
- JSON: `research/shots/axe-live-calculator.json`,
  `research/shots/axe-live-imaging.json`.

### 7. Console + failed network per route — PASS
After reload on each route: **0 console `[error]` entries, 0 HTTP ≥400
responses** on `/`, `/calculator`, `/imaging`, `/records`, `/methods`,
`/tools` (HARs `research/shots/har-live-*.json`). The only console output is the
known THREE.Clock deprecation warning. The intentional 503s from the analyze/
chat provider calls are API failures, not page-load failures, and are captured
separately in `har-live-analyze.json`.

## Blocking defects for the push gate (coordinator triage — nothing fixed here)

1. **[BLOCKING] OpenAI key rejected on the preview** — `openai: API key rejected
   (check the configured key)`. Check OPENAI_API_KEY in the Vercel preview env;
   verify billing/org and that the var is deployed to the preview scope (not
   only production).
2. **[BLOCKING] Gemini model unavailable** — `gemini: model unavailable (check
   the model name)`. The default `gemini-2.5-flash` appears invalid for this
   key; confirm the current model id and update `GEMINI_VISION_MODEL` /
   chat model default accordingly (do not invent names — check Google's list).
3. **[BLOCKING] DATABASE_URL not visible to server actions on the preview** —
   save fails with "Database not configured (DATABASE_URL missing)." while
   /records renders the empty state; verify the env var is set in the Vercel
   preview environment and that `listRecords`/`saveRecord` agree.
4. **[Verify with a human] Copy button success path** — headless denies
   clipboard-write; only the honest "Copy failed" feedback was observed.

## Honest limitations

- No vision on this run: screenshots are evidence by DOM/state assertions and
  artifact sizes, not eyeballs.
- "Waiting for provider…" stage not observed on live (providers fail too fast
  on warm instances); the stage state machine was observed on the local build.
- Delete + confirm dialog never exercised (no record to delete).
- Latency feel: page loads 0.7-3.2 s; AI failure surfaces in ~1-2 s warm
  (808 ms server time), ~70 s on the first cold invocation.