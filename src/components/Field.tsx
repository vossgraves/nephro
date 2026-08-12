import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  /** Validation message; replaces the hint and marks the field as invalid. */
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold tracking-[-0.01em] text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-[color:var(--very-high)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  // min-w-0 is required: flex items default to min-width:auto, which made the
  // number input + unit select overflow their card on narrow columns.
  "w-full min-w-0 rounded-[calc(var(--radius-base)-2px)] border border-border bg-[var(--surface-raised)] px-3 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] " +
  "outline-none transition-[color,border-color,box-shadow,background-color] duration-150 ease-out " +
  "hover:border-[var(--border-strong)] focus-visible:border-accent focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[color:var(--accent-soft)]";

/** Wrapper for a value input paired with a unit <select>. */
export function InputGroup({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-stretch gap-1.5">{children}</div>;
}

/** Unit dropdown beside a value input — shrinks instead of overflowing. */
export const unitSelectClass =
  "shrink-0 basis-[6.5rem] rounded-[calc(var(--radius-base)-2px)] border border-border bg-[var(--surface-raised)] " +
  "px-2 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none " +
  "transition-[color,border-color,box-shadow,background-color] duration-150 ease-out hover:border-[var(--border-strong)] " +
  "focus-visible:border-accent focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-[color:var(--accent-soft)]";

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[calc(var(--radius-base)+4px)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold tracking-[-0.02em]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-muted text-pretty">{description}</p> : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
