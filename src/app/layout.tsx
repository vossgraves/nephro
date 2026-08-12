import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <header className="no-print border-b border-border bg-surface/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <svg
                viewBox="0 0 24 24"
                className="size-6 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M12 3c3.5 0 6 2.6 6 6.2 0 4.6-3.4 8.4-6 11.8-2.6-3.4-6-7.2-6-11.8C6 5.6 8.5 3 12 3Z" />
                <path d="M12 9.2v6" strokeLinecap="round" />
              </svg>
              Renal Function
            </Link>
            <nav className="ml-auto flex items-center gap-0.5 text-xs sm:gap-1 sm:text-sm">
              <Link
                href="/"
                className="rounded-[var(--radius-base)] px-2 py-1.5 text-muted transition-colors hover:bg-bg hover:text-text sm:px-3"
              >
                Overview
              </Link>
              <Link
                href="/imaging"
                className="rounded-[var(--radius-base)] px-2 py-1.5 text-muted transition-colors hover:bg-bg hover:text-text sm:px-3"
              >
                Imaging
              </Link>
              <Link
                href="/records"
                className="rounded-[var(--radius-base)] px-2 py-1.5 text-muted transition-colors hover:bg-bg hover:text-text sm:px-3"
              >
                Records
              </Link>
              <Link
                href="/methods"
                className="rounded-[var(--radius-base)] px-2 py-1.5 text-muted transition-colors hover:bg-bg hover:text-text sm:px-3"
              >
                Methods
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>

        <footer className="no-print border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted sm:px-6">
            <p className="text-pretty">
              <strong className="font-semibold text-text">Not a medical device.</strong> This tool
              implements published equations exactly as specified and shows its working. It does
              not diagnose, and it does not replace clinical judgement. Every result must be
              interpreted by a qualified clinician in the context of the individual patient.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
