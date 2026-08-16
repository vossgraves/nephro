"use client";

import { caseDifficultyLabel, type TeachingCase } from "@/lib/teaching-cases";
import { modalityLabel } from "@/lib/imaging-recognition";

/**
 * Phase "pick": the learner chooses one of the authored teaching cases.
 * Pure data-driven rendering; no server interaction, so it hydrates from the
 * static prerender without changes.
 */
export function CasePicker({
  cases,
  onSelect,
}: {
  cases: TeachingCase[];
  onSelect: (caseId: string) => void;
}) {
  return (
    <section aria-labelledby="learn-case-picker-title">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="learn-case-picker-title" className="text-lg font-semibold tracking-[-0.02em]">
          Choose a teaching case
        </h2>
        <p className="text-xs leading-relaxed text-muted">{cases.length} cases · text-structural, no patient imagery</p>
      </div>

      <div className="mt-4 grid gap-4 min-[720px]:grid-cols-2 min-[1120px]:grid-cols-3">
        {cases.map((teachingCase, index) => (
          <article
            key={teachingCase.id}
            className="flex flex-col rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                Case {index + 1}
              </span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                  (teachingCase.difficulty === "intro"
                    ? "bg-low/25 text-emerald-700"
                    : teachingCase.difficulty === "intermediate"
                      ? "bg-moderate/30 text-yellow-800"
                      : "bg-high/15 text-red-800")
                }
              >
                {caseDifficultyLabel[teachingCase.difficulty]}
              </span>
              <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium text-muted">
                {modalityLabel[teachingCase.modality]}
              </span>
            </div>

            <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.015em] text-text text-pretty">
              {teachingCase.title}
            </h3>

            <ul className="mt-3 space-y-1.5">
              {teachingCase.learningPoints.slice(0, 3).map((point) => (
                <li key={point} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                  <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-[11px] leading-relaxed text-muted text-pretty">{teachingCase.disclaimer}</p>

            <button
              type="button"
              onClick={() => onSelect(teachingCase.id)}
              className="pressable mt-4 w-full rounded-[calc(var(--radius-base)-2px)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start guided walkthrough
            </button>
          </article>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted text-pretty">
        Every case follows the same loop: a guided interpretation checklist with explanations you reveal
        yourself, then a short quiz with instant feedback. There is no scorekeeping outside the lesson — the
        loop is for practice, not grading.
      </p>
    </section>
  );
}

export default CasePicker;