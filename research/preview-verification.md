# Live preview verification — Vercel (Worker C)

## Re-verification on the NEW preview (2026-08-16 ~11:05-11:21 UTC)

URL: **https://nephro-puoj3mg6p-mhsmdactcs-projects.vercel.app**
(protection disabled; Gemini fixed via `GEMINI_VISION_MODEL=gemini-3.6-flash`,
DATABASE_URL value repaired per coordinator; OPENAI_API_KEY still rejected
server-side — 401, key problem, not code). Agent-browser 0.34.0, session
`nephro-live2-82d1e51c30b0`. Test image `/tmp/nephro-test.png` (2.0 KB, 320×240).

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | 6 routes 200, screenshot home | **PASS** | `/` 1.04 s, `/imaging` 0.67 s, `/records` 0.80 s etc.; home clean; only the known THREE.Clock warning |
| 2 | Request AI review → report + provider/model | **PASS** | Upload, viewer, quality panel, consent, "Ready to analyze" all PASS. Click → honest stage "Uploading image…" (~14 s) → report renders. HTTP 200, server time 13.8 s (HAR `har-live2-analyze.json`); body `{provider:"gemini", model:"gemini-3.6-flash", reviewStatus:"not-reviewable", summary:"The uploaded image is a non-clinical graphic illustration depicting concentric oval shapes on a gradient background…"}`. UI shows **"Provider: Gemini Vision · gemini-3.6-flash"**; summary, structured findings (2), "Directly visible features", "Not assessable", "For clinician review", safety note all render. Screenshot `research/shots/live-analysis.png` |
| 3 | Chat → answer + provider/model | **PASS** | "Describe the visible structures." → real answer (820 chars): "This image appears to be a graphic illustration rather than an authentic diagnostic ultrasound frame… no anatomical structures…", ends with **"Gemini Vision · gemini-3.6-flash"** note under the answer + suggestion chips. No errors. Screenshot `research/shots/live-chat.png` |
| 4 | Findings confirm + edit → report with statuses | **PASS** | Finding 1 confirmed (Confirm button → chip), finding 2 edited (Edit → textarea "Edit finding 2" → Save → chip). Generated Markdown (`#generated-review-report`, 1,822 chars) shows **`- [confirmed] Central dark oval figure…`** and **`- [edited] Smooth gray background… — edited: Edited finding: smooth gradient background, likely illustrative — teaching context.`** — both statuses propagate into the report. Screenshot `research/shots/live-findings-report.png`. COPY: partial (headless denies clipboard-write → honest "Copy failed" feedback; success path needs a human browser). DOWNLOAD: PASS (`live-report.md` 663 B, valid Markdown) |
| 5 | Calculator → save → records row → delete | **FAIL** | Values age 58/female/Scr 1.4/70 kg/uACR 180 → results compute, save enabled (PASS). **Save consistently fails** — 5 attempts over ~8 minutes, every one returned the server-action response `{ok:false, error:"Database not configured (DATABASE_URL missing)."}` (HAR `har-live2-save.json`; UI shows the message, screenshot `live-calculator-save-ok.png`). `/records` (cache MISS) renders the "No records yet" empty state without the not-connected banner — i.e. the **page-render lambda sees DATABASE_URL but the server-action lambda does not**. `db.ts` reads `process.env.DATABASE_URL` live (no module-scope capture), so this is env not reaching the action function (stale warm instance booted before the env repair, or env/project settings not propagated to all functions). **Delete: SKIP** (no row exists) |
| 6 | axe /calculator + /imaging | **PASS** | 0 violations on both (JSON `axe-live2-{calculator,imaging}.json`); only manual-review incomplete (translucent header nav text) remains |
| 7 | Console + failed network per route | **PASS** | 0 console `[error]`, 0 HTTP ≥400 page loads on all 6 routes (HARs `har-live2-*.json`) |

**Provider answered: Gemini Vision · gemini-3.6-flash** (both analysis and chat).
Latency feel: analysis ~14 s warm (13.8 s server); chat answer ~12-15 s; page loads 0.7-1.1 s.

### Remaining blocking defect (before push)

- **[BLOCKING] Save to records unavailable on this preview.** The server-action
  function reports `DATABASE_URL` missing while the page-render function sees it.
  Coordinator action suggested: trigger a fresh deployment (or force new
  instances) so all functions boot with the repaired env, then verify one
  save → records row → delete round-trip.
- **[INFO] OPENAI_API_KEY is rejected (401)** on both previews — environment
  key problem, not code; Gemini covers all AI flows (per coordinator).

---

## Initial preview run (2026-08-16 ~10:44-10:56 UTC) — history note

URL: https://nephro-mnjh2hpp5-mhsmdactcs-projects.vercel.app (superseded; kept
for the record). Findings then: all 6 routes 200 (PASS); real AI analysis FAILED
with HTTP 503 `BOTH_PROVIDERS_FAILED`: `providerDetails: ["gemini: model
unavailable (check the model name)", "openai: API key rejected (check the
configured key)"]` (default `gemini-2.5-flash` was invalid for the setup); chat
failed with the same error; findings confirm/edit not exercisable (no AI report);
report generation/copy/download mechanics verified (copy showed honest "Copy
failed" in headless; download produced a .md); calculator save failed with the
same DATABASE_URL error; `/records` empty state; axe confirmed the contrast +
slider-label fixes on that build too; 0 console errors / 0 failed page loads.
Artifacts from that run: `live-home.png`, `live-imaging-analyze-error.png`,
`live-imaging-chat.png`, `live-imaging-report.png`, `live-calculator-save-error.png`,
`live-records.png`, `har-live-*.json`, `axe-live-*.json`.

## Screenshot manifest (live re-verification)

`research/shots/live-home.png`, `live-analysis.png`, `live-chat.png`,
`live-findings-report.png`, `live-calculator-save-ok.png`, plus `live-report.md`
(download artifact) and HARs `har-live2-*.json`, `axe-live2-*.json`.

## Honest limitations

- No vision on this run: screenshots verified by DOM/state assertions and
  artifact sizes, not eyeballs.
- COPY success path unverified (headless clipboard permission); needs a human.
- Delete + window.confirm not exercised (no row to delete).
- The save failure was triaged empirically (5 attempts, HAR'd action response,
  page vs action env discrepancy); the infra root cause (stale function/env
  propagation) is the coordinator's call to resolve.