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
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-[color:var(--very-high)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  // min-w-0 is required: flex items default to min-width:auto, which made the
  // number input + unit select overflow their card on narrow columns.
  "w-full min-w-0 rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2 text-sm " +
  "outline-none transition-[color,border-color,box-shadow] duration-150 ease-out " +
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

/** Wrapper for a value input paired with a unit <select>. */
export function InputGroup({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-stretch gap-1.5">{children}</div>;
}

/** Unit dropdown beside a value input — shrinks instead of overflowing. */
export const unitSelectClass =
  "shrink-0 basis-[6.5rem] rounded-[var(--radius-base)] border border-border bg-surface " +
  "px-2 py-2 text-sm outline-none transition-colors duration-150 ease-out " +
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

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
    <section className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface p-6">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted text-pretty">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
