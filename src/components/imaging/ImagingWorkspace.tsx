"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ImagingModality,
  MAX_ANALYSIS_FILE_BYTES,
  modalityLabel,
  providerLabel,
  RecognitionProvider,
  RecognitionReport,
} from "@/lib/imaging-recognition";
import { KidneyLoader } from "@/components/KidneyLoader";
import { extractImageStats, ImageQualityMetrics, scoreFromStats } from "@/lib/image-quality";
import { buildReviewReport, ReportFindingState, ReportMeasurementEntry } from "@/lib/report";
import { BOSNIAK_FEATURES, bosniakClass } from "@/lib/bosniak";
import {
  AnnotationShape,
  computeImagePlacement,
  createShapeId,
  DraftShape,
  hitTestAnnotations,
  ImagePlacement,
  ImagePoint,
  imageToScreen,
  moveShape,
  Rotation,
  screenToImage,
  shapeBounds,
  textFontSize,
} from "@/lib/annotations";
import {
  angleDegrees,
  distancePixels,
  formatAngleDegrees,
  formatPixelArea,
  formatPixelLength,
  Measurement,
  MeasurementDraft,
  MeasurementKind,
  rectAreaPixels,
} from "@/lib/measurements";

type Sample = { x: number; y: number; value: string } | null;
type ImageInfo = { width: number; height: number; luminance: number; source: string };
/** Real analysis progress: transitions happen at actual await points, never on a timer. */
type AnalysisStage = "idle" | "uploading" | "waiting" | "done" | "error";
type Breakpoint = "phone" | "tablet" | "desktop";
type ActiveTool = "pan" | "select" | "arrow" | "circle" | "rect" | "freehand" | "text" | "distance" | "angle" | "area";
type FindingStatus = "pending" | "confirmed" | "rejected" | "edited";
type FindingState = { status: FindingStatus; text: string };
type ChatMessage = { role: "user" | "assistant"; text: string; meta?: string };
type ChatStatus = "idle" | "waiting" | "error";

/** One committed workspace state (annotations + measurements) in the undo stack. */
type HistoryEntry = { annotations: AnnotationShape[]; measurements: Measurement[] };
/** In-progress shape or measurement while the pointer is down. */
type Draft = DraftShape | MeasurementDraft;

const MAX_LOCAL_FILE_BYTES = 25 * 1024 * 1024;
const MAX_HISTORY = 60;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);
const modalities = Object.keys(modalityLabel) as ImagingModality[];

const SUGGESTED_QUESTIONS = [
  "Describe the visible structures.",
  "What limitations affect this image?",
  "What should a student inspect first?",
] as const;

/** Stroke colors for the three measurement kinds (distinct from annotation color). */
const MEASURE_COLORS: Record<MeasurementKind, string> = {
  distance: "#fbbf24",
  angle: "#34d399",
  area: "#7dd3fc",
};

const CURSOR_FOR_TOOL: Record<ActiveTool, string> = {
  pan: "grab",
  select: "default",
  arrow: "crosshair",
  circle: "crosshair",
  rect: "crosshair",
  freehand: "crosshair",
  text: "text",
  distance: "crosshair",
  angle: "crosshair",
  area: "crosshair",
};

const TOOL_HINTS: Record<ActiveTool, string> = {
  pan: "Drag to pan. Hover the image for pixel intensity.",
  select: "Click a shape to select it, drag to move it. Delete removes the selection, Clear removes all annotations.",
  arrow: "Drag from the tail toward the arrowhead.",
  circle: "Drag from one corner of the bounding box to the opposite corner.",
  rect: "Drag from one corner to the opposite corner.",
  freehand: "Drag to draw a freehand line. Release to finish.",
  text: "Tap to place the label, type, then press Enter. Escape cancels.",
  distance: "Drag between two points to measure distance in pixels.",
  angle: "Tap three points: first endpoint, vertex, second endpoint.",
  area: "Drag to define a rectangle ROI and measure its area in pixels.",
};

const QUALITY_SUBSCORES: Array<{ key: "resolution" | "contrast" | "brightness" | "noise" | "visibility"; label: string }> = [
  { key: "resolution", label: "Resolution" },
  { key: "contrast", label: "Contrast" },
  { key: "brightness", label: "Brightness" },
  { key: "noise", label: "Noise" },
  { key: "visibility", label: "Visibility" },
];

const MODALITY_CHECKLISTS: Partial<Record<ImagingModality, string[]>> = {
  ultrasound: [
    "Kidney size and length (small <9 cm suggests chronicity)",
    "Cortical thickness and echogenicity",
    "Corticomedullary differentiation",
    "Hydronephrosis / pelvicalyceal dilation",
    "Cysts (simple vs complex), masses, or stones",
  ],
  "ct-kub": [
    "Renal size, contour, and symmetry",
    "Stones — location, size, number (non-contrast phase)",
    "Hydronephrosis and ureteral dilation",
    "Cystic lesions — apply Bosniak v2019",
    "Contrast-enhancing solid masses",
  ],
  "ct-abdomen": [
    "Renal size, contour, and symmetry",
    "Solid or cystic renal masses — apply Bosniak v2019",
    "Perirenal fat stranding or collections",
    "Vascular findings (renal artery, IVC)",
    "Adjacent organ involvement",
  ],
  "ct-chest": [
    "Lung parenchyma, pleura, and mediastinum",
    "Pulmonary nodules or masses",
    "Adenopathy and pleural effusion",
    "Cardiac silhouette and great vessels",
  ],
  "mri-brain": [
    "Diffusion restriction and ADC correlation",
    "Mass lesions — enhancement pattern",
    "Hemorrhage — signal characteristics",
    "Ventricular size and midline shift",
  ],
  xray: [
    "Exposure, rotation, and inspiration adequacy",
    "Bony structures and alignment",
    "Soft tissue and joint spaces",
    "Implants or foreign bodies",
  ],
  "chest-xray": [
    "Exposure, rotation, and inspiration adequacy",
    "Lung fields — opacities, nodules, infiltrates",
    "Pleural spaces and costophrenic angles",
    "Cardiac silhouette and hilar contours",
  ],
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBreakpoint(width: number): Breakpoint {
  if (width < 720) return "phone";
  if (width < 1120) return "tablet";
  return "desktop";
}

/** The design system accent, resolved for canvas strokes (events/draw only, never render). */
function accentColor(): string {
  if (typeof document === "undefined") return "#c05f10";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  if (!value) return "#c05f10";
  try {
    const context = document.createElement("canvas").getContext("2d");
    if (context) {
      context.strokeStyle = value;
      if (context.strokeStyle !== value) return "#c05f10";
    }
  } catch {
    return "#c05f10";
  }
  return value;
}

type IconName =
  | "upload"
  | "zoomIn"
  | "zoomOut"
  | "invert"
  | "grid"
  | "reset"
  | "scan"
  | "check"
  | "arrow"
  | "warning"
  | "fit"
  | "rotate"
  | "fullscreen"
  | "minimize"
  | "pan"
  | "cursor"
  | "arrowLine"
  | "circle"
  | "rect"
  | "pen"
  | "text"
  | "undo"
  | "redo"
  | "trash"
  | "ruler"
  | "angle"
  | "area"
  | "eraser"
  | "x"
  | "copy"
  | "download"
  | "printer";

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "upload") return <svg {...props}><path d="M12 16V4m0 0 4 4m-4-4L8 8M5 14v4.4A1.6 1.6 0 0 0 6.6 20h10.8a1.6 1.6 0 0 0 1.6-1.6V14" /></svg>;
  if (name === "zoomIn") return <svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="M11 8v6m-3-3h6m8 8-5.5-5.5" /></svg>;
  if (name === "zoomOut") return <svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="M8 11h6m8 8-5.5-5.5" /></svg>;
  if (name === "invert") return <svg {...props}><path d="M12 3a9 9 0 1 0 0 18V3Z" /><path d="M12 3a9 9 0 0 1 0 18" /></svg>;
  if (name === "grid") return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M12 4v16M4 12h16" /></svg>;
  if (name === "scan") return <svg {...props}><path d="M4 8V6a2 2 0 0 1 2-2h2m8 0h2a2 2 0 0 1 2 2v2M4 16v2a2 2 0 0 0 2 2h2m8 0h2a2 2 0 0 0 2-2v-2M7 12h10" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (name === "check") return <svg {...props}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "arrow") return <svg {...props}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
  if (name === "warning") return <svg {...props}><path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" /><path d="M12 9v4m0 4h.01" /></svg>;
  if (name === "fit") return <svg {...props}><path d="M15 3h6v6M9 3H3v6M15 21h6v-6M9 21H3v-5" /></svg>;
  if (name === "rotate") return <svg {...props}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>;
  if (name === "fullscreen") return <svg {...props}><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>;
  if (name === "minimize") return <svg {...props}><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" /></svg>;
  if (name === "pan") return <svg {...props}><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" /><path d="M2 12h20M12 2v20" /></svg>;
  if (name === "cursor") return <svg {...props}><path d="m4 4 7.07 17 2.51-7.39L21 11.07 4 4Z" /></svg>;
  if (name === "arrowLine") return <svg {...props}><path d="M4 20 20 4M13 4h7v7" /></svg>;
  if (name === "circle") return <svg {...props}><circle cx="12" cy="12" r="9" /></svg>;
  if (name === "rect") return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="1" /></svg>;
  if (name === "pen") return <svg {...props}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
  if (name === "text") return <svg {...props}><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>;
  if (name === "undo") return <svg {...props}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2L3 13" /></svg>;
  if (name === "redo") return <svg {...props}><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2l3 3" /></svg>;
  if (name === "trash") return <svg {...props}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></svg>;
  if (name === "ruler") return <svg {...props}><path d="M21.3 8.7 15.3 2.7a1 1 0 0 0-1.4 0l-11.2 11.2a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0l11.2-11.2a1 1 0 0 0 0-1.4Z" /><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2" /></svg>;
  if (name === "angle") return <svg {...props}><path d="M7 17V7h10" /><path d="M7 12a5 5 0 0 0 5 5" /></svg>;
  if (name === "area") return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="m4 20 16-16" /></svg>;
  if (name === "eraser") return <svg {...props}><path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21" /><path d="M22 21H7M5 11l9 9" /></svg>;
  if (name === "x") return <svg {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === "copy") return <svg {...props}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
  if (name === "download") return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
  if (name === "printer") return <svg {...props}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>;
  return <svg {...props}><path d="M20 11a8 8 0 1 0 2 5.4" /><path d="M20 4v7h-7" /></svg>;
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{empty}</p>;
  return <ul className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>{items.map((item, index) => <li className="flex gap-2" key={`${item}-${index}`}><span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />{item}</li>)}</ul>;
}

