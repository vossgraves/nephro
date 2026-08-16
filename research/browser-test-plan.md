# Nephro browser verification plan (Worker C)

Purpose: turn the master prompt's 25-point browser checklist into concrete
`agent-browser` (v0.34.0, chromium 151 at `/usr/bin/chromium`) steps for the Nephro
routes `/`, `/calculator`, `/imaging`, `/records`, `/methods`, `/tools`.
Auth and dashboard are **n/a** for this product (no accounts; no dashboard) — those
master items are marked n/a and their slots are filled with product-relevant checks.

> Note: the master prompt's literal checklist text was not available in the worker
> session; the 25 points below are reconstructed from the master categories named in
> the assignment (homepage, navigation, auth n/a, dashboard n/a). The integrator
> should reconcile numbering against the original prompt before the run — the route
> mapping and commands are the durable part.

## Prerequisites (integrator supplies)

- `URL` env var: the running app (do NOT start a dev server here — power constraint).
- Test image at `/tmp/nephro-test.png` (small PNG; valid per the workspace's rules:
  PNG/JPEG/WebP, ≤ 25 MB for local review, ≤ 4 MB for provider analysis, must be
  **de-identified** teaching image).
- Environment-dependent behavior to expect: `/records` needs `DATABASE_URL`
  (else "Database not connected" state — still testable); `/imaging` analyze/chat
  need `OPENAI_API_KEY`/`GEMINI_API_KEY` (else 503 — assert graceful error, not
  success, when keys are absent).

## Setup (one time)

```bash
export URL="http://localhost:3000"                       # integrator-provided
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix nephro-verify)"
mkdir -p research/shots
# sanity: agent-browser skills get core   (already read by Worker C)
```

## Command glossary (used below)

- `agent-browser open "$URL"` / `open "$URL/calculator"` — navigate.
- `snapshot -i` — accessibility tree, interactive elements only; refs `@eN` are fresh
  per snapshot. **Re-snapshot after every mutation/navigation** (refs go stale).
- `get text <sel>` / `get url` / `get title` / `get count <sel>` — asserts.
- `is visible <sel>` / `is enabled <sel>` / `is checked <sel>` — state asserts.
- `find text "…"` / `find role link "Calculator"` — locate by accessible name when a
  snapshot ref is awkward.
- `fill @eN "value"` / `select @eN value` / `check @eN` / `press Tab` — forms.
- `upload input[type=file] /tmp/nephro-test.png` — file input (hidden is fine).
- `mouse move <x> <y>` / `mouse down` / `mouse move <x2> <y2>` / `mouse up` — draw on
  the image canvas (coordinates from `get box`).
- `console` / `errors` — console log + page error capture (**run after every page**).
- `network requests --filter <pattern>` — verify/deny resource fetches.
- `a11y "$URL" --tags wcag2a,wcag2aa,wcag21a,wcag21aa` — axe audit per page.
- `vitals "$URL"` — LCP/CLS/TTFB/FCP/INP + hydration summary (homepage only).
- `screenshot research/shots/<name>.png` — evidence.
- `pdf research/shots/<name>.pdf` — print sanity.
- `set media light reduced-motion` — reduced-motion pass; `set viewport 390 844` —
  mobile pass (reset with `set viewport 1440 900`).
- `close` when done (frees the session browser).

## Selector / ref strategy

1. **Primary**: accessibility snapshot refs (`snapshot -i` → `@eN`). Always
   re-snapshot after navigation/render.
2. **Stable CSS/attribute anchors** (fallbacks, from the source):
   - Nav links: role `link` with text Overview/Calculator/Tools/Imaging/Records/Methods.
   - Calculator inputs: `#name`, `#sex`, `#age`, `#weight`, `#scr`, `#acr`,
     `#region`, `#baseScr`, `#urineOut`; unit selects `select[aria-label="Creatinine unit"]`
     and `select[aria-label="ACR unit"]`; submit `button[type=submit]`.
   - Imaging viewer canvas: `canvas[aria-label^="Image viewer"]`; hidden file input
     `input[type=file]`; drop-zone button text "Choose a de-identified image";
     modality `#modality-select`; optional question `#question`; consent checkbox
     inside label text "I confirm this is a de-identified exported image…"; AI
     submit button text "Request AI review" (aria-busy while in flight); chat input
     `input[aria-label="Question about the image"]`; send
     `button[aria-label="Send question"]`; report region `#generated-review-report`;
     quality heading text "Technical image quality".
   - Records: `button` text "Export CSV"; delete buttons
     `button[aria-label^="Delete record for"]`.
3. When a snapshot ref is ambiguous (e.g. two SiteNav copies in the DOM), scope the
   snapshot: `snapshot -i -s "nav[aria-label='Primary navigation']"`.

