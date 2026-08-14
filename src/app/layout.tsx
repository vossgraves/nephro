import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SplashGate from "@/components/SplashGate";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Renal Function Calculator | Validated CKD Assessment",
  description:
    "Open clinical calculator for CKD: CKD-EPI 2021 eGFR, KDIGO staging, and the 4-variable Kidney Failure Risk Equation. Published equations only — no AI, no black box.",
};

export const viewport: Viewport = {
  themeColor: "#fbfbfa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <SplashGate />
        <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:flex sm:items-center sm:gap-6 sm:px-6">
            <div className="flex items-center">
              <Link href="/" className="pressable flex shrink-0 items-center gap-2.5 font-semibold tracking-[-0.03em] text-slate-950">
                <span className="grid size-7 place-items-center rounded-[9px] bg-slate-950 text-white shadow-sm shadow-slate-900/20">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 3c3.5 0 6 2.6 6 6.2 0 4.6-3.4 8.4-6 11.8-2.6-3.4-6-7.2-6-11.8C6 5.6 8.5 3 12 3Z" />
                    <path d="M12 9.2v6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="hidden sm:inline">Renal Function</span>
                <span className="sm:hidden">Nephro</span>
              </Link>
              <div className="ml-auto hidden sm:block">
                <SiteNav />
              </div>
            </div>
            <div className="mt-2 sm:hidden">
              <SiteNav />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>

        <footer className="no-print border-t border-border bg-surface/80">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted sm:px-6 md:flex-row md:items-start md:justify-between">
            <p className="max-w-3xl text-pretty">
              <strong className="font-semibold text-text">Not a medical device.</strong> This tool implements published equations exactly as specified and shows its working. It does not diagnose, and it does not replace clinical judgement. Every result must be interpreted by a qualified clinician in the context of the individual patient.
            </p>
            <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Published equations · Visible working</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
