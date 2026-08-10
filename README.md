# Renal Function — validated kidney calculators

A clinical calculator that does the opposite of "AI" tools: it runs the exact
published equations nephrologists trust, shows every intermediate value, and
cites each constant. No training data, no randomness, no fake scan animation.

**Routes**

| Route | What it is |
|---|---|
| `/` | Landing page — Three.js hero (custom GLSL kidney shader + particle field), anime.js entrance choreography |
| `/calculator` | The tool: CKD-EPI 2021 eGFR, Cockcroft–Gault, KDIGO staging + risk heat map, 4-variable KFRE (both regional calibrations), optional KDIGO AKI staging, guideline-derived guidance |
| `/records` | Saved assessments (Neon/Postgres) |
| `/methods` | Every equation with formula, constants, worked example, and primary source |

## Run locally

```bash
npm install
npm run dev
```

## Verify the math

```bash
npm test        # 40+ assertions against published worked examples
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
vercel --prod
```

## Design notes

- Design tokens in `src/app/globals.css` (OKLCH, light/dark via
  `prefers-color-scheme`, `color-scheme` synced).
- The 3D hero is client-only (`next/dynamic`, `ssr: false` inside a client
  wrapper) so the landing stays a static prerender.
- Equations live in `src/lib/renal.ts` — pure functions, no React, unit-tested.
- KFRE defaults to the non-North-American calibration (S0 2yr 0.9832 / 5yr
  0.9365) because that's the correct default outside US/Canada; North American
  is selectable (0.9751 / 0.9240). Using the wrong one is the most common
  implementation error.

**Not a medical device.** Every result must be interpreted by a clinician.