## The 25-point checklist → steps

Legend: ✔ = command sequence to run; ⚠ = assert only (no interaction needed);
n/a = not applicable to this product.

| # | Master item | Adapted to Nephro | Steps |
|---|---|---|---|
| 1 | Homepage loads | `/` returns 200, renders, no console errors | ✔ `open "$URL"`; `wait --load networkidle`; `get title` contains "Renal Function"; `console`/`errors` empty; `screenshot research/shots/01-home.png` |
| 2 | Homepage hero | Hero section, headline, CTA, stats, 3D canvas or poster | ⚠ snapshot has heading "Kidney numbers, made clear."; links "Open calculator"/"See the methods"; stats eGFR/KFRE/KDIGO; `get count canvas` ≥ 1 (WebGL path) or poster img visible (fallback); `errors` empty (WebGL shader errors would surface here) |
| 3 | Homepage content sections | Features, steps, guidance, CTA blocks render | ⚠ `get text` contains "Three outputs. One transparent calculation path."; "The answer is not a black box."; "No black boxes. Every intermediate value visible."; "Run it on a real patient, right now." |
| 4 | Navigation present | SiteNav on every page | ✔ per page: `find role navigation "Primary navigation"` visible |
| 5 | Navigation active state | `aria-current="page"` on current route link | ✔ on `/calculator`: `get attr aria-current "nav[aria-label='Primary navigation'] a[href='/calculator']"` === "page"; repeat per route (home = exact `/`) |
| 6 | Navigation keyboard | Tab reaches links, visible focus ring | ✔ `press Tab` ×4 from top; `errors` none; screenshot `06-nav-focus.png` (ring visible) |
| 7 | Navigation mobile | Horizontal scroll + edge fade (no clipped glyphs) | ✔ `set viewport 390 844`; screenshot `07-nav-mobile.png`; scroll the nav, assert last label "Methods" reachable; `set viewport 1440 900` |
| 8 | Navigation links work | Each link navigates to its route | ✔ `click` each of the 6 links from `/`; after each: `get url` matches, h1 present |
| 9 | Footer | Footer on all pages | ⚠ `get text footer` contains "Not a medical device." and "Published equations" |
| 10 | Footer disclaimer | Medical disclaimer visible | ⚠ covered by #9; screenshot `10-footer.png` |
| 11 | Calculator loads | `/calculator` form renders | ✔ `open "$URL/calculator"`; snapshot shows Patient & labs card; inputs `#name #sex #age #weight #scr #acr #region` |
| 12 | Calculator computes | Live results for valid inputs | ✔ fill `#age` "58", `#weight` "70", `#scr` "1.4", `#acr` "180"; assert results card shows eGFR ~63-65, stage, KDIGO risk; screenshot `12-calc-results.png` |
| 13 | Calculator validation | Out-of-range input → error, results withheld | ✔ fill `#scr` "900"; `is visible` error text; results panel shows "results are withheld"; `get attr aria-invalid '#scr'` === "true"; restore "1.4" |
| 14 | Calculator save | "Save to records" button states | ⚠ `is enabled` submit with valid inputs; fill `#age` "" → `is not enabled`; if DB configured: click, assert "Saved to records." message; else assert failure message is graceful |
| 15 | Calculator history/favorites | localStorage persistence | ✔ click "Save to history", click "☆ Favorite"; assert toast `role=status`; reload page; entries still listed; screenshot `15-calc-history.png` |
| 16 | Imaging loads | `/imaging` drop zone visible | ✔ `open "$URL/imaging"`; snapshot shows "No image selected", "PNG · JPEG · WebP · up to 25 MB", "Choose a de-identified image" button |
| 17 | Imaging upload | Test image → canvas + quality panel | ✔ `upload input[type=file] /tmp/nephro-test.png`; `wait 1500`; assert file name shown, `get count canvas[aria-label^="Image viewer"]` === 1, heading "Technical image quality" visible with score(s), disclaimer "not clinical measurements"; screenshot `17-imaging-loaded.png` |
| 18 | Imaging annotate | Tool draws on canvas | ✔ select "Arrow" tool (`find role button "Arrow"` or snapshot ref); `get box canvas[aria-label^="Image viewer"]`; `mouse move` to canvas center; `mouse down`; `mouse move` +30px; `mouse up`; assert "Undo" control enabled (shape recorded); screenshot `18-imaging-annotate.png` |
| 19 | Imaging chat consent gate | Chat send disabled until de-identified checkbox | ✔ assert `is not enabled` `button[aria-label="Send question"]`; `check` the consent checkbox (label text "I confirm this is a de-identified exported image…", also gates the "Request AI review" button); assert send now enabled (if keys configured, send "Is the lesion simple or complex?" and await `role=log` answer; else expect graceful error); screenshot `19-imaging-chat.png` |
| 20 | Imaging report | Report button state + generation | ⚠ assert "Generate review report" disabled when nothing present ("Needs an AI report…" hint); select 1 Bosniak checklist item → enabled; click → report section `#generated-review-report` renders; screenshot `20-imaging-report.png` |
| 21 | Records | `/records` states | ✔ `open "$URL/records"`; assert one of: records table with rows, "No records yet", or "Database not connected"; screenshot `21-records.png` |
| 22 | Records export | CSV download | ✔ (records present) `download` Export CSV button to `research/shots/records.csv`; file exists, header row present |
| 23 | Methods | `/methods` renders equations + sources | ✔ `open "$URL/methods"`; h1 "Methods & sources"; ≥1 equation card with "Source:" line; screenshot `23-methods.png` |
| 24 | Tools | `/tools` computes with errors | ✔ `open "$URL/tools"`; in "Spot urine ACR / UPCR" fill `#acr-alb` "10", `#acr-cr` "100" (verify actual ids via snapshot); assert ACR output; enter out-of-range value → error shown; screenshot `24-tools.png` |
| 25 | Cross-cutting | Console/errors, failed requests, reduced motion, mobile, print, a11y | See "Cross-cutting pass" below |

