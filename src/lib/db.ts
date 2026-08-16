import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

export function db(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export const isDbConfigured = () => Boolean(process.env.DATABASE_URL);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kidney_records (
  id bigserial PRIMARY KEY,
  patient_name text NOT NULL,
  age int NOT NULL,
  sex text NOT NULL,
  scr_mgdl double precision NOT NULL,
  uacr_mgg double precision NOT NULL,
  region text NOT NULL,
  egfr double precision NOT NULL,
  gfr_stage text NOT NULL,
  alb_stage text NOT NULL,
  kdigo_risk text NOT NULL,
  kfre_2yr double precision,
  kfre_5yr double precision,
  crcl double precision,
  guidance jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

export type RecordRow = {
  id: number;
  patient_name: string;
  age: number;
  sex: string;
  scr_mgdl: number;
  uacr_mgg: number;
  region: string;
  egfr: number;
  gfr_stage: string;
  alb_stage: string;
  kdigo_risk: string;
  kfre_2yr: number | null;
  kfre_5yr: number | null;
  crcl: number | null;
  guidance: string[];
  created_at: string;
};

async function ensureTable(sql: Sql) {
  await sql`${SCHEMA}`;
}

export async function listRecords(): Promise<RecordRow[]> {
  const sql = db();
  if (!sql) return [];
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT id, patient_name, age, sex, scr_mgdl, uacr_mgg, region, egfr, gfr_stage,
              alb_stage, kdigo_risk, kfre_2yr, kfre_5yr, crcl, guidance, created_at
       FROM kidney_records ORDER BY created_at DESC`;
    return rows as unknown as RecordRow[];
  } catch (error) {
    // Log the cause (Neon error text never contains the connection string) so
    // runtime failures are diagnosable instead of silently rendering empty.
    console.error("listRecords failed", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function insertRecord(r: Omit<RecordRow, "id" | "created_at">): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    await ensureTable(sql);
    await sql`INSERT INTO kidney_records (patient_name, age, sex, scr_mgdl, uacr_mgg, region, egfr,
        gfr_stage, alb_stage, kdigo_risk, kfre_2yr, kfre_5yr, crcl, guidance)
       VALUES (${r.patient_name}, ${r.age}, ${r.sex}, ${r.scr_mgdl}, ${r.uacr_mgg}, ${r.region},
        ${r.egfr}, ${r.gfr_stage}, ${r.alb_stage}, ${r.kdigo_risk}, ${r.kfre_2yr},
        ${r.kfre_5yr}, ${r.crcl}, ${JSON.stringify(r.guidance)})`;
    return true;
  } catch (error) {
    console.error("record mutation failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function deleteRecord(id: number): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  try {
    await sql`DELETE FROM kidney_records WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.error("record mutation failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
