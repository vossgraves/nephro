"use client";

/**
 * Submit button that asks for confirmation before an irreversible delete
 * (WCAG 3.3.4). Preventing default on the click cancels the form submission.
 */
export function ConfirmDeleteButton({ patientName }: { patientName: string }) {
  return (
    <button
      type="submit"
      aria-label={`Delete record for ${patientName}`}
      onClick={(event) => {
        if (!window.confirm(`Delete the record for ${patientName}? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
      className="no-print rounded-[var(--radius-base)] border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-red-500/50 hover:text-red-600"
    >
      Delete
    </button>
  );
}