## Cross-cutting pass (point 25)

Run last, on all 6 routes:

```bash
for route in "" calculator imaging records methods tools; do
  agent-browser open "$URL/$route"
  agent-browser wait --load networkidle
  agent-browser console
  agent-browser errors
  agent-browser network requests --filter "status:>=400"   # failed fetches
  agent-browser a11y --tags wcag2a,wcag2aa,wcag21a,wcag21aa
done
```

Additional variants:
- **Reduced motion**: `set media light reduced-motion`; reload `/`; assert via
  `network requests --filter "nephro-kidney-tablet-desktop.mp4"` that the video is
  **not** fetched (poster png may be); hero 3D may still mount — assert no console
  errors; screenshot `25-reduced-motion.png`. Reset: `set media light`.
- **Mobile**: `set viewport 390 844`; walk `/`, `/calculator`, `/imaging` (drop zone,
  chat gate, report section), `/records` (table scrolls); screenshots
  `25-mobile-*.png`; reset `set viewport 1440 900`.
- **Print**: `open "$URL/"`; `pdf research/shots/print-homepage.pdf`; assert header/
  footer absent, content present (spot-check by opening the PDF).
- **Perf (homepage)**: `vitals "$URL"` → record LCP/CLS/TTFB/FCP/INP in the results
  table; flag LCP > 2.5 s or CLS > 0.1.

## Screenshot manifest (save under research/shots/)

01-home.png, 06-nav-focus.png, 07-nav-mobile.png, 10-footer.png,
12-calc-results.png, 15-calc-history.png, 17-imaging-loaded.png,
18-imaging-annotate.png, 19-imaging-chat.png, 20-imaging-report.png,
21-records.png, 23-methods.png, 24-tools.png, 25-reduced-motion.png,
25-mobile-home.png, 25-mobile-calc.png, 25-mobile-imaging.png, print-homepage.pdf,
records.csv (download artifact).

## Results recording

Append a filled table to this file after the run (or a sibling `browser-test-results.md`):

| # | Route | Assertion | Pass/Fail | Evidence | Notes |
|---|---|---|---|---|---|
| 1 | / | 200, no console errors | | 01-home.png | |

Failure rule: a **Fail** is only confirmed when the assertion command returns a
non-empty/negative result and is reproducible once; console noise that is
framework-informational (e.g. favicon 404) is noted, not counted.

## Honest limits / notes for the integrator

- The 25-point numbering is a reconstruction (master prompt text unavailable to the
  worker session) — reconcile before the run if it matters.
- /imaging AI steps (#19-#20) depend on provider keys; without keys assert the
  graceful-error path only.
- /records (#14, #21-#22) depends on `DATABASE_URL`; the no-DB state is a valid pass.
- The WebGL **fallback** path (poster instead of canvas) cannot be forced through
  agent-browser CLI flags here (no launch-arg passthrough confirmed); verify the
  normal WebGL path + no errors, and trust the unit-level probe for the fallback.
  If launch flags exist (`open --args …`), a second pass with `--disable-webgl`
  would cover it — mark as optional.
- Tuning note: annotation drag coordinates come from `get box` on the viewer canvas;
  if `mouse` events don't reach the canvas (pointer-events handling), fall back to
  `drag <src> <dst>` with element selectors on the canvas itself.
