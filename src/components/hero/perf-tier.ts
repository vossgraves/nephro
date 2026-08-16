/**
 * Client capability probe that maps the current device to a rendering tier.
 * Every read is guarded: a missing `navigator`/`window.matchMedia`, the
 * Chromium-only `deviceMemory` field, or an unknown core count falls back to
 * conservative defaults instead of crashing.
 *
 * Tiers (per the production-upgrade plan):
 * - low:  dpr 1, 90 particles, no fresnel time animation (static rim)
 * - mid:  dpr <= 1.25, 180 particles
 * - high: current settings (dpr <= 1.5, 280 particles)
 */

export type PerfTier = "low" | "mid" | "high";

export interface PerfConfig {
  readonly tier: PerfTier;
  /** Device pixel ratio cap passed to the R3F canvas. */
  readonly maxDpr: number;
  /** Particle count for the hero signal field (always <= PARTICLE_CAP). */
  readonly particles: number;
  /** When false the fresnel rim pulse is frozen to a static silhouette. */
  readonly animateFresnel: boolean;
}

/**
 * Hard ceiling for the particle system. The repulsion solver and the per-frame
 * spring integration run in JavaScript, so the count is deliberately bounded.
 */
export const PARTICLE_CAP = 340;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

function matchesMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

export function getPerfTier(): PerfTier {
  if (typeof navigator === "undefined") return "high";

  // Reduced motion wins outright: a static, cheap scene is the point.
  if (matchesMedia(REDUCED_MOTION_QUERY)) return "low";

  const coarse = matchesMedia(COARSE_POINTER_QUERY);
  const cores = navigator.hardwareConcurrency;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;

  // Undefined fields fall back to a conservative guess for the form factor.
  const coresCount = cores ?? (coarse ? 4 : 8);
  const memoryCount = memory ?? (coarse ? 4 : 8);

  if (coresCount <= 2 || memoryCount <= 2 || (coarse && coresCount <= 4 && memoryCount <= 4)) {
    return "low";
  }
  if (coresCount <= 4 || memoryCount <= 4 || coarse) {
    return "mid";
  }
  return "high";
}

export function getPerfConfig(): PerfConfig {
  const tier = getPerfTier();
  if (tier === "low") {
    return { tier, maxDpr: 1, particles: 90, animateFresnel: false };
  }
  if (tier === "mid") {
    return { tier, maxDpr: 1.25, particles: 180, animateFresnel: true };
  }
  return { tier, maxDpr: 1.5, particles: 280, animateFresnel: true };
}