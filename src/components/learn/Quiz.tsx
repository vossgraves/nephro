"use client";

import { caseDifficultyLabel, type TeachingCase } from "@/lib/teaching-cases";
import { modalityLabel } from "@/lib/imaging-recognition";

/**
 * Phase "quiz": the learner answers each question once. Selecting an option
 * locks the answer, marks it correct/incorrect immediately, and reveals the
 * explanation (aria-live). "Next" commits the answer and advances.
 */
export function Quiz({
  teachingCase,
  questionIndex,
  answeredSoFar,
  selected,
  onSelect,
  onNext,
}: {
  teachingCase: TeachingCase;
  questionIndex: number;
  /** Answer indices committed by previous questions (0..questionIndex-1). */
  answeredSoFar: number[];
  /** Locked selection for the current question, or null before answering. */
  selected: number | null;
  onSelect: (optionIndex: number) => void;
  onNext: () => void;
}) {
  const questions = teachingCase.quiz;
  const question = questions[questionIndex];
  if (!question) return null;
  const isLast = questionIndex === questions.length - 1;
  const correctSoFar = answeredSoFar.filter(
    (answered, index) => answered === questions[index].answerIndex,
  ).length;
  const answered = selected !== null;

  return (
    <section
      aria-labelledby="learn-quiz-title"
      className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="learn-quiz-title" className="text-base font-semibold tracking-[-0.02em]">
          Check your understanding
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

      {/* Progress + running score */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Question {questionIndex + 1} of {questions.length}
        </p>
        <p className="text-xs text-muted" aria-live="polite">
          {answered
            ? `${correctSoFar + (selected === question.answerIndex ? 1 : 0)} of ${questionIndex + 1} correct`
            : `${correctSoFar} of ${questionIndex} answered correctly`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={questionIndex + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-label="Quiz progress"
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-inset)]"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <fieldset className="mt-5" disabled={answered}>
        <legend className="text-[15px] font-semibold leading-relaxed tracking-[-0.01em] text-text text-pretty">
          {question.question}
        </legend>
        <div className="mt-3 space-y-2" role="group" aria-label="Answer options">
          {question.options.map((option, optionIndex) => {
            const isCorrect = optionIndex === question.answerIndex;
            const isChosen = selected === optionIndex;
            let stateClass =
              "border-border bg-surface hover:border-[var(--border-strong)] text-text";
            let marker = String.fromCharCode(65 + optionIndex);
            if (answered) {
              if (isCorrect) {
                stateClass = "border-low/40 bg-low/15 text-text";
                marker = "✓";
              } else if (isChosen) {
                stateClass = "border-high/40 bg-high/10 text-text";
                marker = "✗";
              } else {
                stateClass = "border-border bg-surface opacity-55 text-muted";
              }
            }
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(optionIndex)}
                aria-pressed={isChosen}
                className={
                  "pressable flex w-full items-start gap-3 rounded-[calc(var(--radius-base)-2px)] border px-3.5 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                  stateClass
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold " +
                    (answered && isCorrect
                      ? "border-low bg-low text-white"
                      : answered && isChosen
                        ? "border-high bg-high text-white"
                        : "border-[var(--border-strong)] bg-surface text-muted")
                  }
                >
                  {marker}
                </span>
                <span className="text-pretty">{option}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {answered ? (
        <div className="mt-4 rounded-[calc(var(--radius-base)-2px)] border border-accent/30 bg-accent-soft/50 p-4" aria-live="polite">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-strong">
            {selected === question.answerIndex ? "Correct" : "Not quite"} — why it matters
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text text-pretty">{question.explanation}</p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">Pick an answer to see the explanation. Your choice locks in immediately.</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onNext}
          disabled={!answered}
          className="pressable rounded-[calc(var(--radius-base)-2px)] bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-[color:var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isLast ? "See your summary" : "Next question"}
        </button>
        <span className="text-xs text-muted">Answer every question to finish.</span>
      </div>
    </section>
  );
}

/** Phase "done": score summary with a per-question review of the learner's answers. */
export function QuizSummary({
  teachingCase,
  answers,
  onRetry,
  onBackToCases,
}: {
  teachingCase: TeachingCase;
  answers: number[];
  onRetry: () => void;
  onBackToCases: () => void;
}) {
  const questions = teachingCase.quiz;
  const score = answers.filter((answer, index) => answer === questions[index].answerIndex).length;
  const total = questions.length;
  const perfect = score === total;

  return (
    <section
      aria-labelledby="learn-summary-title"
      className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="learn-summary-title" className="text-base font-semibold tracking-[-0.02em]">
          Lesson complete
        </h2>
        <span className="rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium text-muted">
          {modalityLabel[teachingCase.modality]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">{teachingCase.title}</p>

      <div
        role="status"
        aria-live="polite"
        className="mt-5 rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 px-4 py-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Your score</p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
          {score}
          <span className="ml-1 text-sm font-medium text-muted">/ {total}</span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted text-pretty">
          {perfect
            ? "Every answer matched the teaching explanation. Replay the case or pick a fresh one to keep the habit fresh."
            : "A miss is a cue, not a grade: reread the explanation, replay the walkthrough, and try again. This page never records or reports your results anywhere."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {questions.map((question, questionIndex) => {
          const answered = answers[questionIndex];
          const isCorrect = answered === question.answerIndex;
          return (
            <div
              key={question.question}
              className={
                "rounded-[calc(var(--radius-base)-2px)] border p-4 " +
                (isCorrect ? "border-low/40 bg-low/10" : "border-high/40 bg-high/10")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-relaxed text-text text-pretty">{question.question}</p>
                <span
                  aria-hidden="true"
                  className={
                    "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                    (isCorrect ? "bg-low/30 text-emerald-700" : "bg-high/20 text-red-700")
                  }
                >
                  {isCorrect ? "Correct" : "Missed"}
                </span>
              </div>
              {!isCorrect ? (
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  You chose: <span className="font-medium text-text">{question.options[answered]}</span>
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Correct answer: <span className="font-medium text-text">{question.options[question.answerIndex]}</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-text text-pretty">{question.explanation}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted text-pretty">
        {teachingCase.disclaimer} Clinical interpretation requires formal training and context that this
        teaching page deliberately does not simulate.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="pressable rounded-[calc(var(--radius-base)-2px)] border border-border bg-surface px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Replay this case
        </button>
        <button
          type="button"
          onClick={onBackToCases}
          className="pressable rounded-[calc(var(--radius-base)-2px)] bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Choose another case
        </button>
      </div>
    </section>
  );
}