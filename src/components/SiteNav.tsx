"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/calculator", label: "Calculator" },
  { href: "/tools", label: "Tools" },
  { href: "/imaging", label: "Imaging" },
  { href: "/records", label: "Records" },
  { href: "/methods", label: "Methods" },
] as const;

const FADE_PX = 18;

/**
 * Which edge of the scroll container is clipped: "start" flips into view when
 * the scroller is at the right end, "end" fades the right side. Labels fade
 * out gracefully instead of being cut off mid-glyph.
 */
type ScrollEdge = "none" | "start" | "end" | "both";

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function edgeMask(edge: ScrollEdge): string | undefined {
  switch (edge) {
    case "start":
      return `linear-gradient(90deg, transparent 0, black ${FADE_PX}px, black 100%)`;
    case "end":
      return `linear-gradient(90deg, black 0, black calc(100% - ${FADE_PX}px), transparent 100%)`;
    case "both":
      return `linear-gradient(90deg, transparent 0, black ${FADE_PX}px, black calc(100% - ${FADE_PX}px), transparent 100%)`;
    default:
      return undefined;
  }
}

export default function SiteNav() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<ScrollEdge>("none");

  useEffect(() => {
    const element = nav.current;
    const inner = content.current;
    if (!element || !inner || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const scrollable = element.scrollWidth > element.clientWidth + 1;
      if (!scrollable) {
        setEdge("none");
        return;
      }
      const atStart = element.scrollLeft <= 2;
      const atEnd = element.scrollLeft >= element.scrollWidth - element.clientWidth - 2;
      setEdge(atStart ? "end" : atEnd ? "start" : "both");
    };

    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(inner);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const mask = edgeMask(edge);

  return (
    <nav
      ref={nav}
      aria-label="Primary navigation"
      className="min-w-0 max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      <div ref={content} className="flex w-max items-stretch">
        {LINKS.map((link) => {
          const current = isCurrent(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={`pressable relative flex items-center px-3 py-2 text-[11px] font-semibold tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-3.5 sm:text-[13px] ${
                current ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              {link.label}
              {/* Hairline underline indicator — accent, 2px, animated on route change */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-accent transition-transform duration-300 ease-out ${
                  current ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}