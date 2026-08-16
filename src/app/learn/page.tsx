import type { Metadata } from "next";
import { teachingCases } from "@/lib/teaching-cases";
import LearnWorkflow from "@/components/learn/LearnWorkflow";
import SafetyBanner from "@/components/learn/SafetyBanner";

export const metadata: Metadata = {
  title: "Learn | Guided Renal Imaging Teaching",
  description:
    "Guided educational walkthroughs of renal imaging interpretation: normal ultrasound anatomy, CT KUB reading for stone context, and cystic-vs-solid Bosniak-style reasoning. Educational content, not diagnosis.",
};

/**
 * /learn — a guided, clearly labelled educational teaching workflow.
 *
 * Server component shell: renders the always-visible safety banner and passes
 * the static case data into the client workflow. Nothing here is dynamic
 * (no searchParams, cookies, or data fetching), so the page prerenders
 * statically at build time and hydrates without change.
 */
export default function LearnPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>
          Learn · Renal imaging
        </p>
        <h1
          className="display-2 text-balance"
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 4vw, 3.25rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          Read a scan like a reader, not a guesser
        </h1>
        <div className="rule" aria-hidden="true" style={{ margin: "1.5rem 0 1.25rem" }} />
        <p
          className="text-pretty"
          style={{
            margin: 0,
            maxWidth: "62ch",
            fontSize: "15px",
            lineHeight: 1.55,
            letterSpacing: "-0.01em",
            color: "var(--muted)",
          }}
        >
          Three guided walkthroughs teach the <em>discipline</em> of looking at renal imaging: anatomy
          to name, technique to confirm, and reasoning to apply before anything is called a finding.
          Each case moves through a structured checklist, then a short quiz with instant explanations.
          This is teaching material, clearly labelled as such — it is not medical training, and it
          never produces a diagnosis.
        </p>
      </div>

      <SafetyBanner />

      <LearnWorkflow cases={teachingCases} />
    </div>
  );
}