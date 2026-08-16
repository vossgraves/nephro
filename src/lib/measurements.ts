/**
 * Pixel measurements computed from image-relative points and the natural
 * image dimensions. All values are in SCREEN PIXELS of the source image —
 * there is no calibration data, so they are never converted to physical
 * units. The UI must label them accordingly.
 *
 * Pure math (no DOM), unit-testable.
 */

import type { ImagePoint } from "./annotations";

export type MeasurementKind = "distance" | "angle" | "area";

export type Measurement =
  | { id: string; kind: "distance"; start: ImagePoint; end: ImagePoint }
  | { id: string; kind: "angle"; first: ImagePoint; vertex: ImagePoint; last: ImagePoint }
  | { id: string; kind: "area"; corner: ImagePoint; opposite: ImagePoint };

/** In-progress measurement while the pointer is down (not yet committed). */
export type MeasurementDraft =
  | { kind: "distance"; start: ImagePoint; current: ImagePoint }
  | { kind: "area"; start: ImagePoint; current: ImagePoint };

/** Straight-line distance between two points, in source pixels. */
export function distancePixels(a: ImagePoint, b: ImagePoint, width: number, height: number): number {
  const dx = (b.x - a.x) * width;
  const dy = (b.y - a.y) * height;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Angle in degrees (0–180) between the two rays meeting at the vertex. */
export function angleDegrees(first: ImagePoint, vertex: ImagePoint, last: ImagePoint, width: number, height: number): number {
  const ax = (first.x - vertex.x) * width;
  const ay = (first.y - vertex.y) * height;
  const bx = (last.x - vertex.x) * width;
  const by = (last.y - vertex.y) * height;
  const magnitude = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (magnitude === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / magnitude));
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Area of the rectangle ROI between two opposite corners, in pixels squared. */
export function rectAreaPixels(corner: ImagePoint, opposite: ImagePoint, width: number, height: number): number {
  return Math.abs((opposite.x - corner.x) * width) * Math.abs((opposite.y - corner.y) * height);
}

/** "1,234 px" */
export function formatPixelLength(pixels: number): string {
  return `${Math.round(pixels).toLocaleString("en-US")} px`;
}

/** "45.2°" */
export function formatAngleDegrees(degrees: number): string {
  return `${(Math.round(degrees * 10) / 10).toLocaleString("en-US")}°`;
}

/** "1,234 px²", "12.3 kpx²" or "1.23 Mpx²" depending on magnitude. */
export function formatPixelArea(pixels: number): string {
  if (pixels >= 1_000_000) return `${(pixels / 1_000_000).toFixed(2)} Mpx²`;
  if (pixels >= 1_000) return `${(pixels / 1_000).toFixed(1)} kpx²`;
  return `${Math.round(pixels).toLocaleString("en-US")} px²`;
}