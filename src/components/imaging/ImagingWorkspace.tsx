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
import { KidneyLoader } from "@/components/KidneyLoader";

type Sample = { x: number; y: number; value: string } | null;
type ImageInfo = { width: number; height: number; luminance: number; source: string };
type AnalysisState = "idle" | "loading" | "success" | "error";
type Breakpoint = "phone" | "tablet" | "desktop";

const MAX_LOCAL_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);
const modalities = Object.keys(modalityLabel) as ImagingModality[];

const ANALYSIS_PHASES = [
  "Contacting provider",
  "Reading image",
  "Assembling report",
] as const;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBreakpoint(width: number): Breakpoint {
  if (width < 720) return "phone";
  if (width < 1120) return "tablet";
  return "desktop";
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
  if (!items.length) return <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{empty}</p>;
  return <ul className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>{items.map((item, index) => <li className="flex gap-2" key={`${item}-${index}`}><span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />{item}</li>)}</ul>;
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
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  const [modality, setModality] = useState<ImagingModality>("ultrasound");
  const [clinicalQuestion, setClinicalQuestion] = useState("");
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(false);
  const [providerStatus, setProviderStatus] = useState<"ready" | "checking" | "unavailable">("checking");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [report, setReport] = useState<RecognitionReport | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);

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

  useEffect(() => {
    if (analysisState !== "loading") return;
    setPhaseIndex(0);
    const timer = window.setInterval(() => {
      setPhaseIndex((index) => (index + 1) % ANALYSIS_PHASES.length);
    }, 950);
    return () => window.clearInterval(timer);
  }, [analysisState]);

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
    context.fillStyle = "#131518";
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
        body: JSON.stringify({ modality, imageDataUrl, clinicalQuestion, deidentifiedConfirmed }),
      });
      const data = await response.json() as { report?: RecognitionReport; error?: string };
      if (!response.ok || !data.report) throw new Error(data.error || "Analysis failed. Please try again.");
      setReport(data.report);
      setAnalysisState("success");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The analysis could not be completed.");
      setAnalysisState("error");
    }
  };

  const imagePropertyLabel = useMemo(() => info ? `${info.width.toLocaleString()} × ${info.height.toLocaleString()} px` : "Waiting for a local image", [info]);
  const analysisBlocked = !imageDataUrl || !deidentifiedConfirmed || file?.size && file.size > MAX_ANALYSIS_FILE_BYTES || providerStatus === "unavailable" || analysisState === "loading";

  const isPhone = breakpoint === "phone";
  const isTablet = breakpoint === "tablet";
  const isMobile = isPhone || isTablet;
  const viewerHeight = isPhone ? "220px" : isTablet ? "280px" : "340px";
  const pagePad = isPhone ? "1.25rem" : isTablet ? "2rem" : "2rem";
  const h1Size = isPhone ? "28px" : isTablet ? "38px" : "48px";
  const cardRadius = "calc(var(--radius-base) + 4px)";
  const controlRadius = "calc(var(--radius-base) - 6px)";

  const accent = "var(--accent)";
  const accentMuted = (alpha: number) => `color-mix(in oklab, var(--accent) ${alpha}%, transparent)`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)" }}>
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
        <div style={{ borderRadius: cardRadius, border: "1px solid var(--border)", backgroundColor: "var(--surface)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
          {/* Viewer Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-raised)", padding: "1rem" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: "600", margin: 0, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file?.name ?? "No image selected"}</p>
              <p style={{ fontSize: "12px", opacity: 0.6, margin: "0.5rem 0 0", fontFamily: "var(--font-mono)" }}>
                {file ? `${formatBytes(file.size)} · ${imagePropertyLabel}` : "PNG · JPEG · WebP · up to 25 MB"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={() => setZoom((value) => Math.min(3, +(value + 0.2).toFixed(1)))} style={{ width: "32px", height: "32px", padding: "0", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", transition: "background-color 140ms ease, border-color 140ms ease" }} className="pressable" aria-label="Zoom in"><Icon name="zoomIn" className="size-4" /></button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.2).toFixed(1)))} style={{ width: "32px", height: "32px", padding: "0", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", transition: "background-color 140ms ease, border-color 140ms ease" }} className="pressable" aria-label="Zoom out"><Icon name="zoomOut" className="size-4" /></button>
              <button type="button" onClick={resetView} style={{ width: "32px", height: "32px", padding: "0", background: "transparent", border: "1px solid var(--border)", borderRadius: controlRadius, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", transition: "background-color 140ms ease, border-color 140ms ease" }} className="pressable" aria-label="Reset view"><Icon name="reset" className="size-4" /></button>
            </div>
          </div>

          {/* Canvas */}
          <div style={{ position: "relative", backgroundColor: "#131518", padding: "1rem", aspectRatio: "4/3" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", borderRadius: "calc(var(--radius-base) - 4px)", display: "block", touchAction: "none" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={() => !dragOrigin && setSample(null)} aria-label="Image viewer. Drag to pan; move pointer for pixel intensity." />
            {!sourceUrl && (
              <div style={{ position: "absolute", inset: "1rem", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                  <div style={{ width: "48px", height: "48px", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "rgba(255,255,255,0.8)" }}><Icon name="upload" className="size-5" /></span>
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "0.5rem" }}>Choose a de-identified image</p>
                  <p style={{ fontSize: "12px", opacity: 0.7 }}>Local tools run in your browser; provider review is opt-in.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with controls */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "1rem", backgroundColor: "var(--surface)", display: "flex", flexDirection: isPhone ? "column" : "row", gap: "1rem", alignItems: isPhone ? "stretch" : "center", justifyContent: "space-between" }}>
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
              <input type="range" min="20" max="200" value={brightness} onChange={(event) => setBrightness(+event.target.value)} style={{ width: "100%", background: `linear-gradient(to right, ${accent} ${(brightness - 20) / 1.8}%, var(--border) ${(brightness - 20) / 1.8}%)` }} />
            </div>

            {/* Contrast */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "0.5rem" }}>
                <span>Contrast</span>
                <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)" }}>{contrast}%</span>
              </div>
              <input type="range" min="20" max="200" value={contrast} onChange={(event) => setContrast(+event.target.value)} style={{ width: "100%", background: `linear-gradient(to right, ${accent} ${(contrast - 20) / 1.8}%, var(--border) ${(contrast - 20) / 1.8}%)` }} />
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
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1rem", fontSize: "12px" }}>
              <div><dt style={{ opacity: 0.6 }}>Dimensions</dt><dd style={{ fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "0.25rem" }}>{info ? imagePropertyLabel : "—"}</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Mean luminance</dt><dd style={{ fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "0.25rem" }}>{info ? `${info.luminance} / 255` : "—"}</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Storage</dt><dd style={{ fontSize: "11px", marginTop: "0.25rem" }}>This browser</dd></div>
              <div><dt style={{ opacity: 0.6 }}>Format</dt><dd style={{ fontSize: "11px", marginTop: "0.25rem" }}>{file?.type || "—"}</dd></div>
            </dl>
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
          <button type="button" disabled={Boolean(analysisBlocked)} onClick={requestAnalysis} aria-busy={analysisState === "loading"} style={{ width: "100%", padding: "0.75rem", backgroundColor: analysisBlocked ? accentMuted(30) : accent, color: "var(--accent-fg)", border: "none", borderRadius: controlRadius, fontSize: "14px", fontWeight: "600", cursor: analysisBlocked ? "not-allowed" : "pointer", opacity: analysisBlocked ? 0.55 : 1, display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "center", transition: "background-color 160ms ease, opacity 160ms ease", minHeight: "46px" }}>
            {analysisState === "loading" ? (
              <>
                <KidneyLoader size={26} ariaLabel="Reviewing" />
                <span className="tabular-nums">{ANALYSIS_PHASES[phaseIndex]}…</span>
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
    </div>
  );
}