function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginRight: "0.15rem" }}>{label}</span>
      {children}
    </div>
  );
}

function ToolButton({ icon, label, onClick, active = false, disabled = false }: { icon: IconName; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="pressable"
      style={{
        width: "30px",
        height: "30px",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent-fg)" : "var(--text)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "calc(var(--radius-base) - 6px)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
        transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease",
      }}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  );
}

function FindingChip({ status }: { status: FindingStatus }) {
  const styleByStatus: Record<FindingStatus, { background: string; color: string; label: string }> = {
    pending: { background: "var(--surface-inset)", color: "var(--muted)", label: "Not rated" },
    confirmed: { background: "rgba(34, 197, 94, 0.12)", color: "#15803d", label: "Confirmed" },
    edited: { background: "rgba(245, 158, 11, 0.12)", color: "#b45309", label: "Edited" },
    rejected: { background: "rgba(239, 68, 68, 0.12)", color: "#b91c1c", label: "Rejected" },
  };
  const style = styleByStatus[status];
  return (
    <span style={{ padding: "0.2rem 0.5rem", borderRadius: "999px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", background: style.background, color: style.color, whiteSpace: "nowrap" }}>{style.label}</span>
  );
}

function MiniButton({ label, onClick, tone = "neutral", disabled = false }: { label: string; onClick: () => void; tone?: "neutral" | "accent" | "danger"; disabled?: boolean }) {
  const background = tone === "accent" ? "var(--accent)" : tone === "danger" ? "rgba(239, 68, 68, 0.1)" : "transparent";
  const color = tone === "accent" ? "var(--accent-fg)" : tone === "danger" ? "#b91c1c" : "var(--text)";
  const border = tone === "accent" ? "var(--accent)" : tone === "danger" ? "rgba(239, 68, 68, 0.35)" : "var(--border)";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="pressable" style={{ padding: "0.3rem 0.6rem", fontSize: "11px", fontWeight: "600", background, color, border: `1px solid ${border}`, borderRadius: "calc(var(--radius-base) - 6px)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, whiteSpace: "nowrap", transition: "background-color 120ms ease, border-color 120ms ease, opacity 120ms ease" }}>{label}</button>
  );
}

// ---------- Canvas drawing helpers (module level, pure-ish: only take ctx + data) ----------

function strokeLine(context: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, width: number) {
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function drawArrowhead(context: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 9;
  const spread = Math.PI / 7;
  context.beginPath();
  context.moveTo(to.x, to.y);
  context.lineTo(to.x - size * Math.cos(angle - spread), to.y - size * Math.sin(angle - spread));
  context.lineTo(to.x - size * Math.cos(angle + spread), to.y - size * Math.sin(angle + spread));
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawEndpointDot(context: CanvasRenderingContext2D, point: { x: number; y: number }, color: string) {
  context.beginPath();
  context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = "rgba(0,0,0,0.5)";
  context.lineWidth = 1;
  context.stroke();
}

function drawLabel(context: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size = 11) {
  context.font = `600 ${size}px ui-monospace, "SF Mono", "Cascadia Code", monospace`;
  context.textBaseline = "middle";
  context.lineWidth = 3;
  context.strokeStyle = "rgba(0,0,0,0.65)";
  context.strokeText(text, x, y);
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function drawSelectionHighlight(context: CanvasRenderingContext2D, placement: ImagePlacement, shape: AnnotationShape) {
  const bounds = shapeBounds(shape);
  const a = imageToScreen(placement, bounds.x0, bounds.y0);
  const b = imageToScreen(placement, bounds.x1, bounds.y1);
  const x = Math.min(a.x, b.x) - 4;
  const y = Math.min(a.y, b.y) - 4;
  const width = Math.abs(b.x - a.x) + 8;
  const height = Math.abs(b.y - a.y) + 8;
  context.save();
  context.setLineDash([5, 4]);
  context.lineWidth = 3;
  context.strokeStyle = "rgba(0,0,0,0.55)";
  context.strokeRect(x, y, width, height);
  context.lineWidth = 1.5;
  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.strokeRect(x, y, width, height);
  context.setLineDash([]);
  context.restore();
}

function drawAnnotationShape(context: CanvasRenderingContext2D, placement: ImagePlacement, shape: AnnotationShape, selected: boolean) {
  switch (shape.kind) {
    case "arrow": {
      const a = imageToScreen(placement, shape.start.x, shape.start.y);
      const b = imageToScreen(placement, shape.end.x, shape.end.y);
      strokeLine(context, a, b, shape.color, 2.5);
      drawArrowhead(context, a, b, shape.color);
      break;
    }
    case "circle": {
      const center = imageToScreen(placement, shape.center.x, shape.center.y);
      context.beginPath();
      context.ellipse(center.x, center.y, shape.radiusX * placement.renderedWidth, shape.radiusY * placement.renderedHeight, 0, 0, Math.PI * 2);
      context.strokeStyle = shape.color;
      context.lineWidth = 2.5;
      context.stroke();
      break;
    }
    case "rect": {
      const a = imageToScreen(placement, shape.start.x, shape.start.y);
      const b = imageToScreen(placement, shape.end.x, shape.end.y);
      context.beginPath();
      context.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      context.save();
      context.globalAlpha = 0.07;
      context.fillStyle = shape.color;
      context.fill();
      context.restore();
      context.strokeStyle = shape.color;
      context.lineWidth = 2.5;
      context.stroke();
      break;
    }
    case "freehand": {
      const points = shape.points.map((point) => imageToScreen(placement, point.x, point.y));
      if (points.length >= 2) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (const point of points) context.lineTo(point.x, point.y);
        context.strokeStyle = shape.color;
        context.lineWidth = 2.5;
        context.stroke();
      } else if (points.length === 1) {
        drawEndpointDot(context, points[0], shape.color);
      }
      break;
    }
    case "text": {
      const point = imageToScreen(placement, shape.point.x, shape.point.y);
      const size = textFontSize(placement);
      context.font = `600 ${size}px system-ui, sans-serif`;
      context.textBaseline = "middle";
      context.lineWidth = 4;
      context.strokeStyle = "rgba(0,0,0,0.55)";
      context.strokeText(shape.text, point.x, point.y);
      context.fillStyle = shape.color;
      context.fillText(shape.text, point.x, point.y);
      break;
    }
  }
  if (selected) drawSelectionHighlight(context, placement, shape);
}

function drawAnnotationShapes(context: CanvasRenderingContext2D, placement: ImagePlacement, shapes: AnnotationShape[], selectedId: string | null) {
  for (const shape of shapes) drawAnnotationShape(context, placement, shape, shape.id === selectedId);
}

function drawMeasurement(context: CanvasRenderingContext2D, placement: ImagePlacement, measurement: Measurement, naturalWidth: number, naturalHeight: number) {
  if (measurement.kind === "distance") {
    const a = imageToScreen(placement, measurement.start.x, measurement.start.y);
    const b = imageToScreen(placement, measurement.end.x, measurement.end.y);
    strokeLine(context, a, b, MEASURE_COLORS.distance, 2);
    drawEndpointDot(context, a, MEASURE_COLORS.distance);
    drawEndpointDot(context, b, MEASURE_COLORS.distance);
    drawLabel(context, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8, formatPixelLength(distancePixels(measurement.start, measurement.end, naturalWidth, naturalHeight)), MEASURE_COLORS.distance);
    return;
  }
  if (measurement.kind === "angle") {
    const vertex = imageToScreen(placement, measurement.vertex.x, measurement.vertex.y);
    const first = imageToScreen(placement, measurement.first.x, measurement.first.y);
    const last = imageToScreen(placement, measurement.last.x, measurement.last.y);
    strokeLine(context, vertex, first, MEASURE_COLORS.angle, 2);
    strokeLine(context, vertex, last, MEASURE_COLORS.angle, 2);
    drawEndpointDot(context, first, MEASURE_COLORS.angle);
    drawEndpointDot(context, vertex, MEASURE_COLORS.angle);
    drawEndpointDot(context, last, MEASURE_COLORS.angle);
    const startAngle = Math.atan2(first.y - vertex.y, first.x - vertex.x);
    const endAngle = Math.atan2(last.y - vertex.y, last.x - vertex.x);
    let delta = endAngle - startAngle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const radius = Math.min(26, Math.hypot(first.x - vertex.x, first.y - vertex.y) * 0.35, Math.hypot(last.x - vertex.x, last.y - vertex.y) * 0.35);
    if (radius > 4) {
      context.beginPath();
      context.arc(vertex.x, vertex.y, radius, startAngle, startAngle + delta, delta < 0);
      context.strokeStyle = MEASURE_COLORS.angle;
      context.lineWidth = 2;
      context.stroke();
    }
    const mid = startAngle + delta / 2;
    drawLabel(
      context,
      vertex.x + Math.cos(mid) * (radius + 10),
      vertex.y + Math.sin(mid) * (radius + 10),
      formatAngleDegrees(angleDegrees(measurement.first, measurement.vertex, measurement.last, naturalWidth, naturalHeight)),
      MEASURE_COLORS.angle,
    );
    return;
  }
  const a = imageToScreen(placement, measurement.corner.x, measurement.corner.y);
  const b = imageToScreen(placement, measurement.opposite.x, measurement.opposite.y);
  context.beginPath();
  context.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  context.save();
  context.globalAlpha = 0.07;
  context.fillStyle = MEASURE_COLORS.area;
  context.fill();
  context.restore();
  context.strokeStyle = MEASURE_COLORS.area;
  context.lineWidth = 2;
  context.stroke();
  drawLabel(context, (a.x + b.x) / 2, (a.y + b.y) / 2, formatPixelArea(rectAreaPixels(measurement.corner, measurement.opposite, naturalWidth, naturalHeight)), MEASURE_COLORS.area);
}

function drawMeasurements(context: CanvasRenderingContext2D, placement: ImagePlacement, measurements: Measurement[], naturalWidth: number, naturalHeight: number) {
  for (const measurement of measurements) drawMeasurement(context, placement, measurement, naturalWidth, naturalHeight);
}

function drawDraft(context: CanvasRenderingContext2D, placement: ImagePlacement, draft: Draft, naturalWidth: number, naturalHeight: number, color: string) {
  switch (draft.kind) {
    case "arrow": {
      const a = imageToScreen(placement, draft.start.x, draft.start.y);
      const b = imageToScreen(placement, draft.current.x, draft.current.y);
      strokeLine(context, a, b, color, 2.5);
      drawArrowhead(context, a, b, color);
      return;
    }
    case "rect": {
      const a = imageToScreen(placement, draft.start.x, draft.start.y);
      const b = imageToScreen(placement, draft.current.x, draft.current.y);
      context.beginPath();
      context.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      context.save();
      context.globalAlpha = 0.07;
      context.fillStyle = color;
      context.fill();
      context.restore();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
      return;
    }
    case "circle": {
      const a = imageToScreen(placement, draft.start.x, draft.start.y);
      const b = imageToScreen(placement, draft.current.x, draft.current.y);
      context.beginPath();
      context.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
      return;
    }
    case "freehand": {
      const points = draft.points.map((point) => imageToScreen(placement, point.x, point.y));
      if (points.length === 0) return;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points) context.lineTo(point.x, point.y);
      context.strokeStyle = color;
      context.lineWidth = 2.5;
      context.stroke();
      return;
    }
    case "distance": {
      const a = imageToScreen(placement, draft.start.x, draft.start.y);
      const b = imageToScreen(placement, draft.current.x, draft.current.y);
      strokeLine(context, a, b, MEASURE_COLORS.distance, 2);
      drawEndpointDot(context, a, MEASURE_COLORS.distance);
      drawEndpointDot(context, b, MEASURE_COLORS.distance);
      drawLabel(context, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8, formatPixelLength(distancePixels(draft.start, draft.current, naturalWidth, naturalHeight)), MEASURE_COLORS.distance);
      return;
    }
    case "area": {
      const a = imageToScreen(placement, draft.start.x, draft.start.y);
      const b = imageToScreen(placement, draft.current.x, draft.current.y);
      context.beginPath();
      context.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      context.save();
      context.globalAlpha = 0.07;
      context.fillStyle = MEASURE_COLORS.area;
      context.fill();
      context.restore();
      context.strokeStyle = MEASURE_COLORS.area;
      context.lineWidth = 2;
      context.stroke();
      drawLabel(context, (a.x + b.x) / 2, (a.y + b.y) / 2, formatPixelArea(rectAreaPixels(draft.start, draft.current, naturalWidth, naturalHeight)), MEASURE_COLORS.area);
      return;
    }
  }
}

function drawAngleDraft(context: CanvasRenderingContext2D, placement: ImagePlacement, points: ImagePoint[], preview: ImagePoint | null, naturalWidth: number, naturalHeight: number) {
  if (points.length === 0 && !preview) return;
  const color = MEASURE_COLORS.angle;
  const screen = points.map((point) => imageToScreen(placement, point.x, point.y));
  for (const point of screen) drawEndpointDot(context, point, color);
  if (screen.length >= 2) strokeLine(context, screen[0], screen[1], color, 2);
  if (!preview) return;
  const p = imageToScreen(placement, preview.x, preview.y);
  context.save();
  context.setLineDash([4, 4]);
  if (screen.length >= 2) {
    strokeLine(context, screen[1], p, color, 2);
    context.setLineDash([]);
    context.restore();
    const label = formatAngleDegrees(angleDegrees(points[0], points[1], preview, naturalWidth, naturalHeight));
    drawLabel(context, (screen[1].x + p.x) / 2, (screen[1].y + p.y) / 2, label, color);
  } else {
    if (screen.length === 1) strokeLine(context, screen[0], p, color, 2);
    context.setLineDash([]);
    context.restore();
  }
}

function measurementSummary(measurement: Measurement, width: number, height: number): string {
  if (measurement.kind === "distance") return `Distance ${formatPixelLength(distancePixels(measurement.start, measurement.end, width, height))}`;
  if (measurement.kind === "angle") return `Angle ${formatAngleDegrees(angleDegrees(measurement.first, measurement.vertex, measurement.last, width, height))}`;
  return `ROI ${formatPixelArea(rectAreaPixels(measurement.corner, measurement.opposite, width, height))}`;
}

type RouteErrorBody = { error?: string; code?: string };

/**
 * Map the imaging routes' { error, code } shapes (analyze + chat) to distinct,
 * understandable user-facing messages. Status is used as a fallback when the
 * response body is missing or the code is absent.
 */
function routeErrorMessage(status: number, body: RouteErrorBody | null, fallback: string): string {
  if (body?.code === "RATE_LIMITED" || status === 429) {
    return "Too many requests. Please wait about a minute and try again.";
  }
  if (body?.code === "PAYLOAD_TOO_LARGE" || status === 413) {
    return "The image is too large for provider review. Choose an image smaller than 4 MB and try again.";
  }
  if (body?.error) return body.error;
  if (status === 503) return "No AI provider could complete the request. Try again later.";
  if (status === 400 || status === 422) return "The request was not accepted. Check your inputs and try again.";
  return fallback;
}

export default function ImagingWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const viewerCardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [quality, setQuality] = useState<ImageQualityMetrics | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<Rotation>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sample, setSample] = useState<Sample>(null);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [activeTool, setActiveTool] = useState<ActiveTool>("pan");
  const [history, setHistory] = useState<HistoryEntry[]>([{ annotations: [], measurements: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [angleDraft, setAngleDraft] = useState<ImagePoint[]>([]);
  const [anglePreview, setAnglePreview] = useState<ImagePoint | null>(null);
  const [pendingText, setPendingText] = useState<{ point: ImagePoint; value: string } | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [dragMove, setDragMove] = useState<{ id: string; start: ImagePoint; shape: AnnotationShape } | null>(null);
  const [movingShape, setMovingShape] = useState<AnnotationShape | null>(null);

  const [checkedFindings, setCheckedFindings] = useState<Set<string>>(new Set());
  const [bosniakSelected, setBosniakSelected] = useState<Set<string>>(new Set());

  const [modality, setModality] = useState<ImagingModality>("ultrasound");
  const [clinicalQuestion, setClinicalQuestion] = useState("");
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(false);
  const [providerStatus, setProviderStatus] = useState<"ready" | "checking" | "unavailable">("checking");
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [report, setReport] = useState<RecognitionReport | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [chatError, setChatError] = useState<string | null>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  const [findingStates, setFindingStates] = useState<Record<number, FindingState>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"copied" | "failed" | null>(null);

  const entry = history[historyIndex];
  const annotations = entry.annotations;
  const measurements = entry.measurements;

  const resetView = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setInvert(false);
    setGrid(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setSample(null);
  }, []);

  const commitEntry = useCallback((next: HistoryEntry) => {
    setHistory((current) => {
      const base = current.slice(0, historyIndex + 1);
      const updated = [...base, next];
      return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
    });
    setHistoryIndex((current) => Math.min(current + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    setHistoryIndex((current) => (current > 0 ? current - 1 : current));
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    setHistoryIndex((current) => (current < history.length - 1 ? current + 1 : current));
    setSelectedId(null);
  }, [history.length]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commitEntry({ annotations: annotations.filter((shape) => shape.id !== selectedId), measurements });
    setSelectedId(null);
  }, [annotations, commitEntry, measurements, selectedId]);

  const clearAnnotations = useCallback(() => {
    if (annotations.length === 0) return;
    commitEntry({ annotations: [], measurements });
    setSelectedId(null);
  }, [annotations.length, commitEntry, measurements]);

  const clearMeasurements = useCallback(() => {
    if (measurements.length === 0) return;
    commitEntry({ annotations, measurements: [] });
  }, [annotations, commitEntry, measurements.length]);

  const clearAll = useCallback(() => {
    if (annotations.length === 0 && measurements.length === 0) return;
    commitEntry({ annotations: [], measurements: [] });
    setSelectedId(null);
  }, [annotations.length, commitEntry, measurements.length]);

  const fitToScreen = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const rotate90 = useCallback(() => {
    setRotation((current) => (current === 0 ? 90 : current === 90 ? 180 : current === 180 ? 270 : 0));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const card = viewerCardRef.current;
    if (!card) return;
    try {
      if (document.fullscreenElement) {
        if (document.fullscreenElement === card) await document.exitFullscreen();
      } else if (card.requestFullscreen) {
        await card.requestFullscreen();
      }
    } catch {
      setNotice("Fullscreen is not available in this browser.");
    }
  }, []);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement === viewerCardRef.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    fetch("/api/imaging/analyze", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { configured?: Record<RecognitionProvider, boolean> } | null) => {
        if (data?.configured?.gemini || data?.configured?.openai) {
          setProviderStatus("ready");
        } else {
          setProviderStatus("unavailable");
        }
      })
      .catch(() => setProviderStatus("unavailable"));
  }, []);

  useEffect(() => {
    const handleResize = () => setBreakpoint(getBreakpoint(window.innerWidth));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  const toggleFinding = (id: string) => {
    setCheckedFindings((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBosniak = (id: string) => {
    setBosniakSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const loadFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.size > MAX_LOCAL_FILE_BYTES) {
      setNotice("Choose an image smaller than 25 MB. Local review never uploads the file.");
      return;
    }
    if (!ACCEPTED.has(candidate.type)) {
      setNotice("This workspace reads exported PNG, JPEG, and WebP files. A DICOM study requires a dedicated DICOM viewer and workflow.");
      return;
    }

    setNotice(candidate.size > MAX_ANALYSIS_FILE_BYTES ? "Local review is ready. Provider review is limited to images smaller than 4 MB." : null);
    setFile(candidate);
    setReport(null);
    setAnalysisError(null);
    setAnalysisStage("idle");
    setChatMessages([]);
    setChatInput("");
    setChatStatus("idle");
    setChatError(null);
    setFindingStates({});
    setEditingIndex(null);
    setEditText("");
    setGeneratedReport(null);
    setGenerateError(null);
    setCopyFeedback(null);
    resetView();
    setQuality(null);
    setHistory([{ annotations: [], measurements: [] }]);
    setHistoryIndex(0);
    setSelectedId(null);
    setDraft(null);
    setAngleDraft([]);
    setAnglePreview(null);
    setPendingText(null);
    setTextInputPos(null);
    setDragMove(null);
    setMovingShape(null);
    setSourceUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(candidate);
    });
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setImageDataUrl(null);
    reader.readAsDataURL(candidate);
  }, [resetView]);

  useEffect(() => {
    if (!sourceUrl || !file) {
      imageRef.current = null;
      setInfo(null);
      setQuality(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      try {
        const stats = extractImageStats(image);
        setInfo({ width: image.naturalWidth, height: image.naturalHeight, luminance: Math.round(stats.meanLuminance), source: file.name });
        setQuality(scoreFromStats(stats));
      } catch {
        setInfo({ width: image.naturalWidth, height: image.naturalHeight, luminance: 0, source: file.name });
        setQuality(null);
        setNotice("Technical quality metrics are unavailable for this image.");
      }
    };
    image.onerror = () => {
      setNotice("The browser could not decode this file. Try an exported PNG or JPEG.");
      imageRef.current = null;
      setInfo(null);
      setQuality(null);
    };
    image.src = sourceUrl;
  }, [file, sourceUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    void info; // referenced so this callback re-runs (redraws) when a new image decodes
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.scale(ratio, ratio);
    context.fillStyle = "#131518";
    context.fillRect(0, 0, bounds.width, bounds.height);
    if (!image) { context.restore(); return; }
    const placement = computeImagePlacement(bounds, image, zoom, pan, rotation);
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const radians = (rotation * Math.PI) / 180;
    context.translate(centerX, centerY);
    context.rotate(radians);
    context.translate(-centerX, -centerY);
    context.filter = `brightness(${brightness}%) contrast(${contrast}%)${invert ? " invert(1)" : ""}`;
    context.drawImage(image, placement.x, placement.y, placement.renderedWidth, placement.renderedHeight);
    context.filter = "none";
    if (grid) {
      context.save();
      context.beginPath();
      context.rect(placement.x, placement.y, placement.renderedWidth, placement.renderedHeight);
      context.clip();
      context.strokeStyle = "rgba(255,255,255,0.26)";
      context.lineWidth = 1;
      for (let index = 1; index < 8; index += 1) {
        const horizontal = placement.y + (placement.renderedHeight / 8) * index;
        const vertical = placement.x + (placement.renderedWidth / 8) * index;
        context.beginPath(); context.moveTo(placement.x, horizontal); context.lineTo(placement.x + placement.renderedWidth, horizontal); context.stroke();
        context.beginPath(); context.moveTo(vertical, placement.y); context.lineTo(vertical, placement.y + placement.renderedHeight); context.stroke();
      }
      context.restore();
    }
    context.restore();
    // `info` is a dep only to trigger a redraw when a new image finishes decoding.
  }, [brightness, contrast, grid, info, invert, pan, rotation, zoom]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    void info; // referenced so this callback re-runs (redraws) when a new image decodes
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.scale(ratio, ratio);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    if (!image) { context.restore(); return; }
    const placement = computeImagePlacement(bounds, image, zoom, pan, rotation);
    const corners = [
      imageToScreen(placement, 0, 0),
      imageToScreen(placement, 1, 0),
      imageToScreen(placement, 1, 1),
      imageToScreen(placement, 0, 1),
    ];
    context.save();
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (const corner of corners.slice(1)) context.lineTo(corner.x, corner.y);
    context.closePath();
    context.clip();
    drawMeasurements(context, placement, measurements, image.naturalWidth, image.naturalHeight);
    drawAnnotationShapes(context, placement, annotations, selectedId);
    drawAngleDraft(context, placement, angleDraft, anglePreview, image.naturalWidth, image.naturalHeight);
    if (draft) drawDraft(context, placement, draft, image.naturalWidth, image.naturalHeight, accentColor());
    if (movingShape) drawAnnotationShapes(context, placement, [movingShape], selectedId);
    context.restore();
    context.restore();
    // `info` is a dep only to trigger a redraw when a new image finishes decoding.
  }, [angleDraft, anglePreview, annotations, draft, info, measurements, movingShape, pan, rotation, selectedId, zoom]);

  useEffect(() => {
    draw();
    drawOverlay();
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => { draw(); drawOverlay(); });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [draw, drawOverlay]);

  const renderPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const bounds = canvas.getBoundingClientRect();
    const placement = computeImagePlacement(bounds, image, zoom, pan, rotation);
    const relative = screenToImage(placement, clientX - bounds.left, clientY - bounds.top);
    if (!relative) { setSample(null); return; }
    const imageX = Math.floor(relative.x * image.naturalWidth);
    const imageY = Math.floor(relative.y * image.naturalHeight);
    if (imageX < 0 || imageY < 0 || imageX >= image.naturalWidth || imageY >= image.naturalHeight) { setSample(null); return; }
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 1; sampleCanvas.height = 1;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, imageX, imageY, 1, 1, 0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    setSample({ x: imageX, y: imageY, value: `${Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue)} / 255` });
  }, [pan, rotation, zoom]);

  const commitDraft = useCallback(() => {
    if (!draft) return;
    if (draft.kind === "freehand") {
      if (draft.points.length >= 2) {
        commitEntry({ annotations: [...annotations, { id: createShapeId(), kind: "freehand", points: draft.points, color: accentColor() }], measurements });
      }
      return;
    }
    if (draft.kind === "distance") {
      const px = distancePixels(draft.start, draft.current, info?.width ?? 1, info?.height ?? 1);
      if (px >= 1) {
        commitEntry({ annotations, measurements: [...measurements, { id: createShapeId(), kind: "distance", start: draft.start, end: draft.current }] });
      }
      return;
    }
    if (draft.kind === "area") {
      const px = rectAreaPixels(draft.start, draft.current, info?.width ?? 1, info?.height ?? 1);
      if (px >= 1) {
        commitEntry({ annotations, measurements: [...measurements, { id: createShapeId(), kind: "area", corner: draft.start, opposite: draft.current }] });
      }
      return;
    }
    const start = draft.start;
    const current = draft.current;
    if (Math.abs(current.x - start.x) + Math.abs(current.y - start.y) < 0.002) return;
    if (draft.kind === "arrow") {
      commitEntry({ annotations: [...annotations, { id: createShapeId(), kind: "arrow", start: { x: start.x, y: start.y }, end: { x: current.x, y: current.y }, color: accentColor() }], measurements });
      return;
    }
    if (draft.kind === "rect") {
      commitEntry({
        annotations: [...annotations, {
          id: createShapeId(),
          kind: "rect",
          start: { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y) },
          end: { x: Math.max(start.x, current.x), y: Math.max(start.y, current.y) },
          color: accentColor(),
        }],
        measurements,
      });
      return;
    }
    if (draft.kind === "circle") {
      commitEntry({
        annotations: [...annotations, {
          id: createShapeId(),
          kind: "circle",
          center: { x: (start.x + current.x) / 2, y: (start.y + current.y) / 2 },
          radiusX: Math.abs(current.x - start.x) / 2,
          radiusY: Math.abs(current.y - start.y) / 2,
          color: accentColor(),
        }],
        measurements,
      });
    }
  }, [annotations, commitEntry, draft, info?.height, info?.width, measurements]);

  const commitText = useCallback(() => {
    if (pendingText && pendingText.value.trim()) {
      commitEntry({ annotations: [...annotations, { id: createShapeId(), kind: "text", point: pendingText.point, text: pendingText.value.trim(), color: accentColor() }], measurements });
    }
    setPendingText(null);
    setTextInputPos(null);
  }, [annotations, commitEntry, measurements, pendingText]);

  const cancelText = useCallback(() => {
    setPendingText(null);
    setTextInputPos(null);
  }, []);

  const changeTool = useCallback((tool: ActiveTool) => {
    setActiveTool(tool);
    setAngleDraft([]);
    setAnglePreview(null);
    if (pendingText) {
      if (pendingText.value.trim()) commitText();
      else cancelText();
    }
  }, [cancelText, commitText, pendingText]);

  const finalizeGestures = useCallback(() => {
    if (dragMove) {
      if (movingShape) commitEntry({ annotations: annotations.map((shape) => shape.id === dragMove.id ? movingShape : shape), measurements });
      setDragMove(null);
      setMovingShape(null);
      return;
    }
    if (draft) {
      commitDraft();
      setDraft(null);
    }
  }, [annotations, commitDraft, commitEntry, dragMove, draft, measurements, movingShape]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const placement = computeImagePlacement(canvas.getBoundingClientRect(), image, zoom, pan, rotation);
    const bounds = canvas.getBoundingClientRect();
    const local = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const imgPoint = screenToImage(placement, local.x, local.y);

    if (activeTool === "pan") {
      setDragOrigin({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
      return;
    }
    if (!imgPoint) return;
    switch (activeTool) {
      case "select": {
        const hit = hitTestAnnotations(placement, annotations, local.x, local.y, 10);
        if (hit) {
          setSelectedId(hit.id);
          setDragMove({ id: hit.id, start: imgPoint, shape: hit });
        } else {
          setSelectedId(null);
        }
        return;
      }
      case "arrow":
      case "rect":
        setDraft({ kind: activeTool, start: imgPoint, current: imgPoint });
        return;
      case "circle":
        setDraft({ kind: "circle", start: imgPoint, current: imgPoint });
        return;
      case "freehand":
        setDraft({ kind: "freehand", points: [imgPoint] });
        return;
      case "text":
        setSelectedId(null);
        setPendingText({ point: imgPoint, value: "" });
        setTextInputPos({ x: Math.max(4, Math.min(local.x, bounds.width - 172)), y: Math.max(4, local.y - 32) });
        return;
      case "distance":
        setDraft({ kind: "distance", start: imgPoint, current: imgPoint });
        return;
      case "angle": {
        const next = [...angleDraft, imgPoint];
        if (next.length >= 3) {
          commitEntry({ annotations, measurements: [...measurements, { id: createShapeId(), kind: "angle", first: next[0], vertex: next[1], last: next[2] }] });
          setAngleDraft([]);
          setAnglePreview(null);
        } else {
          setAngleDraft(next);
        }
        return;
      }
      case "area":
        setDraft({ kind: "area", start: imgPoint, current: imgPoint });
        return;
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (dragOrigin) {
      setPan({ x: dragOrigin.panX + event.clientX - dragOrigin.x, y: dragOrigin.panY + event.clientY - dragOrigin.y });
      return;
    }
    if (!canvas || !image) return;
    const bounds = canvas.getBoundingClientRect();
    const placement = computeImagePlacement(bounds, image, zoom, pan, rotation);
    if (dragMove) {
      const imgPoint = screenToImage(placement, event.clientX - bounds.left, event.clientY - bounds.top);
      if (!imgPoint) return;
      const dx = imgPoint.x - dragMove.start.x;
      const dy = imgPoint.y - dragMove.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.0005) setMovingShape(moveShape(dragMove.shape, dx, dy));
      return;
    }
    if (draft) {
      const imgPoint = screenToImage(placement, event.clientX - bounds.left, event.clientY - bounds.top);
      if (!imgPoint) return;
      if (draft.kind === "freehand") {
        const points = [...draft.points, imgPoint];
        setDraft({ kind: "freehand", points: points.length > 4000 ? draft.points : points });
      } else {
        setDraft({ ...draft, current: imgPoint });
      }
      return;
    }
    if (activeTool === "angle" && angleDraft.length > 0) {
      const imgPoint = screenToImage(placement, event.clientX - bounds.left, event.clientY - bounds.top);
      setAnglePreview(imgPoint);
      return;
    }
    renderPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragOrigin) {
      setDragOrigin(null);
      renderPointer(event.clientX, event.clientY);
      return;
    }
    finalizeGestures();
    renderPointer(event.clientX, event.clientY);
  };

  const handlePointerCancel = () => {
    if (dragOrigin) setDragOrigin(null);
    finalizeGestures();
    setSample(null);
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (!selectedId) return;
      event.preventDefault();
      deleteSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, selectedId]);

  const requestAnalysis = async () => {
    if (!imageDataUrl || !file) { setAnalysisError("Choose an exported image first."); return; }
    if (!deidentifiedConfirmed) { setAnalysisError("Confirm that the image is de-identified before sending it to a provider."); return; }
    if (file.size > MAX_ANALYSIS_FILE_BYTES) { setAnalysisError("Provider review is limited to images smaller than 4 MB. You can still use local review tools."); return; }
    setAnalysisStage("uploading");
    setAnalysisError(null);
    setReport(null);
    setFindingStates({});
    setEditingIndex(null);
    setGeneratedReport(null);
    try {
      const response = await fetch("/api/imaging/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ modality, imageDataUrl, clinicalQuestion, deidentifiedConfirmed }),
      });
      // Headers arrived: the image has been uploaded. The provider is now processing.
      setAnalysisStage("waiting");
      const data = await response.json() as { report?: RecognitionReport; error?: string; code?: string };
      if (!response.ok || !data.report) throw new Error(routeErrorMessage(response.status, data, "Analysis failed. Please try again."));
      setReport(data.report);
      setAnalysisStage("done");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The analysis could not be completed.");
      setAnalysisStage("error");
    }
  };

  const sendChatQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || chatStatus === "waiting") return;
    if (!imageDataUrl) { setChatStatus("error"); setChatError("Choose an image before asking a question."); return; }
    if (!deidentifiedConfirmed) { setChatStatus("error"); setChatError("Confirm the de-identification checkbox before sending the image."); return; }
    setChatMessages((current) => [...current, { role: "user", text: question }]);
    setChatInput("");
    setChatStatus("waiting");
    setChatError(null);
    try {
      const response = await fetch("/api/imaging/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          imageDataUrl,
          modality,
          question,
          deidentifiedConfirmed: true,
          priorReport: report ?? undefined,
        }),
      });
      const data = await response.json() as { answer?: string; provider?: RecognitionProvider; model?: string; error?: string; code?: string };
      const answer = data.answer;
      if (!response.ok || typeof answer !== "string") throw new Error(routeErrorMessage(response.status, data, "The provider did not return an answer. Please try again."));
      const meta = data.provider && data.model ? `${providerLabel[data.provider]} · ${data.model}` : undefined;
      setChatMessages((current) => [...current, { role: "assistant", text: answer, meta }]);
      setChatStatus("idle");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "The question could not be answered.");
      setChatStatus("error");
    }
  };

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chatMessages, chatStatus]);

  const setFindingStatus = (index: number, status: FindingStatus, text: string) => {
    setFindingStates((current) => ({ ...current, [index]: { status, text } }));
  };

  const startEditingFinding = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditText(currentText);
  };

  const saveEditedFinding = (index: number) => {
    const trimmed = editText.trim();
    if (trimmed) setFindingStatus(index, "edited", trimmed);
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEditingFinding = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const findingStatesForReport = useMemo(() => {
    if (!report) return undefined;
    const states: ReportFindingState[] = [];
    report.observedVisualFeatures.forEach((feature, index) => {
      const state = findingStates[index];
      if (state && state.status === "edited") states.push({ text: feature, status: "edited", editedText: state.text });
      else if (state && state.status !== "pending") states.push({ text: feature, status: state.status });
      else states.push({ text: feature, status: "pending" });
    });
    return states.length > 0 ? states : undefined;
  }, [findingStates, report]);

  const checklistSelections = useMemo(() => {
    if (checkedFindings.size === 0) return undefined;
    const items: string[] = [];
    for (const item of MODALITY_CHECKLISTS[modality] ?? []) {
      if (checkedFindings.has(`f-${item}`)) items.push(item);
    }
    return items.length > 0 ? items : undefined;
  }, [checkedFindings, modality]);

  const naturalWidth = info?.width ?? 1;
  const naturalHeight = info?.height ?? 1;

  const measurementsForReport = useMemo(() => {
    if (measurements.length === 0) return undefined;
    const entries: ReportMeasurementEntry[] = measurements.map((measurement) => {
      if (measurement.kind === "distance") {
        return { label: "Distance", value: formatPixelLength(distancePixels(measurement.start, measurement.end, naturalWidth, naturalHeight)) };
      }
      if (measurement.kind === "angle") {
        return { label: "Angle", value: formatAngleDegrees(angleDegrees(measurement.first, measurement.vertex, measurement.last, naturalWidth, naturalHeight)) };
      }
      return { label: "Area (ROI)", value: formatPixelArea(rectAreaPixels(measurement.corner, measurement.opposite, naturalWidth, naturalHeight)) };
    });
    return entries;
  }, [measurements, naturalHeight, naturalWidth]);

  const canGenerateReport = Boolean(report) || checkedFindings.size > 0 || measurements.length > 0 || annotations.length > 0;

  const generateReviewReport = () => {
    setGenerateError(null);
    try {
      const output = buildReviewReport({
        modality,
        generatedAt: new Date(),
        fileName: file?.name,
        imageInfo: info ? { width: info.width, height: info.height, sizeBytes: file?.size } : undefined,
        quality,
        report,
        findingStates: findingStatesForReport,
        checklistSelections,
        measurements: measurementsForReport,
      });
      setGeneratedReport(output);
      setCopyFeedback(null);
      window.setTimeout(() => document.getElementById("generated-review-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) {
      setGeneratedReport(null);
      setGenerateError(error instanceof Error ? error.message : "The review report could not be generated.");
    }
  };

  const copyGeneratedReport = async () => {
    if (!generatedReport) return;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(generatedReport);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }
    window.setTimeout(() => setCopyFeedback(null), 2200);
  };

  const downloadGeneratedReport = () => {
    if (!generatedReport) return;
    const blob = new Blob([generatedReport], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nephro-imaging-review-report.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const imagePropertyLabel = useMemo(() => info ? `${info.width.toLocaleString()} × ${info.height.toLocaleString()} px` : "Waiting for a local image", [info]);
  const analysisBlocked = !imageDataUrl || !deidentifiedConfirmed || file?.size && file.size > MAX_ANALYSIS_FILE_BYTES || providerStatus === "unavailable" || analysisStage === "uploading" || analysisStage === "waiting";
  const analysisInFlight = analysisStage === "uploading" || analysisStage === "waiting";
  const canChat = Boolean(imageDataUrl && deidentifiedConfirmed);

  const isPhone = breakpoint === "phone";
  const isTablet = breakpoint === "tablet";
  const isMobile = isPhone || isTablet;
  const pagePad = isPhone ? "1.25rem" : isTablet ? "2rem" : "2rem";
  const h1Size = isPhone ? "28px" : isTablet ? "38px" : "48px";
  const cardRadius = "calc(var(--radius-base) + 4px)";
  const controlRadius = "calc(var(--radius-base) - 6px)";

  const accent = "var(--accent)";
  const accentMuted = (alpha: number) => `color-mix(in oklab, var(--accent) ${alpha}%, transparent)`;

  const hasAnnotations = annotations.length > 0;
  const hasMeasurements = measurements.length > 0;

  return (
    <>
      <div className="no-print" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)" }}>
      {/* Header Section */}
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad} ${pagePad} 0` }}>
        <div style={{ marginBottom: isMobile ? "2rem" : "3rem" }}>
          <h6 style={{ color: accent, fontSize: "12px", fontWeight: "600", letterSpacing: "0.2em", marginBottom: "0.5rem", textTransform: "uppercase" }}>Imaging review workspace</h6>
          <h1 style={{ fontSize: h1Size, fontWeight: "bold", marginBottom: "1.5rem", maxWidth: "640px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>Real visual review, not simulated diagnosis.</h1>
          <p style={{ fontSize: "15px", opacity: 0.85, maxWidth: "600px", lineHeight: 1.6, marginBottom: isMobile ? "1.5rem" : "2rem" }}>
            Review exported, de-identified medical images locally, then optionally request an <strong>AI-assisted visual review</strong> from a configured OpenAI or Gemini provider. The report preserves uncertainty and never substitutes for clinical interpretation.
          </p>
        </div>

        {/* Clinical Boundary Warning */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", borderRadius: cardRadius, backgroundColor: accentMuted(8), padding: "1.5rem", marginBottom: isMobile ? "2rem" : "3rem" }}>
          <span style={{ color: accent, flexShrink: 0, marginTop: "2px" }}><Icon name="warning" className="size-5" /></span>
          <div>
            <strong style={{ fontSize: "13px", color: accent }}>Clinical boundary.</strong>
            <span style={{ fontSize: "13px", opacity: 0.85, display: "block", marginTop: "0.25rem" }}>Do not upload identifiable patient images. This is not a medical device, radiology report, or treatment recommendation.</span>
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `0 ${pagePad} ${pagePad}`, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1.5rem" : "2rem", alignItems: "start" }}>

        {/* Image Viewer Card */}
        <div
          ref={viewerCardRef}
          style={{
            borderRadius: cardRadius,
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            overflow: "hidden",
            boxShadow: isDraggingFile ? "0 0 0 2px var(--accent)" : "var(--shadow-card)",
            transition: "box-shadow 140ms ease, border-color 140ms ease",
            ...(isFullscreen ? { height: "100vh", display: "flex", flexDirection: "column" } : {}),
          }}
          onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDraggingFile(false); }}
          onDrop={handleFileDrop}
          onDragEnd={() => setIsDraggingFile(false)}
        >
          {/* Viewer Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-raised)", padding: "1rem", flexShrink: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: "600", margin: 0, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file?.name ?? "No image selected"}</p>
              <p style={{ fontSize: "12px", opacity: 0.6, margin: "0.5rem 0 0", fontFamily: "var(--font-mono)" }}>
                {file ? `${formatBytes(file.size)} · ${imagePropertyLabel}` : "PNG · JPEG · WebP · up to 25 MB"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button type="button" onClick={() => setZoom((value) => Math.min(3, +(value + 0.2).toFixed(1)))} style={{ width: "32px", height: "32px", padding: "0", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", transition: "background-color 140ms ease, border-color 140ms ease" }} className="pressable" aria-label="Zoom in"><Icon name="zoomIn" className="size-4" /></button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.2).toFixed(1)))} style={{ width: "32px", height: "32px", padding: "0", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", transition: "background-color 140ms ease, border-color 140ms ease" }} className="pressable" aria-label="Zoom out"><Icon name="zoomOut" className="size-4" /></button>
              <button type="button" onClick={resetView} style={{ width: "32px", height: "32px", padding: "0", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", transition: "background-color 140ms ease, border-color 140ms ease" }} className="pressable" aria-label="Reset view"><Icon name="reset" className="size-4" /></button>
            </div>
          </div>

          {/* Viewer tools */}
          <div style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.25rem", alignItems: "center" }}>
              <ToolGroup label="View">
                <ToolButton icon="pan" label="Pan (drag to move the image)" onClick={() => changeTool("pan")} active={activeTool === "pan"} />
                <ToolButton icon="fit" label="Fit image to screen" onClick={fitToScreen} />
                <ToolButton icon="rotate" label="Rotate 90°" onClick={rotate90} />
                <ToolButton icon={isFullscreen ? "minimize" : "fullscreen"} label="Toggle fullscreen" onClick={toggleFullscreen} active={isFullscreen} />
              </ToolGroup>
              <ToolGroup label="Annotate">
                <ToolButton icon="cursor" label="Select / move shapes" onClick={() => changeTool("select")} active={activeTool === "select"} />
                <ToolButton icon="arrowLine" label="Arrow" onClick={() => changeTool("arrow")} active={activeTool === "arrow"} />
                <ToolButton icon="circle" label="Circle" onClick={() => changeTool("circle")} active={activeTool === "circle"} />
                <ToolButton icon="rect" label="Rectangle" onClick={() => changeTool("rect")} active={activeTool === "rect"} />
                <ToolButton icon="pen" label="Freehand line" onClick={() => changeTool("freehand")} active={activeTool === "freehand"} />
                <ToolButton icon="text" label="Text label" onClick={() => changeTool("text")} active={activeTool === "text"} />
                <ToolButton icon="undo" label="Undo" onClick={undo} disabled={historyIndex === 0} />
                <ToolButton icon="redo" label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1} />
                <ToolButton icon="trash" label="Delete selected annotation" onClick={deleteSelected} disabled={!selectedId} />
                <ToolButton icon="eraser" label="Clear all annotations" onClick={clearAnnotations} disabled={!hasAnnotations} />
              </ToolGroup>
              <ToolGroup label="Measure">
                <ToolButton icon="ruler" label="Distance (pixels)" onClick={() => changeTool("distance")} active={activeTool === "distance"} />
                <ToolButton icon="angle" label="Angle (degrees)" onClick={() => changeTool("angle")} active={activeTool === "angle"} />
                <ToolButton icon="area" label="Rectangular ROI area (pixels)" onClick={() => changeTool("area")} active={activeTool === "area"} />
                <ToolButton icon="x" label="Clear all measurements" onClick={clearMeasurements} disabled={!hasMeasurements} />
              </ToolGroup>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <p style={{ fontSize: "11px", margin: 0, opacity: 0.6 }}>{TOOL_HINTS[activeTool]}</p>
              {hasAnnotations && (
                <button type="button" onClick={clearAll} className="pressable" style={{ fontSize: "11px", padding: "0.25rem 0.6rem", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, color: "var(--text)", cursor: "pointer", opacity: 0.8 }}>Clear all annotations &amp; measurements</button>
              )}
            </div>
          </div>

          {/* Canvas */}
          <div ref={canvasWrapperRef} style={{ position: "relative", backgroundColor: "#131518", padding: "1rem", aspectRatio: isFullscreen ? "auto" : "4/3", flex: isFullscreen ? "1 1 auto" : undefined, minHeight: isFullscreen ? 0 : undefined }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", borderRadius: "calc(var(--radius-base) - 4px)", display: "block", touchAction: "none", cursor: CURSOR_FOR_TOOL[activeTool] }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onPointerLeave={() => { if (!dragOrigin && !draft) setSample(null); if (!draft) setAnglePreview(null); }} aria-label="Image viewer. Drag to pan; move pointer for pixel intensity." />
            <canvas ref={overlayRef} style={{ position: "absolute", inset: "1rem", borderRadius: "calc(var(--radius-base) - 4px)", pointerEvents: "none" }} aria-hidden="true" />
            {pendingText && textInputPos && (
              <input
                autoFocus
                value={pendingText.value}
                onChange={(event) => setPendingText((current) => current ? { ...current, value: event.target.value } : current)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); commitText(); }
                  if (event.key === "Escape") { event.preventDefault(); cancelText(); }
                }}
                onBlur={commitText}
                placeholder="Label text, then Enter ↵"
                maxLength={120}
                aria-label="Annotation text"
                style={{ position: "absolute", left: textInputPos.x, top: textInputPos.y, width: "160px", padding: "0.35rem 0.5rem", borderRadius: controlRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface-raised)", color: "var(--text)", fontSize: "12px", fontFamily: "var(--font-mono)", zIndex: 2 }}
              />
            )}
            {!sourceUrl && (
              <div style={{ position: "absolute", inset: "1rem", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                  <div style={{ width: "48px", height: "48px", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "rgba(255,255,255,0.8)" }}><Icon name="upload" className="size-5" /></span>
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "0.5rem" }}>
                    {isDraggingFile ? "Drop the image to review" : "Choose a de-identified image"}
                  </p>
                  <p style={{ fontSize: "12px", opacity: 0.7 }}>Local tools run in your browser; provider review is opt-in. Drag &amp; drop works too.</p>
                </div>
              </div>
            )}
          </div>

          {/* Measurement readout */}
          {hasMeasurements && (
            <div style={{ padding: "0.5rem 1rem", backgroundColor: "var(--surface-inset)", fontSize: "11px", fontFamily: "var(--font-mono)", display: "flex", flexWrap: "wrap", gap: "0.5rem 1.25rem", alignItems: "center", flexShrink: 0 }}>
              <span style={{ opacity: 0.6 }}>Measurements — pixels only, no calibration data:</span>
              {measurements.map((measurement) => (
                <span key={measurement.id} style={{ color: MEASURE_COLORS[measurement.kind] }}>{measurementSummary(measurement, naturalWidth, naturalHeight)}</span>
              ))}
            </div>
          )}

          {/* Footer with controls */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "1rem", backgroundColor: "var(--surface)", display: "flex", flexDirection: isPhone ? "column" : "row", gap: "1rem", alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between", flexShrink: 0 }}>
            <p style={{ fontSize: "11px", fontFamily: "var(--font-mono)", opacity: 0.6, margin: 0 }}>
              {sample ? `x ${sample.x} · y ${sample.y} · luminance ${sample.value}` : "Hover for pixel intensity"}
            </p>
            <button type="button" onClick={() => inputRef.current?.click()} className="pressable" style={{ padding: "0.5rem 1rem", backgroundColor: accent, color: "var(--accent-fg)", border: "none", borderRadius: controlRadius, fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", minWidth: "140px", transition: "background-color 140ms ease" }}>
              <Icon name="upload" className="size-4" />{file ? "Replace" : "Choose image"}
            </button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0])} style={{ display: "none" }} />
          </div>
        </div>

        {/* Settings Card */}
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: isPhone ? "1.5rem" : "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", boxShadow: "var(--shadow-card)" }}>
          <div>
            <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 1rem" }}>Local controls</h6>

            {/* Brightness */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "0.5rem" }}>
                <span>Brightness</span>
                <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)" }}>{brightness}%</span>
              </div>
              <input type="range" aria-label="Brightness" min="20" max="200" value={brightness} onChange={(event) => setBrightness(+event.target.value)} style={{ width: "100%", background: `linear-gradient(to right, ${accent} ${(brightness - 20) / 1.8}%, var(--border) ${(brightness - 20) / 1.8}%)` }} />
            </div>

            {/* Contrast */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "0.5rem" }}>
                <span>Contrast</span>
                <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)" }}>{contrast}%</span>
              </div>
              <input type="range" aria-label="Contrast" min="20" max="200" value={contrast} onChange={(event) => setContrast(+event.target.value)} style={{ width: "100%", background: `linear-gradient(to right, ${accent} ${(contrast - 20) / 1.8}%, var(--border) ${(contrast - 20) / 1.8}%)` }} />
            </div>

            {/* Toggles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button type="button" onClick={() => setInvert((value) => !value)} className="pressable" style={{ padding: "0.5rem", backgroundColor: invert ? accent : "transparent", color: invert ? "var(--accent-fg)" : "var(--text)", border: `1px solid ${invert ? accent : "var(--border)"}`, borderRadius: controlRadius, fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease" }}>
                <Icon name="invert" className="size-4" />Invert
              </button>
              <button type="button" onClick={() => setGrid((value) => !value)} className="pressable" style={{ padding: "0.5rem", backgroundColor: grid ? accent : "transparent", color: grid ? "var(--accent-fg)" : "var(--text)", border: `1px solid ${grid ? accent : "var(--border)"}`, borderRadius: controlRadius, fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease" }}>
                <Icon name="grid" className="size-4" />Grid
              </button>
            </div>
          </div>

          {/* File Facts */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
            <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 1rem" }}>Local file facts</h6>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1rem", fontSize: "12px", margin: 0 }}>
              <div><dt style={{ opacity: 0.6 }}>Dimensions</dt><dd style={{ fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "0.25rem" }}>{info ? imagePropertyLabel : "—"}</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Mean luminance</dt><dd style={{ fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "0.25rem" }}>{info ? `${info.luminance} / 255` : "—"}</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Modality</dt><dd style={{ fontSize: "11px", marginTop: "0.25rem" }}>{modalityLabel[modality]}</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Processing state</dt><dd style={{ fontSize: "11px", marginTop: "0.25rem" }}>{providerStatus === "ready" ? "Local + provider review" : providerStatus === "checking" ? "Checking providers" : "Local only"}</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Storage</dt><dd style={{ fontSize: "11px", marginTop: "0.25rem" }}>This browser</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Format</dt><dd style={{ fontSize: "11px", marginTop: "0.25rem" }}>{file?.type || "—"}</dd></div>
            </dl>
          </div>

          {/* Technical image quality */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
            <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 1rem" }}>Technical image quality</h6>
            {quality ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Quality score</span>
                  <span style={{ fontSize: "22px", fontWeight: "700", color: accent, fontFamily: "var(--font-mono)" }}>{quality.score}<span style={{ fontSize: "12px", opacity: 0.6 }}>/100</span></span>
                </div>
                {QUALITY_SUBSCORES.map((sub) => (
                  <div key={sub.key} style={{ marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "0.25rem" }}>
                      <span style={{ opacity: 0.75 }}>{sub.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", opacity: 0.6 }}>{quality[sub.key]}/100</span>
                    </div>
                    <div style={{ height: "4px", borderRadius: "999px", backgroundColor: "var(--surface-inset)" }}>
                      <div style={{ height: "100%", width: `${quality[sub.key]}%`, borderRadius: "999px", backgroundColor: accent, transition: "width 200ms ease" }} />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: "12px", opacity: 0.7, margin: 0 }}>Load an image to compute local technical metrics.</p>
            )}
            <p style={{ fontSize: "11px", opacity: 0.6, lineHeight: 1.5, margin: "0.75rem 0 0" }}>
              Technical image-quality metrics — not clinical measurements. Computed locally from pixel statistics.
            </p>
          </div>
        </div>
      </section>

      {/* AI Review Section */}
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad}`, marginTop: isMobile ? "2rem" : "3rem", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1.5rem" : "2rem", alignItems: "start" }}>

        {/* AI Review Card */}
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: isMobile ? "1.5rem" : "2rem", boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0" }}>AI-assisted visual review</h6>
              <h2 style={{ fontSize: "22px", fontWeight: "bold", marginTop: "0.75rem", marginBottom: "0", letterSpacing: "-0.02em" }}>Powered analysis, not faked diagnosis.</h2>
            </div>
            <span style={{ display: "inline-block", backgroundColor: providerStatus === "ready" ? accentMuted(10) : "rgba(245, 158, 11, 0.1)", color: providerStatus === "ready" ? accent : "#a16207", padding: "0.5rem 1rem", borderRadius: "999px", fontSize: "12px", fontWeight: "600", width: "fit-content" }}>
              {providerStatus === "ready" ? "Ready to analyze" : providerStatus === "checking" ? "Checking providers..." : "Providers unavailable"}
            </span>
          </div>

          {/* Modality Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "0.5rem" }} htmlFor="modality-select">Image modality</label>
            <select id="modality-select" value={modality} onChange={(event) => setModality(event.target.value as ImagingModality)} style={{ width: "100%", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: controlRadius, backgroundColor: "var(--surface-raised)", color: "var(--text)", fontSize: "13px", fontFamily: "inherit", cursor: "pointer", transition: "border-color 140ms ease" }}>
              {modalities.map((value) => <option value={value} key={value}>{modalityLabel[value]}</option>)}
            </select>
          </div>

          {/* Clinical Question */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "0.5rem" }} htmlFor="question">Optional question</label>
            <textarea id="question" value={clinicalQuestion} onChange={(event) => setClinicalQuestion(event.target.value)} maxLength={600} style={{ width: "100%", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: controlRadius, backgroundColor: "var(--surface-raised)", color: "var(--text)", fontSize: "13px", fontFamily: "inherit", minHeight: "80px", resize: "vertical", transition: "border-color 140ms ease" }} placeholder="e.g., Note any visible technical quality issues or anatomic boundaries..." />
          </div>

          {/* Consent Checkbox */}
          <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "1rem", backgroundColor: "var(--surface-inset)", borderRadius: controlRadius, fontSize: "12px", lineHeight: 1.5, marginBottom: "1.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={deidentifiedConfirmed} onChange={(event) => setDeidentifiedConfirmed(event.target.checked)} style={{ marginTop: "2px", cursor: "pointer", width: "16px", height: "16px", accentColor: accent }} />
            <span>I confirm this is a de-identified exported image and consent to send it to configured AI providers for visual review. The image is not permanently stored by Nephro.</span>
          </label>

          {/* Alerts */}
          {notice && <div role="status" style={{ padding: "0.75rem", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: controlRadius, fontSize: "12px", color: "#a16207", marginBottom: "1rem" }}>{notice}</div>}
          {analysisError && <div role="alert" style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: controlRadius, fontSize: "12px", color: "#dc2626", marginBottom: "1rem" }}>{analysisError}</div>}

          {/* Submit Button */}
          <button type="button" disabled={Boolean(analysisBlocked)} onClick={requestAnalysis} aria-busy={analysisInFlight} style={{ width: "100%", padding: "0.75rem", backgroundColor: analysisBlocked ? accentMuted(30) : accent, color: "var(--accent-fg)", border: "none", borderRadius: controlRadius, fontSize: "14px", fontWeight: "600", cursor: analysisBlocked ? "not-allowed" : "pointer", opacity: analysisBlocked ? 0.55 : 1, display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "center", transition: "background-color 160ms ease, opacity 160ms ease", minHeight: "46px" }}>
            {analysisInFlight ? (
              <>
                <KidneyLoader size={26} ariaLabel="Reviewing" />
                <span className="tabular-nums">{analysisStage === "uploading" ? "Uploading image…" : "Waiting for provider…"}</span>
              </>
            ) : (
              <>
                <Icon name="scan" className="size-4" />
                Request AI review
                <Icon name="arrow" className="size-4" />
              </>
            )}
          </button>
          <p style={{ fontSize: "11px", opacity: 0.6, marginTop: "0.75rem", margin: "0.75rem 0 0" }}>Submit only after confirming de-identification. Never use for emergency, diagnostic, or treatment decisions.</p>
        </div>

        {/* Info Card */}
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface-inset)", padding: isPhone ? "1.5rem" : "2rem" }}>
          <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 1rem" }}>Capabilities</h6>
          <p style={{ fontSize: "13px", opacity: 0.8, lineHeight: 1.6, marginBottom: "1.5rem" }}>
            The report can describe visible image characteristics, technical quality, and limitations. It cannot replace a radiologist, analyze full DICOM studies, or validate disease findings.
          </p>
          <a href="https://www.cancerimagingarchive.net/access-data/" target="_blank" rel="noreferrer" style={{ fontSize: "13px", fontWeight: "600", color: accent, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Explore de-identified teaching data <Icon name="arrow" className="size-4" />
          </a>
        </div>
      </section>

      {/* Ask about this image */}
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad}`, marginTop: isMobile ? "2rem" : "3rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: isMobile ? "1.5rem" : "2rem", boxShadow: "var(--shadow-card)" }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.5rem" }}>Ask about this image</h6>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>Questions answered against the loaded image.</h2>
            <p style={{ fontSize: "12px", opacity: 0.75, lineHeight: 1.6, margin: 0 }}>
              Sends the currently loaded image to the configured provider with your question, under the same de-identification consent as analysis. Answers are AI-assisted observations about the visible image only — not a diagnosis, radiology report, or treatment recommendation. Nothing is stored by Nephro.
            </p>
          </div>

          {/* Message list */}
          <div ref={chatListRef} style={{ maxHeight: "340px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem", backgroundColor: "var(--surface-inset)", borderRadius: controlRadius, marginBottom: "1rem" }} role="log" aria-live="polite">
            {chatMessages.length === 0 ? (
              <p style={{ fontSize: "12px", opacity: 0.65, margin: 0 }}>No questions yet. Try a suggested question or type your own.</p>
            ) : chatMessages.map((message, index) => (
              message.role === "user" ? (
                <div key={index} style={{ alignSelf: "flex-end", maxWidth: "85%", padding: "0.6rem 0.85rem", borderRadius: controlRadius, backgroundColor: accent, color: "var(--accent-fg)", fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{message.text}</div>
              ) : (
                <div key={index} style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
                  <div style={{ padding: "0.6rem 0.85rem", borderRadius: controlRadius, backgroundColor: "var(--surface-raised)", border: "1px solid var(--border)", fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{message.text}</div>
                  {message.meta && <p style={{ fontSize: "10px", fontFamily: "var(--font-mono)", opacity: 0.55, margin: "0.35rem 0 0" }}>{message.meta}</p>}
                </div>
              )
            ))}
            {chatStatus === "waiting" && (
              <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.85rem", borderRadius: controlRadius, backgroundColor: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <KidneyLoader size={18} ariaLabel="Answering" />
                <span style={{ fontSize: "12px", opacity: 0.7 }}>Waiting for the provider&apos;s answer…</span>
              </div>
            )}
          </div>

          {chatError && <div role="alert" style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: controlRadius, fontSize: "12px", color: "#dc2626", marginBottom: "0.75rem" }}>{chatError}</div>}

          {/* Suggested questions */}
          {chatStatus !== "waiting" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {SUGGESTED_QUESTIONS.map((question) => (
                <button key={question} type="button" onClick={() => sendChatQuestion(question)} disabled={!canChat} className="pressable" style={{ padding: "0.35rem 0.7rem", fontSize: "11px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "999px", cursor: canChat ? "pointer" : "not-allowed", opacity: canChat ? 0.9 : 0.45, transition: "border-color 140ms ease, opacity 140ms ease" }}>{question}</button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendChatQuestion(chatInput); } }}
              placeholder="Ask about the visible image…"
              maxLength={600}
              disabled={chatStatus === "waiting" || !canChat}
              aria-label="Question about the image"
              style={{ flex: 1, minWidth: 0, padding: "0.7rem 0.85rem", border: "1px solid var(--border)", borderRadius: controlRadius, backgroundColor: "var(--surface-raised)", color: "var(--text)", fontSize: "13px", fontFamily: "inherit", transition: "border-color 140ms ease" }}
            />
            <button type="button" onClick={() => sendChatQuestion(chatInput)} disabled={chatStatus === "waiting" || !canChat || !chatInput.trim()} aria-label="Send question" className="pressable" style={{ padding: "0 1.1rem", backgroundColor: canChat ? accent : accentMuted(30), color: "var(--accent-fg)", border: "none", borderRadius: controlRadius, cursor: canChat && chatInput.trim() ? "pointer" : "not-allowed", opacity: canChat ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 140ms ease, opacity 140ms ease" }}>
              <Icon name="arrow" className="size-4" />
            </button>
          </div>
          {!deidentifiedConfirmed && imageDataUrl && (
            <p style={{ fontSize: "11px", opacity: 0.65, margin: "0.5rem 0 0" }}>Confirm the de-identification checkbox in the AI review card to enable questions.</p>
          )}
        </div>
      </section>

      {/* Structured review */}
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad}`, marginTop: isMobile ? "2rem" : "3rem", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "1.5rem" : "2rem", alignItems: "start" }}>
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: isMobile ? "1.5rem" : "2rem", boxShadow: "var(--shadow-card)" }}>
          <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.5rem" }}>Structured checklist</h6>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 0.75rem", letterSpacing: "-0.02em" }}>{modalityLabel[modality]}</h2>
          <p style={{ fontSize: "13px", opacity: 0.8, lineHeight: 1.6, marginBottom: "1.25rem" }}>
            What to look for in this modality. Check off what you observe — the list stays in your browser and never leaves it.
          </p>
          {(MODALITY_CHECKLISTS[modality] ?? []).map((item) => {
            const id = `f-${item}`;
            const checked = checkedFindings.has(id);
            return (
              <label key={id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.625rem 0.75rem", borderRadius: controlRadius, backgroundColor: checked ? accentMuted(6) : "transparent", fontSize: "13px", lineHeight: 1.5, cursor: "pointer", transition: "background-color 120ms ease" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleFinding(id)} style={{ marginTop: "3px", cursor: "pointer", width: "16px", height: "16px", accentColor: accent }} />
                <span style={checked ? { color: "var(--text)", textDecoration: "line-through", textDecorationColor: accentMuted(50), opacity: 0.75 } : { color: "var(--text)" }}>{item}</span>
              </label>
            );
          })}
          {checkedFindings.size > 0 && (
            <p style={{ fontSize: "11px", fontFamily: "var(--font-mono)", opacity: 0.6, margin: "0.75rem 0 0" }}>
              {checkedFindings.size} finding{checkedFindings.size === 1 ? "" : "s"} marked
            </p>
          )}
        </div>

        {(modality === "ct-kub" || modality === "ct-abdomen" || modality === "mri-brain" || modality === "other") ? (
          <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface-inset)", padding: isMobile ? "1.5rem" : "2rem" }}>
            <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.5rem" }}>Bosniak v2019 assist</h6>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 0.75rem", letterSpacing: "-0.02em" }}>Cystic renal mass</h2>
            <p style={{ fontSize: "13px", opacity: 0.8, lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Tick every feature that applies on CT/MRI. The strictest applicable class is suggested — educational aid only, never a diagnosis.
            </p>
            {BOSNIAK_FEATURES.map((feature) => {
              const checked = bosniakSelected.has(feature.id);
              return (
                <label key={feature.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.625rem 0.75rem", borderRadius: controlRadius, backgroundColor: checked ? accentMuted(6) : "transparent", fontSize: "13px", lineHeight: 1.5, cursor: "pointer", transition: "background-color 120ms ease" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleBosniak(feature.id)} style={{ marginTop: "3px", cursor: "pointer", width: "16px", height: "16px", accentColor: accent }} />
                  <span style={{ color: "var(--text)" }}>{feature.label}</span>
                </label>
              );
            })}
            {(() => {
              const result = bosniakClass(bosniakSelected);
              if (!result) return <p style={{ fontSize: "13px", opacity: 0.7, margin: "1rem 0 0" }}>Select features to see the suggested class.</p>;
              return (
                <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: controlRadius, border: "1px solid", borderColor: accentMuted(30), backgroundColor: accentMuted(5) }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: accent, margin: "0 0 0.25rem" }}>
                    Suggested class: Bosniak {result.klass}
                  </p>
                  <p style={{ fontSize: "12px", opacity: 0.8, lineHeight: 1.5, margin: 0 }}>{result.note}</p>
                </div>
              );
            })()}
            <p style={{ fontSize: "11px", opacity: 0.6, margin: "1rem 0 0", lineHeight: 1.5 }}>
              Bosniak MA et al. Radiology 2019;292:475–488. Malignancy likelihood rises steeply from IIF to IV; class is not a substitute for a radiologist&apos;s read.
            </p>
          </div>
        ) : null}
      </section>

      {/* Report Output */}
      {report && (
        <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad}`, marginTop: isMobile ? "2rem" : "3rem" }} aria-live="polite">
          <div style={{ borderRadius: cardRadius, border: "1px solid", borderColor: accentMuted(30), backgroundColor: accentMuted(4), padding: isMobile ? "1.5rem" : "2rem" }}>
            <div style={{ marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid", borderColor: accentMuted(20), display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ color: accent }}><Icon name="check" className="size-4" /></span>
                <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0" }}>Review complete</h6>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "bold", margin: "0.5rem 0 0", letterSpacing: "-0.02em" }}>Report output</h2>
            </div>

            {/* Structured findings review */}
            {report.observedVisualFeatures.length > 0 && (
              <div style={{ marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid", borderColor: accentMuted(20) }}>
                <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.5rem" }}>Structured findings review</h6>
                <p style={{ fontSize: "12px", opacity: 0.7, lineHeight: 1.6, margin: "0 0 1rem" }}>
                  Review each observation the AI listed. Your decisions feed the generated review report. The AI does not rate its own confidence, so features start as Not rated.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {report.observedVisualFeatures.map((feature, index) => {
                    const state = findingStates[index] ?? { status: "pending" as const, text: feature };
                    const isEditing = editingIndex === index;
                    return (
                      <div key={`${index}-${feature}`} style={{ borderRadius: controlRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: "0.75rem" }}>
                        {isEditing ? (
                          <>
                            <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={600} autoFocus aria-label={`Edit finding ${index + 1}`} style={{ width: "100%", minHeight: "64px", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: "calc(var(--radius-base) - 6px)", backgroundColor: "var(--surface-raised)", color: "var(--text)", fontSize: "13px", fontFamily: "inherit", resize: "vertical" }} />
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                              <MiniButton label="Save" onClick={() => saveEditedFinding(index)} tone="accent" />
                              <MiniButton label="Cancel" onClick={cancelEditingFinding} />
                            </div>
                          </>
                        ) : (
                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                            <p style={{ flex: "1 1 260px", fontSize: "13px", lineHeight: 1.5, margin: "0.25rem 0 0", ...(state.status === "rejected" ? { textDecoration: "line-through", opacity: 0.6 } : {}) }}>
                              {state.status === "edited" ? state.text : feature}
                            </p>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
                              <FindingChip status={state.status} />
                              <MiniButton label="Confirm" onClick={() => setFindingStatus(index, "confirmed", feature)} />
                              <MiniButton label="Edit" onClick={() => startEditingFinding(index, state.status === "edited" ? state.text : feature)} />
                              <MiniButton label="Reject" onClick={() => setFindingStatus(index, "rejected", feature)} tone="danger" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
              <div>
                <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 1rem" }}>Summary</h6>
                <p style={{ fontSize: "14px", lineHeight: 1.6, marginBottom: "1.5rem" }}>{report.summary}</p>

                <div style={{ borderRadius: "calc(var(--radius-base) - 2px)", border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: "1rem" }}>
                  <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.75rem" }}>Image quality</h6>
                  <p style={{ fontSize: "13px", lineHeight: 1.5, marginBottom: "0.75rem" }}>{report.imageQuality.assessment}</p>
                  <List items={report.imageQuality.limitations} empty="No quality limitations noted." />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.75rem" }}>Directly visible features</h6>
                  <List items={report.observedVisualFeatures} empty="No specific features returned." />
                </div>
                <div>
                  <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.75rem" }}>Not assessable</h6>
                  <List items={report.notAssessableFromThisImage} empty="No limitations noted." />
                </div>
                <div>
                  <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.75rem" }}>For clinician review</h6>
                  <List items={report.clinicianQuestions} empty="No follow-up questions." />
                </div>
              </div>
            </div>

            {/* Safety note */}
            <div style={{ borderRadius: "calc(var(--radius-base) - 2px)", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "1rem" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#a16207", margin: "0 0 0.5rem" }}>{report.safetyNote}</p>
              <p style={{ fontSize: "13px", lineHeight: 1.6, opacity: 0.85, margin: "0", color: "#a16207" }}>{report.uncertainty}</p>
            </div>

            <p style={{ fontSize: "11px", opacity: 0.6, margin: "1rem 0 0", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}><strong>Provider:</strong> {providerLabel[report.provider]} · {report.model}</p>
          </div>
        </section>
      )}

      {/* Generate review report */}
      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad}`, marginTop: isMobile ? "2rem" : "3rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: isMobile ? "1.5rem" : "2rem", boxShadow: "var(--shadow-card)" }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <h6 style={{ fontSize: "12px", fontWeight: "600", letterSpacing: "0.1em", color: accent, textTransform: "uppercase", margin: "0 0 0.5rem" }}>Review report</h6>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>Generate a review document from the current workspace.</h2>
            <p style={{ fontSize: "12px", opacity: 0.75, lineHeight: 1.6, margin: 0 }}>
              Combines the AI report with your confirmed / edited / rejected findings, checklist selections, pixel measurements and technical quality metrics, plus the AI-assistance notice. A working document for review by a qualified clinician — not a diagnosis.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button type="button" onClick={generateReviewReport} disabled={!canGenerateReport} className="pressable" style={{ padding: "0.7rem 1.1rem", backgroundColor: canGenerateReport ? accent : accentMuted(30), color: "var(--accent-fg)", border: "none", borderRadius: controlRadius, fontSize: "13px", fontWeight: "600", cursor: canGenerateReport ? "pointer" : "not-allowed", opacity: canGenerateReport ? 1 : 0.55, display: "flex", alignItems: "center", gap: "0.5rem", transition: "background-color 140ms ease, opacity 140ms ease" }}>
              <Icon name="scan" className="size-4" />Generate review report
            </button>
            {!canGenerateReport && <p style={{ fontSize: "11px", opacity: 0.6, margin: 0 }}>Needs an AI report, checklist selections, or measurements/annotations.</p>}
          </div>
          {generateError && <div role="alert" style={{ padding: "0.75rem", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: controlRadius, fontSize: "12px", color: "#dc2626", marginTop: "0.75rem" }}>{generateError}</div>}
        </div>
      </section>
      </div>

      {/* Printable review report (outside the no-print chrome) */}
      {generatedReport && (
        <section id="generated-review-report" aria-label="Generated review report" style={{ maxWidth: "1180px", margin: "0 auto", padding: `${pagePad}`, marginTop: isMobile ? "2rem" : "3rem" }}>
          <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", padding: isMobile ? "1.5rem" : "2rem", boxShadow: "var(--shadow-card)" }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>Review report (Markdown)</span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={copyGeneratedReport} className="pressable" style={{ padding: "0.5rem 0.8rem", fontSize: "12px", fontWeight: "600", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", transition: "border-color 140ms ease" }}>
                  <Icon name="copy" className="size-3.5" />{copyFeedback === "copied" ? "Copied" : copyFeedback === "failed" ? "Copy failed" : "Copy"}
                </button>
                <button type="button" onClick={downloadGeneratedReport} className="pressable" style={{ padding: "0.5rem 0.8rem", fontSize: "12px", fontWeight: "600", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", transition: "border-color 140ms ease" }}>
                  <Icon name="download" className="size-3.5" />Download .md
                </button>
                <button type="button" onClick={() => window.print()} className="pressable" style={{ padding: "0.5rem 0.8rem", fontSize: "12px", fontWeight: "600", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", transition: "border-color 140ms ease" }}>
                  <Icon name="printer" className="size-3.5" />Print
                </button>
              </div>
            </div>
            <div style={{ borderRadius: "calc(var(--radius-base) - 2px)", border: "1px solid var(--border)", backgroundColor: "var(--surface-inset)" }}>
              <pre style={{ margin: 0, padding: "1rem", fontSize: "12.5px", lineHeight: 1.6, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text)" }}>{generatedReport}</pre>
            </div>
            <p style={{ fontSize: "11px", opacity: 0.6, margin: "0.75rem 0 0" }}>Generated locally in your browser from the current workspace state. Markdown with the AI-assistance notice — not a diagnosis.</p>
          </div>
        </section>
      )}
    </>
  );
}