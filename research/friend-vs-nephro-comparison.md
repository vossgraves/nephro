# Friend's project vs Nephro (functional comparison)

Scope rule honored: the friend's UI/design was NOT used as a visual reference.
This compares functionality, architecture, and engineering only.

## Projects compared
- **Nephro (mine)**: Next.js 15.5 App Router, React 19, strict TypeScript, Tailwind 4,
  R3F/Three.js hero, Neon Postgres records, `/api/imaging/analyze` with
  Gemini-primary + OpenAI-fallback, runtime report normalization, medical-safety prompts,
  deterministic renal equations (CKD-EPI 2021, KFRE, KDIGO, C-G), unit-tested (`renal.test.ts`).
- **NephroScan-AI (friend's)**: Flask + PyTorch server, 5 local ResNet18 classifiers
  (kidney stone, chest pneumonia, brain MRI, abdomen organ, heart cardiomegaly),
  Grad-CAM explainability endpoint, one static `index.html` (5.3k lines) calling
  `http://127.0.0.1:5000`.

## Category comparison (A–Q)

| # | Category | Better | Why / decision |
|---|----------|--------|----------------|
| A | Architecture | **Mine** | Friend's has hardcoded Windows paths, no deploy story, server won't boot without local .pth checkpoints. Mine is a deployable Next.js app. |
| B | Functionality | **Mine** (scope) / His (classifiers) | His has disease classifiers but they're toy ResNet18s on 128px images — medically unsafe to adopt. Mine has calculators + records + imaging review that actually work. |
| C | Backend | **Mine** | Typed route handlers, server actions, Neon. His: Flask with per-endpoint duplication, no auth, no validation, no rate limiting. |
| D | API | **Mine** | His: inconsistent payloads per endpoint, no schema. Mine: validated request/response, structured errors. |
| E | AI | **Mine** (productized) / His (local models) | His runs local classifiers — zero API cost, but unvalidated models claiming disease predictions is a safety problem. Mine uses frontier vision models constrained to visible-feature description. |
| F | OpenAI impl | **Mine** | His has none. Mine: chat/completions + JSON mode + normalization (to be hardened in `src/lib/ai/`). |
| G | Gemini impl | **Mine** | His has none. Mine: generateContent + responseMimeType json + normalization. |
| H | Imaging impl | **Mine** | Canvas viewer with zoom/pan/brightness/contrast/invert/grid/pixel probe. His: file input + prediction text. |
| I | Authentication | **Neither** | Mine is a single-user educational tool (documented). His has none at all. Recorded as remaining risk. |
| J | Error handling | **Mine** | His returns raw `str(error)` at 500. Mine has typed error paths + provider failure explanation. |
| K | TypeScript quality | **Mine** | Strict mode, no `any` in app code. His is JS-in-HTML. |
| L | Security | **Mine** | His: CORS `*` on a LAN server, no size limits, no auth, disease claims. Mine: de-identification consent gate, no-store, no PHI persistence. Gaps to close: rate limiting, body-size cap (planned in this upgrade). |
| M | Performance | **Mine** | Static prerendered pages, lazy 3D. His loads 5 torch models into RAM at boot. |
| N | Mobile behavior | **Mine** | Responsive Tailwind layouts. His: fixed sidebar layout in one HTML file. |
| O | Testing | **Mine** | `renal.test.ts` exists; more unit tests planned. His has none. |
| P | Deployment readiness | **Mine** | Vercel config + deployment guide. His requires a Windows desktop with specific .pth files. |
| Q | Maintainability | **Mine** | Modular repo vs. one 5.3k-line HTML file + script with 5x copy-pasted predict endpoints. |

## Adopted from friend's project (functional ideas, not code, not design)
1. **Explainability as a first-class concept** — his Grad-CAM endpoint inspired our
   "directly visible features" + pixel-probe approach; we do NOT adopt Grad-CAM (no local models).
2. **Threshold/conservative posture** — his 0.80 decision-threshold idea maps to our
   "confidence: low/medium/high" and review-gating language.
3. **Scope restriction pattern** — his "abdomen = organ recognition only" scope note is a good
   pattern; our per-modality guidance strings already do this and will be kept.

## Rejected from friend's project
- Local ResNet18 disease classifiers (unvalidated, unsafe disease claims).
- Grad-CAM heatmaps (requires the local models; misleading without validation).
- Flask sidecar architecture (un-deployable for this product).
- Everything visual (per the critical visual-design rule).

## Conclusion
Mine is the superior base in every category that matters for a production
educational/healthcare imaging product. The upgrade proceeds on my architecture.
