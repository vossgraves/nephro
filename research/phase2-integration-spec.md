# Phase 2 — integration spec (assigned to worker A after phase 1 merges)

Owner: worker A (`src/components/imaging/**`, `src/app/imaging/page.tsx`).
Depends on: worker B's `POST /api/imaging/chat` and analyze route (same contracts as today).

## 1. "Ask about this image" chat panel (§29)
- Location: inside the imaging workspace, below the AI review card (or as a tab next to it).
- Uses the CURRENT image already loaded in the browser — never asks the user to re-pick the file.
- UI: compact message list (user/assistant), input box, send button. Reuse existing CSS var styling.
- Request: POST /api/imaging/chat `{ imageDataUrl, modality, question, deidentifiedConfirmed: true, priorReport?: report }`.
  Send `priorReport` when a report exists so answers can reference it.
- Consent: requires the same de-identification checkbox to be checked (already gates analysis).
- States: idle / waiting (honest indeterminate spinner, NO fake stage rotation) / answer / error
  with the endpoint's error message.
- Keep the last Q&A pairs in component state only (no persistence, no new storage).
- Suggested-question chips (tap to send): "Describe the visible structures.", "What limitations
  affect this image?", "What should a student inspect first?"

## 2. Honest analysis progress (§26)
- Replace the rotating `ANALYSIS_PHASES` timer with REAL stages:
  idle → "Uploading image" (fetch in flight) → "Waiting for provider" → done/error.
  Implement as state transitions at the actual await points, not a timed cycler.

## 3. Structured findings review (§30)
- Under a successful report, map `observedVisualFeatures` into review rows:
  Finding text | confidence chip (absent → "not rated") | actions CONFIRM / EDIT / REJECT.
- EDIT opens the finding text in an inline textarea; save replaces it.
- State: `Record<index, { status: "pending"|"confirmed"|"rejected"|"edited"; text: string }>`.
- These decisions feed the generated report (below).

## 4. Generate review report (§34)
- Button "Generate review report" enabled when a report exists OR checklist/measurements/annotations exist.
- Output panel (and clipboard/download/print text) contains:
  modality, date, technical quality scores (labelled technical, not clinical), AI summary,
  findings with user status (confirmed/edited/rejected shown), checklist selections,
  measurements list (px), limitations (`notAssessableFromThisImage` + quality limitations),
  and the AI-assistance notice (safetyNote + "not a diagnosis" line).
- Buttons: COPY (navigator.clipboard), DOWNLOAD (.md file), PRINT (window.print with a
  print-friendly section; the existing `no-print` class hides the chrome).
- Pure text assembly lives in a new `src/lib/report.ts` (pure function, unit-testable later).

## 5. Image comparison (§33, optional/stretch)
- "Compare" toggle in the viewer header: opens a second file picker; renders previous image in a
  second canvas beside the first; zoom/pan synchronized via the shared view state.
- Only if it fits without destabilizing the viewer. Skip rather than ship broken.

## Hard rules
- No fake progress, no fake results, no `any`, no new dependencies, no changes outside your files.
- Keep the medical-safety wording intact everywhere.
- Power: no installs/builds/dev servers; at most one `pnpm exec tsc --noEmit` at the end.
