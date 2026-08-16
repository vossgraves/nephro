"use server";

import { deleteRecord, insertRecord, isDbConfigured } from "@/lib/db";

export type SaveRecordInput = {
  patientName: string;
  age: number;
  sex: string;
  scrMgDl: number;
  uacrMgG: number;
  region: string;
  egfr: number;
  gfrStage: string;
  albStage: string;
  kdigoRisk: string;
  kfre2yr: number | null;
  kfre5yr: number | null;
  crcl: number | null;
  guidance: string[];
};

export async function saveRecord(input: SaveRecordInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.patientName.trim()) return { ok: false, error: "Patient name is required." };
  if (!(input.age > 0) || !(input.scrMgDl > 0) || !(input.uacrMgG > 0))
    return { ok: false, error: "Age, creatinine, and uACR must be positive." };
  if (!isDbConfigured()) {
    return { ok: false, error: "Database not configured (DATABASE_URL missing)." };
  }
  const ok = await insertRecord({
    patient_name: input.patientName.trim(),
    age: input.age,
    sex: input.sex,
    scr_mgdl: input.scrMgDl,
    uacr_mgg: input.uacrMgG,
    region: input.region,
    egfr: input.egfr,
    gfr_stage: input.gfrStage,
    alb_stage: input.albStage,
    kdigo_risk: input.kdigoRisk,
    kfre_2yr: input.kfre2yr,
    kfre_5yr: input.kfre5yr,
    crcl: input.crcl,
    guidance: input.guidance,
  });
  return ok ? { ok: true } : { ok: false, error: "Could not save the record. The database write failed — try again later." };
}

export async function removeRecord(id: number): Promise<{ ok: boolean }> {
  return { ok: await deleteRecord(id) };
}
