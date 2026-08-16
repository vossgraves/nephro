# Change inventory (main..feat/nephro-production-upgrade)

## Commits
7151f54 fix: heatmap cell label opacity to full, label brightness/contrast range inputs (axe)
e335650 fix: WCAG AA contrast tokens, aria group role, WebP posters (1.16MB→39KB LCP)
7cd3a1f feat: pending findings flow into report, route guard smoke tests (26/26), browser test plan
0607815 feat: phase 2 — report builder, chat panel, findings review, honest progress, a11y fixes
201ef72 docs: report builder contract for phase 2
4c54aa8 feat: AI provider layer + chat endpoint, imaging workspace tools/annotations/measurements, 3D fallback+perf tiers, test suites
5211a72 docs: phase 2 integration spec
b587e3a docs: comparison report, upgrade plan, contract modules (ai types, image-quality scoring, bosniak lib)
a8b58f3 chore: add flat ESLint 9 config, replace interactive next lint

## Stat
 src/lib/report.test.ts                             |  268 ++
 src/lib/report.ts                                  |  188 ++
 84 files changed, 20120 insertions(+), 464 deletions(-)

## Dependencies
Added: eslint ^9.39.5, eslint-config-next 15.5.23, @eslint/eslintrc ^3.3.6 (dev only)
Removed: none

## New source modules
A	eslint.config.mjs
A	public/media/nephro-kidney-tablet-desktop-poster.webp
A	public/media/nephro-kidney-tablet-mobile-poster.webp
A	scripts/route-smoke.mts
A	src/app/api/imaging/chat/route.ts
A	src/app/api/imaging/shared.ts
A	src/components/ConfirmDeleteButton.tsx
A	src/components/hero/perf-tier.ts
A	src/lib/ai/gemini.ts
A	src/lib/ai/openai.ts
A	src/lib/ai/orchestrator.ts
A	src/lib/ai/rate-limit.ts
A	src/lib/ai/types.ts
A	src/lib/annotations.ts
A	src/lib/bosniak.test.ts
A	src/lib/bosniak.ts
A	src/lib/image-quality.test.ts
A	src/lib/image-quality.ts
A	src/lib/imaging-recognition.test.ts
A	src/lib/measurements.ts
A	src/lib/report.test.ts
A	src/lib/report.ts

## Tracking safety
Tracked dotfiles: .env.example only (no .env.local, no .vercel)
