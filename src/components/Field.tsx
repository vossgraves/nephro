import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2 text-sm " +
  "outline-none transition-colors focus-visible:border-primary " +
  "focus-visible:ring-2 focus-visible:ring-primary/30";

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
