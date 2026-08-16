/**
 * Always-visible educational safety banner for the /learn teaching workflow.
 * Rendered server-side in the page shell so it is present in every phase of
 * the learner state machine, including before JavaScript has loaded.
 */
export function SafetyBanner() {
  return (
    <aside
      role="note"
      className="rounded-[var(--radius-base)] border border-high/45 bg-high/10 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-high text-[11px] font-bold text-white"
        >
          !
        </span>
        <p className="text-[13px] leading-relaxed text-text text-pretty">
          <strong className="font-semibold">Educational content — not medical training, not diagnosis.</strong>{" "}
          These walkthroughs teach imaging structure and interpretation reasoning only. They contain no
          patient imagery, give no patient-specific advice, and do not qualify anyone to interpret scans.
          Real-world interpretation always requires formal training and qualified clinical review.
        </p>
      </div>
    </aside>
  );
}

export default SafetyBanner;