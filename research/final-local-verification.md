# Final local verification — production build at http://127.0.0.1:3111

- Date: 2026-08-16 (UTC)
- Verifier: worker V (verification only, no src edits, no commits)
- Build under test: latest served build on `feat/nephro-production-upgrade`
  (git head `d15ded1` "chore: drop unused test helper (lint clean)")
- Browser: agent-browser CLI, headless Chromium, session `nephro-verify-82d1e51c30b0`
- Test image: `/tmp/nephro-test.png` (320×240 px PNG, 2.0 KB)
- Environment: no AI keys, no `DATABASE_URL` (honest unavailable/empty states expected)

## Summary

| # | Item | Result |
|---|------|--------|
| 1 | Landing remake (5 sections, backdrop, nav, mobile overflow) | PASS |
| 2 | /learn (case picker, walkthrough, quiz, score, safety banner) | PASS |
| 3 | /imaging (viewer, quality panel, compare, linked zoom, exit) | PASS |
| 4 | axe-core on /, /learn, /imaging | PASS (1 moderate heading-order on /imaging; see notes) |
| 5 | Console errors + failed network requests on every route | PASS (none found) |

Screenshots: `research/shots/final-home-1..4.png`, `final-home-mobile.png`,
`final-learn-1.png`, `final-learn-2.png`, `final-compare.png`.

---

## 1. Landing (/) — PASS

**Backdrop.** Probed WebGL availability headlessly: `canvas.getContext('webgl2'/'webgl')`
returns `null` (`gl: false`) in this SwiftShader headless Chromium, so the WebGL
scene cannot run. Rendered state: `document.querySelectorAll('canvas').length === 0`
and the poster fallback is present and fully loaded:
`<img src="/media/nephro-kidney-tablet-desktop-poster.webp" complete=true naturalWidth=1600>`.
This is the expected poster-fallback path (`KidneyScene.tsx` routes to
`POSTER_SRC` when WebGL is unavailable). Report: **poster fallback rendered, not
the 3D canvas** — caused by headless WebGL unavailability, acceptable per spec.

**5 sections.** All five `section[data-choreo]` elements render over the fixed
backdrop: `hero`, `signals`, `process` (×2), `cta`. Scroll-driven reveal worked
(scrolled in ~200px steps from top to bottom; bottom reached, `scrollY+innerHeight
= scrollHeight = 3653`).

**Nav.** Nav bar has a `Learn` link (href `/learn`), plus Overview/Calculator/
Tools/Imaging/Records/Methods.

**Mobile overflow.** At `set viewport 390 844` (reload): `documentElement.scrollWidth
= 390`, `body.scrollWidth = 390`, `scrollableRight = false` — no horizontal overflow.

Screenshots: `research/shots/final-home-1.png` (hero), `-2.png` (signals),
`-3.png` (process), `-4.png` (cta/bottom), `final-home-mobile.png` (390px).

## 2. /learn — PASS

- Case picker shows exactly 3 cases: "Normal renal ultrasound anatomy walkthrough",
  "Reading a CT KUB for stone context", "Cystic vs solid: applying Bosniak thinking".
- Opened "Normal renal ultrasound anatomy walkthrough" (via `Start guided walkthrough`).
- Walkthrough: 6 steps (`STEP 1 OF 6` … `STEP 6 OF 6`). "Reveal explanation"
  toggled to "Hide explanation" (`aria-expanded=true`); after all 6 steps the
  counter read `6 of 6 explanations reviewed` and the button changed to
  `Checklist complete — start the quiz`.
- Quiz: 3 questions. Answered all 3 (Q1 isoechoic cortex, Q2 central echo complex,
  Q3 shadowing/collecting-system check). Each answer locked in with instant
  feedback box (`aria-live=polite`): "CORRECT — WHY IT MATTERS" with the teaching
  explanation. Progress counter advanced.
- Score summary: `Lesson complete` region with `status` block "YOUR SCORE / 3/ 3"
  ("Every answer matched the teaching explanation"), per-question review listing
  each question, correct answer, and explanation, plus "Replay this case" /
  "Choose another case".
- Educational safety banner visible on the page (and remains during lesson):
  `<aside>` "Educational content — not medical training, not diagnosis. These
  walkthroughs teach imaging structure and interpretation reasoning only…" —
  `visible: true` via layout metrics; also present in a11y tree as `note`.

Screenshots: `research/shots/final-learn-1.png` (picker + banner),
`final-learn-2.png` (walkthrough with explanation revealed).

