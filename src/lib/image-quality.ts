/**
 * Client-side technical image-quality metrics.
 *
 * IMPORTANT (master prompt §22): these are TECHNICAL image-quality metrics
 * computed from pixel statistics. They are NOT clinically validated diagnostic
 * measurements and must be labelled as such in the UI.
 *
 * The module is split in two so the scoring half stays pure and unit-testable
 * in Node (no DOM): `extractImageStats` needs a canvas, `scoreFromStats` does not.
 */

export type ImageStats = {
  width: number;
  height: number;
  /** Mean relative luminance 0–255. */
  meanLuminance: number;
  /** Standard deviation of luminance 0–~128. */
  stddevLuminance: number;
  /** Laplacian-style high-frequency energy estimate (noise/softness proxy), >= 0. */
  highFreqEnergy: number;
  /** Fraction of pixels close to pure black or pure white (clipping), 0–1. */
  clippedFraction: number;
  /** p95 - p5 luminance spread 0–255. */
  percentileSpread: number;
};

export type ImageQualityMetrics = {
  /** Overall technical score 0–100. */
  score: number;
  resolution: number;
  contrast: number;
  brightness: number;
  noise: number;
  visibility: number;
  stats: ImageStats;
};

/** Clamp helper shared by scoring functions. */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Pure scoring from precomputed stats. Must stay deterministic and DOM-free.
 * Implemented by the imaging worker; see research/production-upgrade-plan.md.
 */
export function scoreFromStats(stats: ImageStats): ImageQualityMetrics {
  // Resolution: megapixel ramp, full marks at/above ~4 MP.
  const megapixels = (stats.width * stats.height) / 1_000_000;
  const resolution = clampScore((megapixels / 4) * 100);

  // Contrast: percentile spread, full marks at >= 160 luminance units.
  const contrast = clampScore((stats.percentileSpread / 160) * 100);

  // Brightness: distance of mean luminance from the 110–140 sweet spot.
  const mean = stats.meanLuminance;
  const brightness = clampScore(
    mean < 110 ? (mean / 110) * 100 : mean > 140 ? Math.max(0, 100 - ((mean - 140) / 115) * 100) : 100,
  );

  // Noise: lower high-frequency energy is better; soft images also lose points
  // via visibility below. Full marks at <= 2 energy, zero at >= 40.
  const noise = clampScore(100 - ((stats.highFreqEnergy - 2) / 38) * 100);

  // Visibility: penalize clipped blacks/whites.
  const visibility = clampScore(100 - stats.clippedFraction * 220);

  const score = clampScore(
    resolution * 0.18 + contrast * 0.22 + brightness * 0.18 + noise * 0.2 + visibility * 0.22,
  );

  return { score, resolution, contrast, brightness, noise, visibility, stats };
}
