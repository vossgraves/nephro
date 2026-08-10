"use client";

import { animate, stagger as animeStagger, utils } from "animejs";
import { createElement, useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** ms delay before the animation starts */
  delay?: number;
  /** when true, animate direct children one after another instead of the wrapper as a whole */
  stagger?: boolean;
  /** wrapper element tag, default "div" */
  as?: "div" | "section" | "ul";
}

export default function Reveal({
  children,
  className,
  delay = 0,
  stagger = false,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets: HTMLElement | HTMLElement[] = stagger
      ? (Array.from(el.children) as HTMLElement[])
      : el;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      utils.set(targets, { opacity: 1, translateY: 0 });
      return;
    }

    utils.set(targets, { opacity: 0, translateY: 24 });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          animate(targets, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 750,
            delay: stagger ? animeStagger(90, { start: delay }) : delay,
            ease: "outCubic",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, stagger]);

  return createElement(as, { ref, className }, children);
}
