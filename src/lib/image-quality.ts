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
 * Extract technical statistics from an image by downsampling to a small
 * canvas (max edge 256px, default). Deterministic given the same source
 * pixels. DOM-dependent: call from the browser only.
 *
 * - mean/stddev of relative luminance (0.2126 R + 0.7152 G + 0.0722 B)
 * - Laplacian-kernel high-frequency energy (mean absolute response)
 * - clipped fraction of pixels below 4 or above 251 luminance
 * - p95 - p5 luminance spread from a 256-bin histogram
 */
export function extractImageStats(image: HTMLImageElement, maxSampleEdge = 256): ImageStats {
  const edge = Math.max(1, Math.min(256, Math.floor(maxSampleEdge)));
  const scale = Math.min(edge / image.naturalWidth, edge / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas 2D is unavailable in this browser.");
  }
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;

  const count = width * height;
  const luminance = new Float64Array(count);
  const histogram = new Uint32Array(256);
  let sum = 0;
  for (let pixel = 0, index = 0; pixel < count; pixel += 1, index += 4) {
    const value = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
    luminance[pixel] = value;
    sum += value;
    const bucket = Math.max(0, Math.min(255, Math.round(value)));
    histogram[bucket] += 1;
  }
  const meanLuminance = sum / count;

  let variance = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const diff = luminance[pixel] - meanLuminance;
    variance += diff * diff;
  }
  const stddevLuminance = Math.sqrt(variance / count);

  // Laplacian high-frequency energy over interior pixels (kernel needs neighbours).
  let energySum = 0;
  let interior = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const response = luminance[i - width] + luminance[i + width] + luminance[i - 1] + luminance[i + 1] - 4 * luminance[i];
      energySum += Math.abs(response);
      interior += 1;
    }
  }
  const highFreqEnergy = interior > 0 ? energySum / interior : 0;

  let clipped = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const value = luminance[pixel];
    if (value < 4 || value > 251) clipped += 1;
  }
  const clippedFraction = clipped / count;

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    meanLuminance,
    stddevLuminance,
    highFreqEnergy,
    clippedFraction,
    percentileSpread: percentileFromHistogram(histogram, count, 0.95) - percentileFromHistogram(histogram, count, 0.05),
  };
}

/** Value at the given fraction rank (0–1) of a 256-bin luminance histogram. */
function percentileFromHistogram(histogram: Uint32Array, count: number, fraction: number): number {
  const target = Math.min(count - 1, Math.max(0, Math.floor(count * fraction)));
  let cumulative = 0;
  for (let bucket = 0; bucket < histogram.length; bucket += 1) {
    cumulative += histogram[bucket];
    if (cumulative > target) return bucket;
  }
  return 255;
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
