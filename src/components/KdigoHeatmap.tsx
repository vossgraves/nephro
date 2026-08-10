import {
  kdigoRisk,
  type AlbStage,
  type GfrStage,
  type RiskLevel,
} from "@/lib/renal";

const GFR_ROWS: { stage: GfrStage; label: string }[] = [
  { stage: "G1", label: "G1 · ≥90" },
  { stage: "G2", label: "G2 · 60–89" },
  { stage: "G3a", label: "G3a · 45–59" },
  { stage: "G3b", label: "G3b · 30–44" },
  { stage: "G4", label: "G4 · 15–29" },
  { stage: "G5", label: "G5 · <15" },
];

const ALB_COLS: { stage: AlbStage; label: string }[] = [
  { stage: "A1", label: "A1 · <30" },
  { stage: "A2", label: "A2 · 30–300" },
  { stage: "A3", label: "A3 · >300" },
];

const FILL: Record<RiskLevel, string> = {
  low: "bg-low/45",
  moderate: "bg-moderate/50",
  high: "bg-high/50",
  "very-high": "bg-very-high/45",
};

/** KDIGO prognosis grid. Highlights the cell the patient actually falls in. */
export function KdigoHeatmap({ g, a }: { g?: GfrStage; a?: AlbStage }) {
  return (
    <figure className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-xs">
        <caption className="sr-only">
          KDIGO risk of adverse outcomes by GFR and albuminuria category
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-28 text-left font-medium text-muted">
              eGFR ↓ / uACR →
            </th>
            {ALB_COLS.map((c) => (
              <th key={c.stage} scope="col" className="p-1.5 font-medium text-muted">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GFR_ROWS.map((row) => (
            <tr key={row.stage}>
              <th scope="row" className="pr-2 text-left font-medium text-muted whitespace-nowrap">
                {row.label}
              </th>
              {ALB_COLS.map((col) => {
                const risk = kdigoRisk(row.stage, col.stage);
                const active = g === row.stage && a === col.stage;
                return (
                  <td
                    key={col.stage}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "rounded-[var(--radius-base)] p-2.5 font-medium",
                      FILL[risk],
                      active ? "ring-2 ring-text ring-offset-1 ring-offset-surface" : "",
                    ].join(" ")}
                  >
                    {active ? "This patient" : "\u00A0"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {(
          [
            ["low", "Low"],
            ["moderate", "Moderately increased"],
            ["high", "High"],
            ["very-high", "Very high"],
          ] as const
        ).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-sm ${FILL[k]}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
