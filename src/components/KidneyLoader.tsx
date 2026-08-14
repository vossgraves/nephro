"use client";

import { useId } from "react";

/**
 * A stylized kidney that fills with warm "fluid" from the bottom.
 *
 * - `progress` (0..1) drives a determinate fill (e.g. analysis progress).
 * - Without `progress` the loader runs an indeterminate breathing cycle.
 *
 * The fill is a clipped, GPU-friendly transform animation (translateY only),
 * with a wavy liquid surface, shimmer, and rising droplets. All looping motion
 * collapses to a static fill under `prefers-reduced-motion`.
 */
export function KidneyLoader({
  progress,
  size = 96,
  label,
  className = "",
  ariaLabel = "Loading",
}: {
  /** 0..1 determinate fill level. Omit for the indeterminate breathing cycle. */
  progress?: number;
  size?: number;
  label?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `kidney-clip-${uid}`;
  const liquidId = `kidney-liquid-${uid}`;
  const capsuleId = `kidney-capsule-${uid}`;
  const glowId = `kidney-glow-${uid}`;

  const KIDNEY = "M118 32 C 94 30, 74 46, 70 70 C 66 92, 80 96, 82 112 C 84 128, 78 138, 84 152 C 92 170, 128 174, 148 166 C 172 156, 184 132, 182 100 C 180 70, 162 44, 136 34 C 130 32, 124 32, 118 32 Z";
  const CAPSULE = "M118 40 C 98 38, 81 52, 78 72 C 75 90, 87 95, 89 109 C 91 122, 86 131, 91 144 C 98 160, 128 163, 144 157 C 165 148, 175 128, 173 101 C 171 76, 157 54, 135 45 C 130 42, 124 40, 118 40 Z";
  const WAVE = "M56 0 C 68 -12, 78 -12, 90 0 S 112 12, 124 0 S 146 -12, 158 0 S 176 12, 184 0 L 184 290 L 56 290 Z";
  const WAVE_EDGE = "M56 0 C 68 -12, 78 -12, 90 0 S 112 12, 124 0 S 146 -12, 158 0 S 176 12, 184 0";

  const determinate = typeof progress === "number";
  const clamped = determinate ? Math.max(0, Math.min(1, progress)) : null;
  const waveY = clamped !== null ? 178 - 150 * clamped : null;

  return (
    <div
      className={`kidney-loader ${className}`}
      style={{ width: size }}
      role="img"
      aria-label={label ? `${ariaLabel} — ${label}` : ariaLabel}
    >
      <svg
        width={size}
        height={(size * 200) / 240}
        viewBox="0 0 240 200"
        fill="none"
        aria-hidden="true"
        style={{ overflow: "visible" }}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={KIDNEY} />
          </clipPath>
          <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2a05e" />
            <stop offset="55%" stopColor="#d97b45" />
            <stop offset="100%" stopColor="#a8441c" />
          </linearGradient>
          <linearGradient id={capsuleId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fffdf9" />
            <stop offset="100%" stopColor="#fbe7d3" />
          </linearGradient>
          <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#d97b45" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#d97b45" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient glow */}
        <ellipse
          className="kidney-glow"
          cx="120"
          cy="104"
          rx="104"
          ry="86"
          fill={`url(#${glowId})`}
        />

        {/* Capsule (solid base) */}
        <path d={CAPSULE} fill={`url(#${capsuleId})`} />

        {/* Rising fluid, clipped to the kidney silhouette */}
        <g clipPath={`url(#${clipId})`}>
          <g
            className={determinate ? undefined : "kidney-fill"}
            style={
              determinate
                ? { transform: `translateY(${waveY}px)`, transformOrigin: "0 0" }
                : undefined
            }
          >
            <path d={WAVE} fill={`url(#${liquidId})`} />
            <path
              d={WAVE_EDGE}
              stroke="#ffd9b0"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
            <path
              className="kidney-wave-shimmer"
              d={WAVE_EDGE}
              stroke="#fff1dd"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.45"
              transform="translate(-16, -5) scale(1, 1)"
            />
            <circle className="kidney-drop" cx="96" cy="138" r="3.2" fill="#fff" opacity="0" />
            <circle
              className="kidney-drop"
              cx="126"
              cy="116"
              r="2.4"
              fill="#fff"
              opacity="0"
              style={{ animationDelay: "0.7s" }}
            />
            <circle
              className="kidney-drop"
              cx="140"
              cy="150"
              r="2"
              fill="#fff"
              opacity="0"
              style={{ animationDelay: "1.35s" }}
            />
          </g>
        </g>

        {/* Hilum detail */}
        <path
          d="M76 96 C 88 94, 98 98, 106 94 C 98 102, 88 106, 78 106"
          stroke="var(--accent)"
          strokeOpacity="0.4"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="kidney-cap-pulse"
          d="M84 128 C 94 126, 104 130, 112 126 C 104 134, 94 137, 85 137"
          stroke="var(--accent)"
          strokeOpacity="0.28"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Silhouette outline */}
        <path
          d={KIDNEY}
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {label ? (
        <span
          className="text-xs font-semibold tracking-[0.08em] text-muted uppercase"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
