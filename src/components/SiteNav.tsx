"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/calculator", label: "Calculator" },
  { href: "/tools", label: "Tools" },
  { href: "/imaging", label: "Imaging" },
  { href: "/records", label: "Records" },
  { href: "/methods", label: "Methods" },
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="min-w-0 max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max items-center gap-1 rounded-[calc(var(--radius-base)+2px)] border border-slate-200/80 bg-slate-50/75 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {LINKS.map((link) => {
          const current = isCurrent(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={`pressable rounded-[calc(var(--radius-base)-2px)] px-2 py-1.5 text-[11px] font-semibold tracking-[-0.01em] sm:px-3 sm:text-sm ${
                current
                  ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                  : "text-slate-500 hover:bg-white/75 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
