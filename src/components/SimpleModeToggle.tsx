"use client";

import { useEffect, useState } from "react";

const KEY = "nephro.simple-mode";

/**
 * Accessibility mode: larger text, calmer motion, high-contrast focus,
 * minimal decorations. Backed by localStorage so the choice survives
 * reloads. Reduced-motion users get it forced on via CSS.
 */
export function SimpleModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setEnabled(window.localStorage.getItem(KEY) === "1");
    } catch {
      // storage blocked — default off
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("simple-mode", enabled);
    try {
      window.localStorage.setItem(KEY, enabled ? "1" : "0");
    } catch {
      // storage blocked — mode still applies for this session
    }
  }, [enabled, mounted]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((value) => !value)}
      aria-pressed={enabled}
      title="Toggle simple mode: larger text and calmer visuals"
      className="pressable shrink-0 rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 px-2.5 py-1.5 text-[11px] font-semibold tracking-[-0.01em] text-muted transition-colors hover:border-accent hover:text-text sm:px-3 sm:text-xs"
    >
      {enabled ? "Simple mode on" : "Simple mode"}
    </button>
  );
}
