import Link from "next/link";
import { isDbConfigured, listRecords, type RecordRow } from "@/lib/db";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { removeRecord } from "./actions";

function exportCsv(records: RecordRow[]) {
  const header = ["patient", "age", "sex", "egfr", "gfr_stage", "alb_stage", "kdigo_risk", "kfre_2yr", "kfre_5yr", "crcl", "created_at"];
  const lines = records.map((r) =>
    [
      `"${r.patient_name.replace(/"/g, '""')}"`,
      r.age,
      r.sex,
      r.egfr.toFixed(1),
      r.gfr_stage,
      r.alb_stage,
      r.kdigo_risk,
      r.kfre_2yr !== null ? (r.kfre_2yr * 100).toFixed(1) : "",
      r.kfre_5yr !== null ? (r.kfre_5yr * 100).toFixed(1) : "",
      r.crcl !== null ? r.crcl.toFixed(1) : "",
      new Date(r.created_at).toISOString(),
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default async function RecordsPage() {
  const records = await listRecords();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient records</h1>
          <p className="mt-1 text-sm text-muted">
            Saved assessments from the calculator, stored in Neon (Postgres).{" "}
            <Link href="/calculator" className="text-primary underline underline-offset-2">
              Run an assessment
            </Link>
            .
          </p>
        </div>
        {records.length > 0 ? (
          <button
            type="button"
            className="pressable rounded-[calc(var(--radius-base)-2px)] border border-border bg-bg/60 px-3 py-2 text-xs font-semibold transition-colors hover:border-accent"
            onClick={() => {
              const blob = new Blob([exportCsv(records)], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `nephro-records-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV ({records.length})
          </button>
        ) : null}
      </div>

      {!isDbConfigured() ? (
        <div className="rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface p-6">
          <h2 className="font-semibold">Database not connected</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Records are persisted to Neon. Set the <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs">DATABASE_URL</code>{" "}
            environment variable (e.g. <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs">postgres://…@…neon.tech/…?sslmode=require</code>)
            and the table is created automatically on first use. The calculator still works fully
            without it — saving is simply disabled.
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-[calc(var(--radius-base)+2px)] border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm font-medium">No records yet</p>
          <p className="mt-1 text-sm text-muted">
            Assessments you save in the calculator will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[calc(var(--radius-base)+2px)] border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Saved kidney assessments</caption>
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Patient</th>
                <th scope="col" className="px-4 py-3 font-medium">Age / sex</th>
                <th scope="col" className="px-4 py-3 font-medium">eGFR</th>
                <th scope="col" className="px-4 py-3 font-medium">Stage</th>
                <th scope="col" className="px-4 py-3 font-medium">KFRE 5-yr</th>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-bg/50">
                  <td className="px-4 py-3 font-medium">{rec.patient_name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {rec.age} / {rec.sex}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {rec.egfr.toFixed(1)}{" "}
                    <span className="text-xs text-muted">mL/min/1.73m²</span>
                  </td>
                  <td className="px-4 py-3">
                    {rec.gfr_stage}
                    {rec.alb_stage}{" "}
                    <span className="text-xs text-muted">{rec.kdigo_risk}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {rec.kfre_5yr !== null ? `${(rec.kfre_5yr * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {new Date(rec.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async () => {
                        "use server";
                        await removeRecord(rec.id);
                      }}
                    >
                      <ConfirmDeleteButton patientName={rec.patient_name} />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
