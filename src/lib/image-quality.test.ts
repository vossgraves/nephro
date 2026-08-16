/** Run: npx tsx src/lib/image-quality.test.ts */
import assert from "node:assert/strict";
import type { ImageStats } from "./image-quality";
import { clampScore, scoreFromStats } from "./image-quality";

/** Builds stats around values that score 100 on every sub-score. */
function stats(over: Partial<ImageStats> = {}): ImageStats {
  return {
    width: 4000,
    height: 1000,
    meanLuminance: 125,
    stddevLuminance: 40,
    highFreqEnergy: 2,
    clippedFraction: 0,
    percentileSpread: 160,
    ...over,
  };
}

/* ---- clampScore bounds ---------------------------------------------------- */
assert.equal(clampScore(-5), 0);
assert.equal(clampScore(0), 0);
assert.equal(clampScore(100), 100);
assert.equal(clampScore(150), 100);
assert.equal(clampScore(99.6), 100, "rounds before clamping");
assert.equal(clampScore(99.4), 99);

/* ---- perfect stats -> perfect score; near-perfect -> high 90s ------------- */
const perfect = scoreFromStats(stats());
assert.equal(perfect.score, 100);
assert.equal(perfect.resolution, 100);
assert.equal(perfect.contrast, 100);
assert.equal(perfect.brightness, 100);
assert.equal(perfect.noise, 100);
assert.equal(perfect.visibility, 100);

const nearPerfect = scoreFromStats(stats({ width: 2000, height: 2000, percentileSpread: 150 }));
assert.ok(nearPerfect.score >= 95, `near-perfect stats must score high 90s, got ${nearPerfect.score}`);
assert.equal(nearPerfect.score, 99, "weighted sum rounds to 99");

/* ---- black image: zero spread, zero luminance, clipped -------------------- */
const black = scoreFromStats(stats({ width: 512, height: 512, meanLuminance: 0, stddevLuminance: 0, highFreqEnergy: 0, clippedFraction: 1, percentileSpread: 0 }));
assert.equal(black.contrast, 0, "zero spread -> no contrast");
assert.equal(black.brightness, 0, "zero luminance -> no brightness");
assert.equal(black.visibility, 0, "fully clipped -> no visibility");
assert.ok(black.score <= 30, `black image must score low, got ${black.score}`);
assert.equal(black.score, 21, "black image exact score (determinism)");

/* ---- exposure penalties ---------------------------------------------------- */
const under = scoreFromStats(stats({ meanLuminance: 10 }));
assert.equal(under.brightness, 9, "(10/110)*100 rounds to 9");
const over = scoreFromStats(stats({ meanLuminance: 250 }));
assert.equal(over.brightness, 4, "100 - ((250-140)/115)*100 rounds to 4");
assert.ok(under.brightness < scoreFromStats(stats({ meanLuminance: 110 })).brightness, "underexposed loses points");
assert.ok(over.brightness < scoreFromStats(stats({ meanLuminance: 140 })).brightness, "overexposed loses points");
// Sweet spot boundaries both score full marks.
assert.equal(scoreFromStats(stats({ meanLuminance: 110 })).brightness, 100);
assert.equal(scoreFromStats(stats({ meanLuminance: 140 })).brightness, 100);
assert.equal(scoreFromStats(stats({ meanLuminance: 125 })).brightness, 100);

/* ---- sub-score ramps ------------------------------------------------------- */
assert.equal(scoreFromStats(stats({ percentileSpread: 0 })).contrast, 0);
assert.equal(scoreFromStats(stats({ percentileSpread: 80 })).contrast, 50);
assert.equal(scoreFromStats(stats({ percentileSpread: 160 })).contrast, 100);
assert.equal(scoreFromStats(stats({ percentileSpread: 240 })).contrast, 100, "clamped at 100");

assert.equal(scoreFromStats(stats({ clippedFraction: 0 })).visibility, 100);
assert.equal(scoreFromStats(stats({ clippedFraction: 0.1 })).visibility, 78);
assert.equal(scoreFromStats(stats({ clippedFraction: 0.4 })).visibility, 12);
assert.equal(scoreFromStats(stats({ clippedFraction: 0.5 })).visibility, 0, "negative clamped to 0");
assert.equal(scoreFromStats(stats({ clippedFraction: 1 })).visibility, 0);

assert.equal(scoreFromStats(stats({ highFreqEnergy: 2 })).noise, 100);
assert.equal(scoreFromStats(stats({ highFreqEnergy: 0 })).noise, 100, "below floor clamps to 100");
assert.equal(scoreFromStats(stats({ highFreqEnergy: 40 })).noise, 0);
assert.equal(scoreFromStats(stats({ highFreqEnergy: 100 })).noise, 0, "above ceiling clamps to 0");

assert.equal(scoreFromStats(stats({ width: 1000, height: 1000 })).resolution, 25);
assert.equal(scoreFromStats(stats({ width: 2000, height: 1000 })).resolution, 50);
assert.equal(scoreFromStats(stats({ width: 500, height: 500 })).resolution, 6, "0.25 MP rounds to 6");
assert.equal(scoreFromStats(stats({ width: 100, height: 100 })).resolution, 0, "0.01 MP rounds to 0");
assert.equal(scoreFromStats(stats({ width: 4000, height: 1000 })).resolution, 100);

/* ---- weighted score with rounding ----------------------------------------- */
// All 100 except contrast 40: 18 + 8.8 + 18 + 20 + 22 = 86.8 -> 87.
assert.equal(scoreFromStats(stats({ percentileSpread: 64 })).score, 87);

/* ---- extreme inputs stay within 0-100 ------------------------------------- */
const extreme = scoreFromStats(stats({ width: 1e9, height: 1e9, meanLuminance: 500, highFreqEnergy: 1e6, clippedFraction: 5, percentileSpread: 1000 }));
for (const value of [extreme.score, extreme.resolution, extreme.contrast, extreme.brightness, extreme.noise, extreme.visibility]) {
  assert.ok(Number.isInteger(value) && value >= 0 && value <= 100, `extreme input must clamp into 0..100, got ${value}`);
}
assert.equal(extreme.score, 40, "18 + 22 + 0 + 0 + 0");

/* ---- determinism ----------------------------------------------------------- */
assert.deepEqual(scoreFromStats(stats()), scoreFromStats(stats()));
const reordered = scoreFromStats({ height: 1000, width: 4000, percentileSpread: 160, meanLuminance: 125, stddevLuminance: 40, highFreqEnergy: 2, clippedFraction: 0 });
assert.deepEqual(reordered, scoreFromStats(stats()), "same values in any key order score identically");

/* ---- stats passthrough ----------------------------------------------------- */
const input = stats({ width: 640, height: 480 });
const out = scoreFromStats(input);
assert.equal(out.stats, input, "scoring returns the input stats unchanged");

console.log("all image-quality checks passed");