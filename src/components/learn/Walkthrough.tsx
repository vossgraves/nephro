"use client";

import { useState } from "react";
import { caseDifficultyLabel, type TeachingCase } from "@/lib/teaching-cases";
import { modalityLabel } from "@/lib/imaging-recognition";

/**
 * Phase "walkthrough": a guided interpretation checklist. One step at a time;
 * each step has a prompt (what to look for) and an explanation the learner
 * reveals explicitly before moving on. Local reveal state is UI-only; the
 * step index itself lives in the workflow state machine.
 */
export function Walkthrough({
  teachingCase,
  stepIndex,
  onStepChange,
  onStartQuiz,
}: {
  teachingCase: TeachingCase;
  stepIndex: number;
  onStepChange: (nextIndex: number) => void;
  onStartQuiz: () => void;
}) {
  const checklist = teachingCase.guidedChecklist;
  const lastIndex = checklist.length - 1;
  const current = checklist[stepIndex];
  // `revealed[i]` marks whether the explanation for step i is showing.
  const [revealed, setRevealed] = useState<boolean[]>(() => checklist.map(() => false));

  const toggleReveal = () => {
    setRevealed((previous) => {
      const next = previous.slice();
      next[stepIndex] = !next[stepIndex];
      return next;
    });
  };

  return (
    <section aria-labelledby="learn-walkthrough-title" className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="learn-walkthrough-title" className="text-base font-semibold tracking-[-0.02em]">
          Guided interpretation
        </h2>
        <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium text-muted">
          {modalityLabel[teachingCase.modality]}
        </span>
        <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium text-muted">
          {caseDifficultyLabel[teachingCase.difficulty]}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">{teachingCase.title}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted text-pretty">{teachingCase.disclaimer}</p>

      {/* Step progress */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Step {stepIndex + 1} of {checklist.length}
          </p>
          <p className="text-xs text-muted">{Math.round(((stepIndex + 1) / checklist.length) * 100)}%</p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={checklist.length}
          aria-label="Walkthrough progress"
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-inset)]"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${((stepIndex + 1) / checklist.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Current step */}
      <article className="mt-5 rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Look for</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-relaxed tracking-[-0.01em] text-text text-pretty">
          {current.prompt}
        </p>

        <button
          type="button"
          onClick={toggleReveal}
          aria-expanded={revealed[stepIndex]}
          aria-controls={`learn-step-${stepIndex}-explanation`}
          className="pressable mt-4 rounded-[calc(var(--radius-base)-2px)] border border-border bg-surface px-3.5 py-2 text-[13px] font-semibold text-text transition-colors hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {revealed[stepIndex] ? "Hide explanation" : "Reveal explanation"}
        </button>

        {revealed[stepIndex] ? (
          <div
            id={`learn-step-${stepIndex}-explanation`}
            className="mt-4 rounded-[calc(var(--radius-base)-2px)] border border-accent/30 bg-accent-soft/50 p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-strong">Why it matters</p>
            <p className="mt-1.5 text-sm leading-relaxed text-text text-pretty">{current.explanation}</p>
          </div>
        ) : null}
      </article>

      {/* Step navigation */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
          className="pressable rounded-[calc(var(--radius-base)-2px)] border border-border bg-surface px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Previous
        </button>

        {stepIndex < lastIndex ? (
          <button
            type="button"
            onClick={() => onStepChange(stepIndex + 1)}
            className="pressable rounded-[calc(var(--radius-base)-2px)] bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Next step
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartQuiz}
            className="pressable rounded-[calc(var(--radius-base)-2px)] bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Checklist complete — start the quiz
          </button>
        )}

        <span className="text-xs text-muted">
          {revealed.filter(Boolean).length} of {checklist.length} explanations reviewed
        </span>
      </div>
    </section>
  );
}

export default Walkthrough;