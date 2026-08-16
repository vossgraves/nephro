"use client";

import { useReducer } from "react";
import type { TeachingCase } from "@/lib/teaching-cases";
import CasePicker from "./CasePicker";
import Walkthrough from "./Walkthrough";
import { Quiz, QuizSummary } from "./Quiz";

/**
 * Learner workflow state machine.
 *
 * The flow is strictly typed as a discriminated union on `phase`:
 *   pick → walkthrough → quiz → done
 * `done` can return to `walkthrough` (replay) or `pick`. No stringly-typed
 * state anywhere: every transition is an explicit action handled by the
 * reducer below, and the exhaustiveness check in `assertNever` makes a
 * forgotten phase a compile error.
 */
export type LearnState =
  | { phase: "pick" }
  | { phase: "walkthrough"; caseId: string; stepIndex: number }
  | {
      phase: "quiz";
      caseId: string;
      questionIndex: number;
      /** Answer indices committed by questions before the current one. */
      answers: number[];
      /** Locked option index for the current question, or null. */
      selected: number | null;
    }
  | { phase: "done"; caseId: string; answers: number[] };

export type LearnAction =
  | { type: "pick-case"; caseId: string }
  | { type: "walkthrough-next" }
  | { type: "walkthrough-prev" }
  | { type: "walkthrough-start-quiz" }
  | { type: "quiz-select"; optionIndex: number }
  | { type: "quiz-next" }
  | { type: "retry-walkthrough" }
  | { type: "retry-quiz" }
  | { type: "back-to-cases" };

function assertNever(value: never): never {
  throw new Error(`Unreachable learn state: ${JSON.stringify(value)}`);
}

function learnReducer(cases: TeachingCase[]) {
  return function reduce(state: LearnState, action: LearnAction): LearnState {
    switch (state.phase) {
      case "pick": {
        if (action.type === "pick-case") {
          const teachingCase = cases.find((item) => item.id === action.caseId) ?? cases[0];
          if (!teachingCase) return state;
          return { phase: "walkthrough", caseId: teachingCase.id, stepIndex: 0 };
        }
        return state;
      }

      case "walkthrough": {
        switch (action.type) {
          case "walkthrough-next": {
            const lastIndex = cases.find((item) => item.id === state.caseId)?.guidedChecklist.length ?? 1;
            return {
              ...state,
              stepIndex: Math.min(state.stepIndex + 1, lastIndex - 1),
            };
          }
          case "walkthrough-prev":
            return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) };
          case "walkthrough-start-quiz":
            return { phase: "quiz", caseId: state.caseId, questionIndex: 0, answers: [], selected: null };
          default:
            return state;
        }
      }

      case "quiz": {
        switch (action.type) {
          case "quiz-select":
            // Answers lock on first selection: instant feedback must be stable.
            if (state.selected !== null) return state;
            return { ...state, selected: action.optionIndex };
          case "quiz-next": {
            if (state.selected === null) return state;
            const teachingCase = cases.find((item) => item.id === state.caseId);
            if (!teachingCase) return state;
            const answers = [...state.answers, state.selected];
            if (state.questionIndex + 1 < teachingCase.quiz.length) {
              return { ...state, questionIndex: state.questionIndex + 1, answers, selected: null };
            }
            return { phase: "done", caseId: state.caseId, answers };
          }
          case "retry-walkthrough":
            return { phase: "walkthrough", caseId: state.caseId, stepIndex: 0 };
          case "back-to-cases":
            return { phase: "pick" };
          default:
            return state;
        }
      }

      case "done": {
        switch (action.type) {
          case "retry-walkthrough":
            return { phase: "walkthrough", caseId: state.caseId, stepIndex: 0 };
          case "retry-quiz":
            return { phase: "quiz", caseId: state.caseId, questionIndex: 0, answers: [], selected: null };
          case "back-to-cases":
            return { phase: "pick" };
          default:
            return state;
        }
      }

      default:
        return assertNever(state);
    }
  };
}

/** Pure helper (exported for tests): how many of the committed answers match. */
export function scoreAnswers(teachingCase: TeachingCase, answers: number[]): number {
  return teachingCase.quiz.filter((question, index) => answers[index] === question.answerIndex).length;
}

export function LearnWorkflow({ cases }: { cases: TeachingCase[] }) {
  const [state, dispatch] = useReducer(learnReducer(cases), { phase: "pick" } satisfies LearnState);

  const teachingCase =
    state.phase !== "pick"
      ? (cases.find((item) => item.id === state.caseId) ?? cases[0])
      : undefined;

  switch (state.phase) {
    case "pick":
      return <CasePicker cases={cases} onSelect={(caseId) => dispatch({ type: "pick-case", caseId })} />;

    case "walkthrough":
      if (!teachingCase) return null;
      return (
        <Walkthrough
          teachingCase={teachingCase}
          stepIndex={state.stepIndex}
          onStepChange={(nextIndex) =>
            dispatch(
              nextIndex < state.stepIndex
                ? { type: "walkthrough-prev" }
                : { type: "walkthrough-next" },
            )
          }
          onStartQuiz={() => dispatch({ type: "walkthrough-start-quiz" })}
        />
      );

    case "quiz":
      if (!teachingCase) return null;
      return (
        <Quiz
          teachingCase={teachingCase}
          questionIndex={state.questionIndex}
          answeredSoFar={state.answers}
          selected={state.selected}
          onSelect={(optionIndex) => dispatch({ type: "quiz-select", optionIndex })}
          onNext={() => dispatch({ type: "quiz-next" })}
        />
      );

    case "done":
      if (!teachingCase) return null;
      return (
        <QuizSummary
          teachingCase={teachingCase}
          answers={state.answers}
          onRetry={() => dispatch({ type: "retry-walkthrough" })}
          onBackToCases={() => dispatch({ type: "back-to-cases" })}
        />
      );

    default:
      return assertNever(state);
  }
}

export default LearnWorkflow;