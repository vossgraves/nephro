# Nephro browser verification results (Worker C)

Run: 2026-08-16 ~10:06-10:21 UTC against **http://127.0.0.1:3111** (`pnpm start`,
production build, latest). Tooling: `agent-browser` 0.34.0 + chromium (headless),
named session `nephro-verify-82d1e51c30b0`. Viewports: desktop 1440×900, mobile
390×844. Test image: `/tmp/nephro-test.png` (2.0 KB, 320×240 PNG).

Environment (as briefed): **no AI keys, no DATABASE_URL** — provider probe shows
`configured:false`, AI requests surface the real no-provider error, `/records` shows
its empty state. That is the expected local behavior; live AI/DB is for the Vercel
preview.

## Summary

27 items executed (25 checklist + 2 cross-cutting variants): **24 PASS, 1 SKIP,
0 FAIL**. Real WCAG contrast violations found on 3 routes (axe) — see Defect list.
No console errors, no failed HTTP responses on any route.

## Per-item results

| # | Item | Result | Evidence / notes |
|---|---|---|---|
| 1 | Homepage loads | PASS | Title "Renal Function Calculator \| Validated CKD Assessment"; console: only `THREE.Clock` deprecation warning (advisory); 0 page errors. `01-home.png` |
| 2 | Hero | PASS | h1 "Kidney numbers, made clear."; CTAs "Open calculator"/"See the methods"; stats eGFR 43.6 / 2-yr KFRE 0.9% / G3b A2; WebGL2 canvas live (536×190, `getContext('webgl2')` non-null); hero video+poster mounted (motion path) |
| 3 | Content sections | PASS | "Three outputs…", "The answer is not a black box.", "No black boxes…", "Run it on a real patient…" all present with CTAs |
| 4 | Nav present | PASS | `navigation "Primary navigation"` visible on all 6 routes |
| 5 | Nav aria-current | PASS | Exactly the active route's link has `aria-current="page"` on all 6 routes (home = exact `/`) |
| 6 | Nav keyboard/focus | PASS | `:focus-visible` matches, computed outline `2px solid` accent (oklab 0.711 0.081 0.084); `06-nav-focus.png` |
| 7 | Nav mobile scroll+fade | PASS | 390px: 1 visible nav, scrollable (386 vs 261 px), `mask-image: linear-gradient(… calc(100% - 18px), transparent)` right-edge fade; "Methods" reachable; `07-nav-mobile.png` |
| 8 | Nav links work | PASS | All 6 routes navigate with correct h1 |
| 9 | Footer | PASS | Visible on all pages (spot-checked) |
| 10 | Footer disclaimer | PASS | "Not a medical device." + "Published equations · Visible working"; `10-footer.png` |
| 11 | Calculator loads | PASS | All 9 fields present: `#name #sex #age #weight #scr #acr #region #baseScr #urineOut` |
| 12 | Calculator computes | PASS | age 58 / 70 kg / Scr 1.4 / ACR 180 → eGFR **43.6** mL/min/1.73m², CrCl **48** (independently re-derived via Cockcroft–Gault = 48.4), stage **G3b A2**, KDIGO **Very high risk**, KFRE section; `12-calc-results.png` |
| 13 | Validation | PASS | Scr 900 → `aria-invalid="true"`, `role=alert` "Must be between 0.2 mg/dL and 25 mg/dL — check the unit.", results withheld message |
| 14 | Save button | PASS | Honest failure with no DB: "Database not configured (DATABASE_URL missing)." — no crash |
| 15 | History/favorites | PASS | Toasts ("Added to favorites."); after reload Favorites + History sections and the entry persist (localStorage); `15-calc-history.png` |
| 16 | Imaging drop zone | PASS | "No image selected", "PNG · JPEG · WebP · up to 25 MB", "Choose a de-identified image" |
| 17 | Upload + quality panel | PASS | Upload via hidden `input[type=file]`; file facts "nephro-test.png 2.0 KB · 320 × 240 px"; viewer canvas present; "Technical image quality" heading + "not clinical measurements" disclaimer; `17-imaging-loaded.png` |
| 18 | Annotate draws | PASS | Arrow tool + real mouse drag across the viewer canvas committed a shape (Undo and Clear-all enabled after draw). Note: two tooling pitfalls discovered — coordinates must be scrolled in-viewport (offscreen mouse events hit nothing), and synthetic `PointerEvent` dispatch fails because `setPointerCapture` throws for untrusted pointerIds. Both are automation artifacts, not app defects; `18-imaging-annotate.png` |
| 19 | Chat consent gate | PASS | "Send question" + "Request AI review" disabled initially; enabled only after consent checkbox + (chat) text; honest unavailable state shown: "Local only" + "Providers unavailable" badges (probe `configured:false` — no crash); sending surfaces the real server message: "No AI providers configured. Add GEMINI_API_KEY and/or OPENAI_API_KEY as server-side environment variables."; `19-imaging-chat.png` |
| 20 | Report button | PASS | Disabled + "Needs an AI report, checklist selections, or measurements/annotations." hint when empty; enabled after selecting a Bosniak checklist item; click renders `#generated-review-report` Markdown (modality, file facts, quality metrics, checklist item, clinical disclaimer) with Copy/Download/Print controls; `20-imaging-report.png` |
| 21 | Records state | PASS | "No records yet" empty state (no DB): `21-records.png` |
| 22 | Records export CSV | SKIP | Export button only renders when `records.length > 0`; unreachable without DATABASE_URL. Defer to Vercel preview (with seeded records) |
| 23 | Methods | PASS | h1 "Methods & sources"; 5 equation articles; 10 "Source:" citations; `23-methods.png` |
| 24 | Tools | PASS | ACR tool: alb 10 mg/dL + cr 100 mg/dL → ACR **100.0 mg/g**, SI **11.3 mg/mmol**, Albuminuria **A2** (math re-derived: 10/100×1000 = 100 ✓; 100/8.84 = 11.3 ✓); `24-tools.png` |
| 25a | Cross-cutting errors/network | PASS | 0 console `[error]` entries on any route (only the THREE.Clock deprecation warning); HAR across all 6 routes: **zero HTTP ≥400** (requests: / 28, calculator 21, imaging 22, records 21, methods 21, tools 21) |
| 25b | Cross-cutting a11y (axe) | FAIL-adjacent findings | WCAG 2A/2AA/21A/21AA: violations — / 0, /calculator **1** (color-contrast `.border-accent`), /imaging **2** (color-contrast, 12 nodes: h6/strong/buttons), /records 0, /methods 0, /tools **1** (color-contrast, 2 nodes: `--very-high` `role=alert` text). Incomplete (manual review): homepage `aria-prohibited-attr` on `.mt-7` (aria-label on a generic div — "Live signals" block), plus large color-contrast incomplete sets on every route (small `--muted` text). See Defects 1-2 |
| 25c | Reduced motion | PASS | Under forced `prefers-reduced-motion`: **hero mp4 never fetched** (0 video elements, no `.mp4` in resource entries; poster fetched once); `25-reduced-motion.png` |
| 25d | Mobile pass | PASS | 390px: no horizontal overflow on `/`, `/calculator`, `/imaging`; `25-mobile-{home,calculator,imaging}.png` |
| 25e | Print | PASS | `print-homepage.pdf` (2.7 MB) generated; header/footer carry `no-print`. Could not visually inspect (no vision) — structural only |
| 25f | Perf (homepage) | PASS | `vitals`: **LCP 1,244 ms** (element: 1.16 MB hero poster PNG), **FCP 968 ms**, **TTFB 29 ms**, **CLS 0.0**, INP null (no interaction sampled) |

