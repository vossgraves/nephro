"use client";

/**
 * Client-side CSV download button. The CSV string is built server-side and
 * passed in serialized — server components can't hold onClick handlers.
 */
export function ExportCsvButton({ csv, count }: { csv: string; count: number }) {
  return (
    <button
      type="button"
      className="pressable no-print rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 px-3 py-2 text-xs font-semibold transition-colors hover:border-accent"
      onClick={() => {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nephro-records-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Export CSV ({count})
    </button>
  );
}