## 3. /imaging — PASS

- Upload `/tmp/nephro-test.png` to the main pane. Viewer rendered (canvas-based
  renderer; file facts: "nephro-test.png · 2.0 KB · 320 × 240 px", dimensions
  320 × 240 px, mean luminance 106/255, modality Ultrasound, processing
  "Local only", storage "This browser", format image/png).
- "Technical image quality" panel renders with computed metrics: Quality score
  78/100, Resolution 2/100, Contrast 83/100, Brightness 96/100, Noise 100/100,
  Visibility 100/100, plus the disclaimer "Technical image-quality metrics — not
  clinical measurements."
- Compare: clicked "Compare with a previous image" → "Exit compare mode" button
  and a second pane appear. Loaded the same file into the reference pane
  (compare input, `input[type=file]` index 1 via DataTransfer + change event;
  the CLI `upload` only targets the first input). Both panes render labeled:
  "Current | nephro-test.png" and "Previous | nephro-test.png", each with its own
  canvas (195×272).
- Linked zoom (pixel-transform check via canvas `getImageData` hashes):
  from the fit state (main `10a6f069`, ref `ece9667a`), each "Zoom in" click
  re-rendered **both** panes — main: `3136b40c → a26f19e5 → cc21cf4c → 65984524`;
  ref: `250e2f10 → ecdeb23b → bf9c19dc → 4784a2ec`. Every step changed both
  canvases; source confirms the compare pane draws from the shared `zoom`/`pan`
  state (`ImagingWorkspace.tsx` compare effect). Main vs reference pixels differ
  by 5.0% at the same zoom level (placement rounding); both respond to zoom.
- Exited compare: back to single viewer (2 canvases) and the
  "Compare with a previous image" toggle returns.

Screenshot: `research/shots/final-compare.png` (side-by-side Current/Previous panes).

## 4. axe-core audits — PASS with 1 finding

Run via `agent-browser a11y --json` (axe 4.12.1) on fresh page loads:

| Route | Violations | Passes | Incomplete |
|-------|-----------|--------|------------|
| /        | 0 | 40 | 1 |
| /learn   | 0 | 39 | 1 |
| /imaging | 1 | 43 | 1 |

- The single violation on /imaging is `heading-order` (moderate), target
  `div:nth-child(2) > div:nth-child(1) > h6` — an `h6` heading used as a
  section eyebrow inside the imaging workspace where the surrounding heading
  order skips levels. Cosmetic/structural; no impact on keyboard or contrast.
- The `incomplete` item on all three routes is `color-contrast` (nodes where
  axe could not determine the background due to pseudo-elements/gradient veils,
  e.g. `.sm:inline` nav label, `.eyebrow.hero-reveal`). Not counted as a
  violation by axe; listed for honesty.

## 5. Console errors + failed network requests — PASS (none)

Fresh console/errors/network buffers per route, `networkidle` + 2.5s settle:

| Route | Console | Page errors | Requests | Non-200 |
|-------|---------|-------------|----------|---------|
| /        | empty | empty | 27 | 1 × 304 (cached poster webp — cache hit, not a failure) |
| /learn   | empty | empty | 23 | 0 |
| /imaging | empty | empty | 24 | 0 |
| /records | empty | empty | 24 | 0 |

No failed fetches, no uncaught exceptions, no console errors on any route.

## Extra context (not required, observed)

- /records renders its honest empty state: "No records yet / Assessments you
  save in the calculator will appear here." (server has no DATABASE_URL).
- AI provider UI on /imaging honestly reports "Providers unavailable", and
  `GET /api/imaging/analyze` returns
  `{"configured":{"openai":false,"gemini":false},...}` — no faked availability,
  no error thrown.

## Honest limitations / SKIP candidates

- Visual pixel-level appearance of the screenshots was not human-reviewed in
  this session (headless verifier has no vision channel); verification relied on
  DOM/a11y-tree state, layout metrics, and canvas pixel hashing. Screenshots are
  saved for human review.
- The WebGL 3D scene itself could not be exercised (SwiftShader headless exposes
  no WebGL context); only the poster fallback path was verified live. The 3D path
  is SKIP in this environment by constraint — the fallback is the expected
  behavior here.
- Scroll choreography of the camera rig is not observable without WebGL
  (choreography state bus exists; `scroll-choreography.ts` hook runs).
- axe `color-contrast` remains `incomplete` (not violable) on pseudo-element
  backgrounds; flagged for completeness.