## Console findings

- Only console output across all routes: `[warning] THREE.Clock: This module has
  been deprecated. Please use THREE.Timer instead.` Emitted on every route
  (three r185 deprecation surfaced through the R3F/three code path). Advisory;
  not an error, no user impact. Track upstream.
- `agent-browser errors` renders empty rows in this environment (CLI display
  artifact); corroborated empty via 0 console `[error]` entries and HAR.
- `agent-browser network requests` log never captured; **HAR** (`network har
  start/stop`) was used instead and is the reliable method here.

## Defect list (for integrator triage — I did not fix anything)

1. **[severity: serious, a11y] Color-contrast violations (axe, WCAG AA)**:
   - `/calculator` — 1 node (`.border-accent`, the favorite/history control row).
   - `/imaging` — 12 nodes (accent-colored `h6` section headings, `strong`
     highlights, some buttons).
   - `/tools` — 2 nodes (`text-[color:var(--very-high)]` `role=alert` error text).
   Codepath: the `--muted` (oklch 0.49) and `--very-high` (oklch 0.6) tokens are
   borderline for small text — exactly as flagged in `research/a11y-review.md`.
   Fix at token level (darken `--muted`, and/or `--very-high`), then re-run axe.
2. **[severity: minor, a11y] `aria-label` on a generic div** (homepage
   `aria-hidden=false` "Live signals" row; axe `aria-prohibited-attr`, incomplete
   — needs manual review). Add a role or move the label to a real landmark.
3. **[severity: low, perf] LCP resource is the 1.16 MB hero poster PNG.** Under
   threshold locally (1.24 s) but the heaviest LCP element on real networks;
   consider a compressed poster (e.g. ~200-300 KB) before Vercel.
4. **[severity: info] `THREE.Clock` deprecation warning** on every page — no
   action now, track against R3F/three releases.
5. **[severity: info] Environment-dependent items deferred to Vercel preview**:
   `/records` rows + Delete + **item 22 Export CSV** (needs DB + seeded record);
   `/imaging` real AI analyze + chat answers (needs keys). Locally the honest
   unavailable paths were verified instead (items 14, 19, 21).

## Honest limitations

- This run had no vision capability: screenshots are verified by artifact
  presence/size and by DOM/state assertions, not by eyeballing pixels. The WebGL
  scene is verified structurally (context, canvas, no errors), not pixel-sampled.
- The annotation draw was verified through the app's own state machinery (Undo /
  Clear-all enabled) plus committed pixels on the overlay canvas; a pixel-level
  read of the overlay was not completed because the page had navigated away by
  then — low risk, but a screenshot eyeball in review is recommended.
- `INP` was null (no user interaction during the vitals window).
- Print PDF is structural-only (no visual check).