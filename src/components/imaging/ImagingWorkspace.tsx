"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Sample = { x: number; y: number; value: string } | null;
type ImageInfo = {
  width: number;
  height: number;
  luminance: number;
  source: string;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Icon({ name, className = "size-4" }: { name: "upload" | "zoomIn" | "zoomOut" | "invert" | "grid" | "reset"; className?: string }) {
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

  if (name === "upload") {
    return <svg {...props}><path d="M12 16V4m0 0 4 4m-4-4L8 8M5 14v4.4A1.6 1.6 0 0 0 6.6 20h10.8a1.6 1.6 0 0 0 1.6-1.6V14" /></svg>;
  }
  if (name === "zoomIn") {
    return <svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="M11 8v6m-3-3h6m8 8-5.5-5.5" /></svg>;
  }
  if (name === "zoomOut") {
    return <svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="M8 11h6m8 8-5.5-5.5" /></svg>;
  }
  if (name === "invert") {
    return <svg {...props}><path d="M12 3a9 9 0 1 0 0 18V3Z" /><path d="M12 3a9 9 0 0 1 0 18" /></svg>;
  }
  if (name === "grid") {
    return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M12 4v16M4 12h16" /></svg>;
  }
  return <svg {...props}><path d="M20 11a8 8 0 1 0 2 5.4" /><path d="M20 4v7h-7" /></svg>;
}

export default function ImagingWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [sample, setSample] = useState<Sample>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const resetView = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setInvert(false);
    setGrid(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSample(null);
  }, []);

  const loadFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.size > MAX_FILE_BYTES) {
      setNotice("Choose an image smaller than 25 MB. The browser-only viewer does not upload your file.");
      return;
    }
    if (!ACCEPTED.has(candidate.type)) {
      setNotice("This first release reads PNG, JPEG, and WebP images. DICOM support is planned through a dedicated local viewer, not a diagnostic service.");
      return;
    }
    setNotice(null);
    resetView();
    setFile(candidate);
    setSourceUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(candidate);
    });
  }, [resetView]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => {
    if (!sourceUrl || !file) {
      imageRef.current = null;
      setImageLoaded(false);
      setInfo(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const measureCanvas = document.createElement("canvas");
      const edge = 160;
      const scale = Math.min(edge / image.naturalWidth, edge / image.naturalHeight, 1);
      measureCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      measureCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const measureContext = measureCanvas.getContext("2d", { willReadFrequently: true });
      let luminance = 0;
      if (measureContext) {
        measureContext.drawImage(image, 0, 0, measureCanvas.width, measureCanvas.height);
        const pixels = measureContext.getImageData(0, 0, measureCanvas.width, measureCanvas.height).data;
        let sum = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          sum += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
        }
        luminance = Math.round(sum / (pixels.length / 4));
      }
      setImageLoaded(true);
      setInfo({
        width: image.naturalWidth,
        height: image.naturalHeight,
        luminance,
        source: file.name,
      });
    };
    image.onerror = () => {
      setNotice("The browser could not decode this image. Try an exported PNG or JPEG.");
      imageRef.current = null;
      setImageLoaded(false);
      setInfo(null);
    };
    image.src = sourceUrl;
  }, [file, sourceUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.scale(ratio, ratio);
    context.fillStyle = "#101216";
    context.fillRect(0, 0, bounds.width, bounds.height);
    if (!image) {
      context.restore();
      return;
    }

    const baseScale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    const x = (bounds.width - renderedWidth) / 2 + pan.x;
    const y = (bounds.height - renderedHeight) / 2 + pan.y;

    context.filter = `brightness(${brightness}%) contrast(${contrast}%)${invert ? " invert(1)" : ""}`;
    context.drawImage(image, x, y, renderedWidth, renderedHeight);
    context.filter = "none";

    if (grid) {
      context.save();
      context.beginPath();
      context.rect(x, y, renderedWidth, renderedHeight);
      context.clip();
      context.strokeStyle = "rgba(255,255,255,0.28)";
      context.lineWidth = 1;
      const division = 8;
      for (let i = 1; i < division; i += 1) {
        const horizontal = y + (renderedHeight / division) * i;
        const vertical = x + (renderedWidth / division) * i;
        context.beginPath();
        context.moveTo(x, horizontal);
        context.lineTo(x + renderedWidth, horizontal);
        context.moveTo(vertical, y);
        context.lineTo(vertical, y + renderedHeight);
        context.stroke();
      }
      context.restore();
    }
    context.restore();
  }, [brightness, contrast, grid, imageLoaded, invert, pan.x, pan.y, zoom]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(draw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [draw]);

  const renderPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const bounds = canvas.getBoundingClientRect();
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    const baseScale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    const x = (bounds.width - renderedWidth) / 2 + pan.x;
    const y = (bounds.height - renderedHeight) / 2 + pan.y;
    const imageX = Math.floor((localX - x) / scale);
    const imageY = Math.floor((localY - y) / scale);
    if (imageX < 0 || imageY < 0 || imageX >= image.naturalWidth || imageY >= image.naturalHeight) {
      setSample(null);
      return;
    }
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 1;
    sampleCanvas.height = 1;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, imageX, imageY, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    setSample({ x: imageX, y: imageY, value: `${luminance} / 255` });
  }, [pan.x, pan.y, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!imageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setDragOrigin({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragOrigin && pointerRef.current) {
      setPan({ x: dragOrigin.panX + event.clientX - dragOrigin.x, y: dragOrigin.panY + event.clientY - dragOrigin.y });
      return;
    }
    renderPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    setDragOrigin(null);
    pointerRef.current = null;
    renderPointer(event.clientX, event.clientY);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const imagePropertyLabel = useMemo(() => {
    if (!info) return "Waiting for a local image";
    return `${info.width.toLocaleString()} × ${info.height.toLocaleString()} px`;
  }, [info]);

  return (
    <div className="mx-auto max-w-6xl">
      <section className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Image review workspace</p>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">Inspect the image. Do not automate the diagnosis.</h1>
          <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-muted">
            This browser-only lab lets you review exported X-ray and teaching images with deterministic image tools. Files stay on this device and are never uploaded by this page.
          </p>
        </div>
        <aside className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Boundary</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">This is not a radiology reader, medical device, or diagnostic service. Do not upload identifiable patient images.</p>
        </aside>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-[calc(var(--radius-base)+6px)] border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/60 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{file?.name ?? "No local image selected"}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{file ? `${formatBytes(file.size)} · ${imagePropertyLabel}` : "PNG · JPEG · WebP · up to 25 MB"}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setZoom((current) => Math.min(3, +(current + 0.2).toFixed(1)))} className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:bg-bg" aria-label="Zoom in"><Icon name="zoomIn" /></button>
              <button type="button" onClick={() => setZoom((current) => Math.max(0.6, +(current - 0.2).toFixed(1)))} className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:bg-bg" aria-label="Zoom out"><Icon name="zoomOut" /></button>
              <button type="button" onClick={resetView} className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:bg-bg" aria-label="Reset image controls"><Icon name="reset" /></button>
            </div>
          </div>

          <div className="relative bg-[#101216] p-3 sm:p-4">
            <canvas
              ref={canvasRef}
              className="block aspect-[4/3] w-full touch-none rounded-[calc(var(--radius-base)+2px)] bg-[#101216]"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => !dragOrigin && setSample(null)}
              aria-label="Local image viewing canvas. Drag to pan; move the pointer for a pixel intensity readout."
            />
            {!sourceUrl && (
              <div className="pointer-events-none absolute inset-3 grid place-items-center sm:inset-4">
                <div className="max-w-sm px-6 text-center text-white/70">
                  <span className="mx-auto grid size-12 place-items-center rounded-full border border-white/15 bg-white/5"><Icon name="upload" className="size-5" /></span>
                  <p className="mt-4 text-sm font-semibold text-white">Bring your own exported image</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/60">Choose a de-identified PNG, JPEG, or WebP X-ray/teaching image to use the local review tools.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 border-t border-border bg-surface px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="font-mono text-[11px] text-muted" aria-live="polite">{sample ? `Sample · x ${sample.x} · y ${sample.y} · luminance ${sample.value}` : "Hover for a local pixel-intensity readout. Drag to pan."}</p>
            <p className="text-xs text-muted">Rendering and measurements stay in this browser session.</p>
          </div>
        </div>

        <aside className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full rounded-[calc(var(--radius-base)+4px)] border border-dashed p-5 text-left transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/50 hover:bg-bg"}`}
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-fg"><Icon name="upload" /></span>
            <span className="mt-4 block text-sm font-semibold text-text">Choose local image</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-muted">Drop a file here or browse. No upload and no account required.</span>
          </button>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="sr-only" />

          {notice && <p className="rounded-[var(--radius-base)] border border-very-high/35 bg-very-high/10 px-3 py-2.5 text-xs leading-relaxed text-text" role="alert">{notice}</p>}

          <div className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Deterministic controls</p>
            <label className="mt-4 block text-xs font-medium text-text">Brightness <span className="float-right font-mono text-muted">{brightness}%</span><input type="range" min="60" max="160" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} className="mt-2 w-full accent-primary" /></label>
            <label className="mt-4 block text-xs font-medium text-text">Contrast <span className="float-right font-mono text-muted">{contrast}%</span><input type="range" min="60" max="180" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} className="mt-2 w-full accent-primary" /></label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setInvert((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${invert ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-text hover:bg-bg"}`}><Icon name="invert" /> Invert</button>
              <button type="button" onClick={() => setGrid((value) => !value)} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${grid ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-text hover:bg-bg"}`}><Icon name="grid" /> Grid</button>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <article className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Image properties</p>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <div><p className="text-xs text-muted">Dimensions</p><p className="mt-1 text-sm font-semibold tabular-nums text-text">{info ? `${info.width} × ${info.height}` : "—"}</p></div>
            <div><p className="text-xs text-muted">Mean luminance</p><p className="mt-1 text-sm font-semibold tabular-nums text-text">{info ? `${info.luminance} / 255` : "—"}</p></div>
            <div><p className="text-xs text-muted">Zoom</p><p className="mt-1 text-sm font-semibold tabular-nums text-text">{Math.round(zoom * 100)}%</p></div>
            <div><p className="text-xs text-muted">Storage</p><p className="mt-1 text-sm font-semibold text-text">Local only</p></div>
          </div>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted">These values describe pixels and display settings. They are not a clinical interpretation, quality assessment, or diagnostic finding.</p>
        </article>

        <article className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Public teaching resources</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">Use de-identified material for demos and research. Review each source’s use terms and attribution requirements before reusing any study.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="https://www.cancerimagingarchive.net/access-data/" target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-text transition-colors hover:border-primary/50 hover:bg-surface">TCIA collections ↗</a>
            <a href="https://nihcc.app.box.com/v/ChestXray-NIHCC" target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-text transition-colors hover:border-primary/50 hover:bg-surface">NIH Chest X-ray ↗</a>
            <a href="https://docs.ohif.org/" target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-bg px-3 py-2 text-xs font-semibold text-text transition-colors hover:border-primary/50 hover:bg-surface">OHIF DICOM viewer ↗</a>
          </div>
        </article>
      </section>
    </div>
  );
}
