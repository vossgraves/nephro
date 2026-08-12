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
import {
  ImagingModality,
  MAX_ANALYSIS_FILE_BYTES,
  modalityLabel,
  providerLabel,
  RecognitionProvider,
  RecognitionReport,
} from "@/lib/imaging-recognition";

type Sample = { x: number; y: number; value: string } | null;
type ImageInfo = { width: number; height: number; luminance: number; source: string };
type AnalysisState = "idle" | "loading" | "success" | "error";

const MAX_LOCAL_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);
const modalities = Object.keys(modalityLabel) as ImagingModality[];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Icon({ name, className = "size-4" }: { name: "upload" | "zoomIn" | "zoomOut" | "invert" | "grid" | "reset" | "scan" | "check" | "arrow" | "warning"; className?: string }) {
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
  return <svg {...props}><path d="M20 11a8 8 0 1 0 2 5.4" /><path d="M20 4v7h-7" /></svg>;
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm leading-relaxed text-muted">{empty}</p>;
  return <ul className="space-y-2 text-sm leading-relaxed text-text">{items.map((item, index) => <li className="flex gap-2" key={`${item}-${index}`}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>;
}

export default function ImagingWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [sample, setSample] = useState<Sample>(null);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [provider, setProvider] = useState<RecognitionProvider>("openai");
  const [modality, setModality] = useState<ImagingModality>("ultrasound");
  const [clinicalQuestion, setClinicalQuestion] = useState("");
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(false);
  const [configuration, setConfiguration] = useState<Record<RecognitionProvider, boolean | null>>({ openai: null, gemini: null });
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [report, setReport] = useState<RecognitionReport | null>(null);

  const resetView = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setInvert(false);
    setGrid(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSample(null);
  }, []);

  useEffect(() => {
    fetch("/api/imaging/analyze", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { configured?: Record<RecognitionProvider, boolean> } | null) => {
        if (data?.configured) setConfiguration(data.configured);
      })
      .catch(() => setConfiguration({ openai: null, gemini: null }));
  }, []);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

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
    setAnalysisState("idle");
    resetView();
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
      const context = measureCanvas.getContext("2d", { willReadFrequently: true });
      let luminance = 0;
      if (context) {
        context.drawImage(image, 0, 0, measureCanvas.width, measureCanvas.height);
        const pixels = context.getImageData(0, 0, measureCanvas.width, measureCanvas.height).data;
        let sum = 0;
        for (let index = 0; index < pixels.length; index += 4) sum += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
        luminance = Math.round(sum / (pixels.length / 4));
      }
      setInfo({ width: image.naturalWidth, height: image.naturalHeight, luminance, source: file.name });
    };
    image.onerror = () => {
      setNotice("The browser could not decode this file. Try an exported PNG or JPEG.");
      imageRef.current = null;
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
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.scale(ratio, ratio);
    context.fillStyle = "#0f1115";
    context.fillRect(0, 0, bounds.width, bounds.height);
    if (!image) { context.restore(); return; }
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
      context.strokeStyle = "rgba(255,255,255,0.26)";
      context.lineWidth = 1;
      for (let index = 1; index < 8; index += 1) {
        const horizontal = y + (renderedHeight / 8) * index;
        const vertical = x + (renderedWidth / 8) * index;
        context.beginPath(); context.moveTo(x, horizontal); context.lineTo(x + renderedWidth, horizontal); context.stroke();
        context.beginPath(); context.moveTo(vertical, y); context.lineTo(vertical, y + renderedHeight); context.stroke();
      }
      context.restore();
    }
    context.restore();
  }, [brightness, contrast, grid, invert, pan.x, pan.y, zoom]);

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
    const baseScale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const x = (bounds.width - image.naturalWidth * scale) / 2 + pan.x;
    const y = (bounds.height - image.naturalHeight * scale) / 2 + pan.y;
    const imageX = Math.floor((clientX - bounds.left - x) / scale);
    const imageY = Math.floor((clientY - bounds.top - y) / scale);
    if (imageX < 0 || imageY < 0 || imageX >= image.naturalWidth || imageY >= image.naturalHeight) { setSample(null); return; }
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 1; sampleCanvas.height = 1;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, imageX, imageY, 1, 1, 0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    setSample({ x: imageX, y: imageY, value: `${Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue)} / 255` });
  }, [pan.x, pan.y, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!imageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragOrigin({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };
  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragOrigin) { setPan({ x: dragOrigin.panX + event.clientX - dragOrigin.x, y: dragOrigin.panY + event.clientY - dragOrigin.y }); return; }
    renderPointer(event.clientX, event.clientY);
  };
  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => { setDragOrigin(null); renderPointer(event.clientX, event.clientY); };

  const requestAnalysis = async () => {
    if (!imageDataUrl || !file) { setAnalysisError("Choose an exported image first."); return; }
    if (!deidentifiedConfirmed) { setAnalysisError("Confirm that the image is de-identified before sending it to a provider."); return; }
    if (file.size > MAX_ANALYSIS_FILE_BYTES) { setAnalysisError("Provider review is limited to images smaller than 4 MB. You can still use local review tools."); return; }
    setAnalysisState("loading");
    setAnalysisError(null);
    setReport(null);
    try {
      const response = await fetch("/api/imaging/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ provider, modality, imageDataUrl, clinicalQuestion, deidentifiedConfirmed }),
      });
      const data = await response.json() as { report?: RecognitionReport; error?: string };
      if (!response.ok || !data.report) throw new Error(data.error || "The selected provider returned an incomplete response.");
      setReport(data.report);
      setAnalysisState("success");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The analysis could not be completed.");
      setAnalysisState("error");
    }
  };

  const imagePropertyLabel = useMemo(() => info ? `${info.width.toLocaleString()} × ${info.height.toLocaleString()} px` : "Waiting for a local image", [info]);
  const selectedConfigured = configuration[provider];
  const analysisBlocked = !imageDataUrl || !deidentifiedConfirmed || file?.size && file.size > MAX_ANALYSIS_FILE_BYTES || selectedConfigured === false || analysisState === "loading";

  return (
    <div className="mx-auto max-w-7xl">
      <section className="grid gap-7 border-b border-border pb-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Imaging review workspace</p>
          <h1 className="mt-4 max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">Real visual review, not simulated diagnosis.</h1>
          <p className="mt-5 max-w-3xl text-pretty leading-relaxed text-muted">Review exported, de-identified medical images locally, then optionally request an <strong className="font-semibold text-text">AI-assisted visual review</strong> from a configured OpenAI or Gemini provider. The report preserves uncertainty and never substitutes for clinical interpretation.</p>
        </div>
        <aside className="rounded-[calc(var(--radius-base)+5px)] border border-primary/20 bg-primary/5 p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Icon name="warning" className="size-4" /> Clinical boundary</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">Do not upload identifiable patient images. This is not a medical device, radiology report, or treatment recommendation.</p>
        </aside>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="overflow-hidden rounded-[calc(var(--radius-base)+7px)] border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/60 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{file?.name ?? "No local image selected"}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{file ? `${formatBytes(file.size)} · ${imagePropertyLabel}` : "PNG · JPEG · WebP · local review up to 25 MB"}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setZoom((value) => Math.min(3, +(value + 0.2).toFixed(1)))} className="icon-control" aria-label="Zoom in"><Icon name="zoomIn" /></button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.2).toFixed(1)))} className="icon-control" aria-label="Zoom out"><Icon name="zoomOut" /></button>
              <button type="button" onClick={resetView} className="icon-control" aria-label="Reset image controls"><Icon name="reset" /></button>
            </div>
          </div>
          <div className="relative bg-[#0f1115] p-3 sm:p-4">
            <canvas ref={canvasRef} className="block aspect-[4/3] w-full touch-none rounded-[calc(var(--radius-base)+2px)] bg-[#0f1115]" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={() => !dragOrigin && setSample(null)} aria-label="Local image viewing canvas. Drag to pan; move the pointer for pixel intensity." />
            {!sourceUrl && <div className="pointer-events-none absolute inset-3 grid place-items-center sm:inset-4"><div className="max-w-sm px-6 text-center text-white/70"><span className="mx-auto grid size-12 place-items-center rounded-full border border-white/15 bg-white/5"><Icon name="upload" className="size-5" /></span><p className="mt-4 text-sm font-semibold text-white">Choose a de-identified exported image</p><p className="mt-2 text-xs leading-relaxed text-white/60">Local tools run in your browser. Provider review is opt-in and only becomes available after privacy confirmation.</p></div></div>}
          </div>
          <div className="grid gap-3 border-t border-border bg-surface px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="font-mono text-[11px] text-muted" aria-live="polite">{sample ? `Sample · x ${sample.x} · y ${sample.y} · luminance ${sample.value}` : "Hover for local pixel intensity. Drag to pan."}</p>
            <button type="button" onClick={() => inputRef.current?.click()} className="button-secondary inline-flex items-center justify-center gap-2"><Icon name="upload" />{file ? "Replace image" : "Choose image"}</button>
            <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0])} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[calc(var(--radius-base)+5px)] border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Local controls</p>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-text">Brightness <span className="float-right font-mono text-xs text-muted">{brightness}%</span><input className="mt-2 w-full accent-primary" type="range" min="60" max="150" value={brightness} onChange={(event) => setBrightness(+event.target.value)} /></label>
              <label className="block text-sm font-medium text-text">Contrast <span className="float-right font-mono text-xs text-muted">{contrast}%</span><input className="mt-2 w-full accent-primary" type="range" min="60" max="180" value={contrast} onChange={(event) => setContrast(+event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setInvert((value) => !value)} className={`tool-toggle ${invert ? "tool-toggle-active" : ""}`}><Icon name="invert" />Invert</button><button type="button" onClick={() => setGrid((value) => !value)} className={`tool-toggle ${grid ? "tool-toggle-active" : ""}`}><Icon name="grid" />Grid</button></div>
            </div>
          </div>
          <div className="rounded-[calc(var(--radius-base)+5px)] border border-border bg-bg/45 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Local file facts</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><div><dt className="text-muted">Dimensions</dt><dd className="mt-1 font-mono text-xs text-text">{info ? imagePropertyLabel : "—"}</dd></div><div><dt className="text-muted">Mean luminance</dt><dd className="mt-1 font-mono text-xs text-text">{info ? `${info.luminance} / 255` : "—"}</dd></div><div><dt className="text-muted">Storage</dt><dd className="mt-1 text-xs text-text">This browser</dd></div><div><dt className="text-muted">Format</dt><dd className="mt-1 text-xs text-text">{file?.type || "—"}</dd></div></dl>
          </div>
        </aside>
      </section>

      <section className="mt-12 grid gap-6 border-t border-border pt-10 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="rounded-[calc(var(--radius-base)+7px)] border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Icon name="scan" className="size-4" /> AI-assisted visual review</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-text">A governed request, not a fake diagnostic report.</h2></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedConfigured ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-800"}`}>{selectedConfigured ? "Provider configured" : configuration[provider] === null ? "Checking provider" : "Provider needs setup"}</span></div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="field-label">Provider<select className="field-control mt-2" value={provider} onChange={(event) => { setProvider(event.target.value as RecognitionProvider); setAnalysisError(null); setReport(null); }}><option value="openai">OpenAI Vision</option><option value="gemini">Gemini Vision</option></select></label>
            <label className="field-label">Image type<select className="field-control mt-2" value={modality} onChange={(event) => setModality(event.target.value as ImagingModality)}>{modalities.map((value) => <option value={value} key={value}>{modalityLabel[value]}</option>)}</select></label>
          </div>
          <label className="field-label mt-5 block">Optional review question<textarea className="field-control mt-2 min-h-24 resize-y" maxLength={600} value={clinicalQuestion} onChange={(event) => setClinicalQuestion(event.target.value)} placeholder="For example: Describe image-quality limitations and any directly visible non-diagnostic features." /></label>
          <label className="mt-5 flex cursor-pointer gap-3 rounded-xl border border-border bg-bg/50 p-4 text-sm leading-relaxed text-muted"><input className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" checked={deidentifiedConfirmed} onChange={(event) => setDeidentifiedConfirmed(event.target.checked)} /><span>I confirm this is a de-identified exported image and I consent to send it to <strong className="font-semibold text-text">{providerLabel[provider]}</strong> for an AI-assisted visual review. The image is not permanently stored by Nephro’s endpoint.</span></label>
          {notice && <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900">{notice}</p>}
          {analysisError && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800" role="alert">{analysisError}</p>}
          <button type="button" disabled={Boolean(analysisBlocked)} onClick={requestAnalysis} className="button-primary mt-6 inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">{analysisState === "loading" ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Reviewing image…</> : <><Icon name="scan" />Request AI-assisted review <Icon name="arrow" /></>}</button>
          <p className="mt-3 text-xs leading-relaxed text-muted">Selected provider receives the image only when you press the review button. Never use this for emergency, diagnostic, or treatment decisions.</p>
        </div>

        <aside className="rounded-[calc(var(--radius-base)+5px)] border border-border bg-bg/45 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">What the report can do</p><p className="mt-3 text-sm leading-relaxed text-muted">It can describe visible image characteristics, image quality, and review limitations. It cannot replace a radiologist, analyze a full DICOM series, or validate a disease finding from a single exported image.</p><a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline" href="https://www.cancerimagingarchive.net/access-data/" target="_blank" rel="noreferrer">Explore de-identified teaching data <Icon name="arrow" /></a></aside>
      </section>

      {report && <section className="mt-8 rounded-[calc(var(--radius-base)+7px)] border border-primary/25 bg-primary/[0.035] p-5 shadow-sm sm:p-7" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-primary/15 pb-5"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Icon name="check" className="size-4" /> AI-assisted review complete</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-text">Review output</h2></div><p className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">{providerLabel[report.provider]} · {report.model}</p></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Cautious summary</p><p className="mt-3 text-base leading-relaxed text-text">{report.summary}</p><div className="mt-5 rounded-xl border border-border bg-surface/80 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Image quality</p><p className="mt-2 text-sm leading-relaxed text-text">{report.imageQuality.assessment}</p><div className="mt-3"><List items={report.imageQuality.limitations} empty="No provider-supplied image-quality limitation." /></div></div></div><div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Directly visible features</p><div className="mt-3"><List items={report.observedVisualFeatures} empty="The provider did not return directly visible features." /></div></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Not assessable from this input</p><div className="mt-3"><List items={report.notAssessableFromThisImage} empty="No specific limitation was returned." /></div></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Questions for clinician review</p><div className="mt-3"><List items={report.clinicianQuestions} empty="No follow-up questions were returned." /></div></div></div></div>
        <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"><p className="text-sm font-semibold text-amber-950">{report.safetyNote}</p><p className="mt-2 text-sm leading-relaxed text-amber-900">{report.uncertainty}</p></div>
      </section>}
    </div>
  );
}
