/**
 * Annotation shapes stored in IMAGE-RELATIVE coordinates (fractions of the
 * natural image width/height, 0..1). Storing relative coordinates means
 * shapes survive zoom, pan, window resize, rotation and fullscreen without
 * any re-projection work: every render maps image-relative -> screen.
 *
 * Pure geometry (no DOM). Canvas drawing lives in the imaging workspace.
 */

export type Rotation = 0 | 90 | 180 | 270;

/** Point in image-relative coordinates (fractions of natural width/height). */
export type ImagePoint = { x: number; y: number };

export type AnnotationKind = "arrow" | "circle" | "rect" | "freehand" | "text";

export type AnnotationShape =
  | { id: string; kind: "arrow"; start: ImagePoint; end: ImagePoint; color: string }
  | { id: string; kind: "circle"; center: ImagePoint; radiusX: number; radiusY: number; color: string }
  | { id: string; kind: "rect"; start: ImagePoint; end: ImagePoint; color: string }
  | { id: string; kind: "freehand"; points: ImagePoint[]; color: string }
  | { id: string; kind: "text"; point: ImagePoint; text: string; color: string };

/** In-progress shape while the pointer is down (not yet committed). */
export type DraftShape =
  | { kind: "arrow" | "rect"; start: ImagePoint; current: ImagePoint }
  | { kind: "circle"; start: ImagePoint; current: ImagePoint }
  | { kind: "freehand"; points: ImagePoint[] };

export type ShapeBounds = { x0: number; y0: number; x1: number; y1: number };

/** Unique id for shapes and measurements. Falls back when crypto.randomUUID is unavailable. */
export function createShapeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Where the image lands inside the canvas, including rotation about the
 * canvas centre. `x`/`y` are the rotated-frame top-left; the screen mapping
 * is handled analytically in imageToScreen/screenToImage so the overlay
 * canvas never needs to rotate its context.
 */
export type ImagePlacement = {
  rotation: Rotation;
  zoom: number;
  x: number;
  y: number;
  renderedWidth: number;
  renderedHeight: number;
  boundsWidth: number;
  boundsHeight: number;
  naturalWidth: number;
  naturalHeight: number;
};

export function computeImagePlacement(
  bounds: { width: number; height: number },
  image: { naturalWidth: number; naturalHeight: number },
  zoom: number,
  pan: ImagePoint,
  rotation: Rotation,
): ImagePlacement {
  const rotatedWidth = rotation === 90 || rotation === 270 ? image.naturalHeight : image.naturalWidth;
  const rotatedHeight = rotation === 90 || rotation === 270 ? image.naturalWidth : image.naturalHeight;
  const scale = Math.min(bounds.width / rotatedWidth, bounds.height / rotatedHeight) * zoom;
  const renderedWidth = rotatedWidth * scale;
  const renderedHeight = rotatedHeight * scale;
  return {
    rotation,
    zoom,
    x: (bounds.width - renderedWidth) / 2 + pan.x,
    y: (bounds.height - renderedHeight) / 2 + pan.y,
    renderedWidth,
    renderedHeight,
    boundsWidth: bounds.width,
    boundsHeight: bounds.height,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  };
}

/** Image-relative point (u, v in 0..1) -> screen point inside the canvas. */
export function imageToScreen(placement: ImagePlacement, u: number, v: number): { x: number; y: number } {
  const rx = placement.x + u * placement.renderedWidth;
  const ry = placement.y + v * placement.renderedHeight;
  const cx = placement.boundsWidth / 2;
  const cy = placement.boundsHeight / 2;
  const dx = rx - cx;
  const dy = ry - cy;
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Screen point -> image-relative point, or null when outside the image. */
export function screenToImage(placement: ImagePlacement, x: number, y: number): ImagePoint | null {
  if (placement.renderedWidth <= 0 || placement.renderedHeight <= 0) return null;
  const cx = placement.boundsWidth / 2;
  const cy = placement.boundsHeight / 2;
  const dx = x - cx;
  const dy = y - cy;
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rx = cx + dx * cos + dy * sin;
  const ry = cy - dx * sin + dy * cos;
  const u = (rx - placement.x) / placement.renderedWidth;
  const v = (ry - placement.y) / placement.renderedHeight;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return null;
  return { x: u, y: v };
}

/** Font size used for text annotations on screen, scaled with the image. */
export function textFontSize(placement: ImagePlacement): number {
  const scale = placement.renderedWidth / placement.naturalWidth;
  return Math.max(11, Math.min(36, scale * 16));
}

/** Image-relative bounding box of a shape (for selection highlights). */
export function shapeBounds(shape: AnnotationShape): ShapeBounds {
  switch (shape.kind) {
    case "arrow":
      return {
        x0: Math.min(shape.start.x, shape.end.x),
        y0: Math.min(shape.start.y, shape.end.y),
        x1: Math.max(shape.start.x, shape.end.x),
        y1: Math.max(shape.start.y, shape.end.y),
      };
    case "circle":
      return {
        x0: shape.center.x - shape.radiusX,
        y0: shape.center.y - shape.radiusY,
        x1: shape.center.x + shape.radiusX,
        y1: shape.center.y + shape.radiusY,
      };
    case "rect":
      return {
        x0: Math.min(shape.start.x, shape.end.x),
        y0: Math.min(shape.start.y, shape.end.y),
        x1: Math.max(shape.start.x, shape.end.x),
        y1: Math.max(shape.start.y, shape.end.y),
      };
    case "freehand": {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const point of shape.points) {
        x0 = Math.min(x0, point.x);
        y0 = Math.min(y0, point.y);
        x1 = Math.max(x1, point.x);
        y1 = Math.max(y1, point.y);
      }
      if (shape.points.length === 0) return { x0: 0, y0: 0, x1: 0, y1: 0 };
      return { x0, y0, x1, y1 };
    }
    case "text":
      return { x0: shape.point.x - 0.02, y0: shape.point.y - 0.02, x1: shape.point.x + 0.02, y1: shape.point.y + 0.02 };
  }
}

