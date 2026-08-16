/**
 * Scroll-driven camera choreography for the landing backdrop.
 *
 * The landing sections announce themselves with `data-choreo` attributes
 * (hero | signals | process | cta). `useScrollChoreography` watches those
 * sections with an IntersectionObserver and folds their visibility ratios
 * into a single progress value in [0, 3]. The canvas reads the shared
 * `choreoBus` every frame and applies damped, eased camera rigs. No scroll
 * library is involved; reduced motion simply locks the frame at the hero rig
 * and leaves every section fully opaque.
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

export type ChoreoStage = "hero" | "signals" | "process" | "cta";

export const CHOREO_STAGE_IDS: readonly ChoreoStage[] = ["hero", "signals", "process", "cta"];

export interface ChoreoRig {
  /** Camera position in world units. */
  readonly position: readonly [number, number, number];
  /** Point the camera aims at. */
  readonly lookAt: readonly [number, number, number];
  /** 0 = lively particles, 1 = settled/calm. */
  readonly calm: number;
  /** Idle orbit amplitude in world units; 0 is a locked frame. */
  readonly drift: number;
}

export const CHOREO_RIGS: readonly ChoreoRig[] = [
  // hero — kidney centered and prominent, slow idle
  { position: [0, 0, 5.8], lookAt: [0, 0, 0], calm: 0, drift: 0.055 },
  // signals — camera dollies right and back; the kidney recedes to the left
  { position: [2.05, 0.6, 7.6], lookAt: [0.9, 0.15, 0], calm: 0.3, drift: 0.095 },
  // process — camera settles low, the particle field calms down
  { position: [0.6, -1.5, 6.6], lookAt: [0.1, -1, 0], calm: 0.85, drift: 0.04 },
  // cta — kidney returns to center, near-silent idle
  { position: [0, 0.35, 5.35], lookAt: [0, 0.45, 0], calm: 0.5, drift: 0.03 },
];

/**
 * Mutable state shared between the DOM-side choreography hook and the canvas
 * tree. The rig reads/progress and calm every frame; the hook writes progress;
 * the rig owns pointer tracking so the ripple and parallax interactions work even
 * though the backdrop canvas deliberately ignores pointer events (the page
 * underneath must stay scrollable).
 */
export interface ChoreoBusState {
  /** Current stage progress, 0 (hero) .. 3 (cta). */
  progress: number;
  /** Particle/field calm factor, 0..1, driven by the active rig. */
  calm: number;
  /** Pointer in normalized device coordinates, -1..1. */
  pointerX: number;
  pointerY: number;
  /** True while a primary pointer is pressed anywhere on the page. */
  down: boolean;
  /** Pointer projected onto the probe sphere in world space. */
  pointerWorld: THREE.Vector3;
}

export const choreoBus: ChoreoBusState = {
  progress: 0,
  calm: 0,
  pointerX: 0,
  pointerY: 0,
  down: false,
  pointerWorld: new THREE.Vector3(),
};

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export interface RigSample {
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly calm: number;
  readonly drift: number;
}

/** Blends the two rigs surrounding `progress` with an eased fractional step. */
export function sampleChoreo(progress: number): RigSample {
  const p = Math.min(Math.max(progress, 0), CHOREO_RIGS.length - 1);
  const index = Math.floor(p);
  const fraction = easeInOutCubic(p - index);
  const a = CHOREO_RIGS[index];
  const b = CHOREO_RIGS[Math.min(index + 1, CHOREO_RIGS.length - 1)];
  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * fraction,
      a.position[1] + (b.position[1] - a.position[1]) * fraction,
      a.position[2] + (b.position[2] - a.position[2]) * fraction,
    ],
    lookAt: [
      a.lookAt[0] + (b.lookAt[0] - a.lookAt[0]) * fraction,
      a.lookAt[1] + (b.lookAt[1] - a.lookAt[1]) * fraction,
      a.lookAt[2] + (b.lookAt[2] - a.lookAt[2]) * fraction,
    ],
    calm: a.calm + (b.calm - a.calm) * fraction,
    drift: a.drift + (b.drift - a.drift) * fraction,
  };
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

const IO_THRESHOLDS = [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88, 0.96, 1];

const FADE_TRANSITION = "opacity 700ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Watches the landing sections and drives the shared choreography bus.
 *
 * - `[data-choreo]` sections feed the stage progress (weighted by how much of
 *   each section is actually in the viewport, so transitions blend naturally).
 * - `[data-choreo-fade]` sections crossfade over the canvas with a pure CSS
 *   opacity transition, fed by the same IntersectionObserver state.
 *
 * Reduced motion keeps every fade at full opacity and pins the bus to the hero
 * frame: a static composed frame with content flowing normally.
 */
export function useScrollChoreography(): { readonly reduced: boolean } {
  const reduced = useReducedMotion();

  useEffect(() => {
    choreoBus.progress = 0;
    choreoBus.calm = 0;

    const fades = Array.from(document.querySelectorAll<HTMLElement>("[data-choreo-fade]"));
    const stages = Array.from(document.querySelectorAll<HTMLElement>("[data-choreo]"));

    const settleFades = (opacity: number) => {
      for (const el of fades) {
        el.style.transition = "none";
        el.style.opacity = opacity.toFixed(3);
      }
    };

    // Static composed frame: no choreography, no crossfades, content flows
    // normally over a fixed hero composition.
    if (reduced || stages.length === 0) {
      settleFades(1);
      return;
    }

    const ratios = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        let dirty = false;
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const next = entry.isIntersecting ? entry.intersectionRatio : 0;
          if (Math.abs((ratios.get(target) ?? 0) - next) < 1e-4) continue;
          ratios.set(target, next);
          dirty = true;
        }
        if (dirty) apply();
      },
      { threshold: IO_THRESHOLDS },
    );

    function apply() {
      let weightSum = 0;
      let weighted = 0;
      for (const el of stages) {
        const index = CHOREO_STAGE_IDS.indexOf(el.dataset.choreo as ChoreoStage);
        if (index < 0) continue;
        const weight = ratios.get(el) ?? 0;
        weightSum += weight;
        weighted += index * weight;
      }
      choreoBus.progress =
        weightSum > 1e-4 ? Math.min(weighted / weightSum, CHOREO_STAGE_IDS.length - 1) : 0;

      for (const el of fades) {
        const ratio = ratios.get(el) ?? 0;
        el.style.transition = FADE_TRANSITION;
        el.style.opacity = Math.min(1, ratio * 2.4).toFixed(3);
      }
    }

    for (const el of stages) {
      ratios.set(el, 0);
      observer.observe(el);
    }
    for (const el of fades) {
      if (stages.includes(el)) continue;
      ratios.set(el, 0);
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      choreoBus.progress = 0;
      choreoBus.calm = 0;
      choreoBus.down = false;
      for (const el of fades) {
        el.style.transition = "none";
        el.style.opacity = "";
      }
    };
  }, [reduced]);

  return { reduced };
}