const clampRelative = (value: number) => Math.max(0, Math.min(1, value));

/** Shift a shape by a relative delta, clamping points to the image. */
export function moveShape(shape: AnnotationShape, dx: number, dy: number): AnnotationShape {
  switch (shape.kind) {
    case "arrow":
      return {
        ...shape,
        start: { x: clampRelative(shape.start.x + dx), y: clampRelative(shape.start.y + dy) },
        end: { x: clampRelative(shape.end.x + dx), y: clampRelative(shape.end.y + dy) },
      };
    case "circle":
      return {
        ...shape,
        center: { x: clampRelative(shape.center.x + dx), y: clampRelative(shape.center.y + dy) },
      };
    case "rect":
      return {
        ...shape,
        start: { x: clampRelative(shape.start.x + dx), y: clampRelative(shape.start.y + dy) },
        end: { x: clampRelative(shape.end.x + dx), y: clampRelative(shape.end.y + dy) },
      };
    case "freehand":
      return {
        ...shape,
        points: shape.points.map((point) => ({ x: clampRelative(point.x + dx), y: clampRelative(point.y + dy) })),
      };
    case "text":
      return { ...shape, point: { x: clampRelative(shape.point.x + dx), y: clampRelative(shape.point.y + dy) } };
  }
}

/**
 * Topmost shape whose stroke (or interior, for rect/circle) is within
 * `tolerance` screen px of (x, y). Returns null when nothing is hit.
 */
export function hitTestAnnotations(
  placement: ImagePlacement,
  shapes: AnnotationShape[],
  x: number,
  y: number,
  tolerance: number,
): AnnotationShape | null {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    if (hitsShape(placement, shapes[index], x, y, tolerance)) return shapes[index];
  }
  return null;
}

function distanceToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / lengthSquared));
  return Math.hypot(px - (a.x + t * abx), py - (a.y + t * aby));
}

function hitsShape(
  placement: ImagePlacement,
  shape: AnnotationShape,
  px: number,
  py: number,
  tolerance: number,
): boolean {
  switch (shape.kind) {
    case "arrow": {
      const a = imageToScreen(placement, shape.start.x, shape.start.y);
      const b = imageToScreen(placement, shape.end.x, shape.end.y);
      return distanceToSegment(px, py, a, b) <= tolerance;
    }
    case "rect": {
      const a = imageToScreen(placement, shape.start.x, shape.start.y);
      const b = imageToScreen(placement, shape.end.x, shape.end.y);
      const left = Math.min(a.x, b.x);
      const right = Math.max(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const bottom = Math.max(a.y, b.y);
      const dx = Math.max(left - px, 0, px - right);
      const dy = Math.max(top - py, 0, py - bottom);
      return Math.hypot(dx, dy) <= tolerance;
    }
    case "circle": {
      const center = imageToScreen(placement, shape.center.x, shape.center.y);
      const a = shape.radiusX * placement.renderedWidth;
      const b = shape.radiusY * placement.renderedHeight;
      const dx = px - center.x;
      const dy = py - center.y;
      if (a <= 0 || b <= 0) return Math.hypot(dx, dy) <= tolerance;
      const scaled = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
      if (scaled <= 1) return true;
      return (scaled - 1) * Math.min(a, b) <= tolerance;
    }
    case "freehand": {
      const points = shape.points.map((point) => imageToScreen(placement, point.x, point.y));
      if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y) <= tolerance;
      for (let index = 1; index < points.length; index += 1) {
        if (distanceToSegment(px, py, points[index - 1], points[index]) <= tolerance) return true;
      }
      return false;
    }
    case "text": {
      const point = imageToScreen(placement, shape.point.x, shape.point.y);
      return Math.hypot(px - point.x, py - point.y) <= Math.max(tolerance, textFontSize(placement) * 0.6);
    }
  }
}