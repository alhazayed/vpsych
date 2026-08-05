/**
 * Persist PatientMindState inside case_memory.memory jsonb.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatientMindState } from "@/lib/pme/types";
import { PME_VERSION } from "@/lib/pme/types";

export type CaseMemoryBlob = {
  turns?: unknown[];
  notes?: unknown[];
  scope?: string;
  patient_mind?: PatientMindState;
  pme_version?: string;
  [key: string]: unknown;
};

export function embedMindInMemory(
  existing: CaseMemoryBlob | null | undefined,
  mind: PatientMindState,
): CaseMemoryBlob {
  return {
    ...(existing ?? {}),
    scope: (existing?.scope as string) ?? "case_instance",
    turns: existing?.turns ?? [],
    notes: existing?.notes ?? [],
    patient_mind: mind,
    pme_version: PME_VERSION,
  };
}

export function extractMindFromMemory(
  memory: unknown,
): PatientMindState | null {
  if (!memory || typeof memory !== "object") return null;
  const blob = memory as CaseMemoryBlob;
  const mind = blob.patient_mind;
  if (!mind || typeof mind !== "object") return null;
  if (!("emotional_state" in mind) || !("relationship" in mind)) return null;
  return mind as PatientMindState;
}

export async function loadPatientMind(
  supabase: SupabaseClient,
  caseInstanceId: string | null | undefined,
): Promise<{ mind: PatientMindState | null; raw: CaseMemoryBlob | null }> {
  if (!caseInstanceId) return { mind: null, raw: null };
  const { data, error } = await supabase
    .from("case_memory")
    .select("memory, longitudinal_group_id")
    .eq("case_instance_id", caseInstanceId)
    .maybeSingle();
  if (error || !data) return { mind: null, raw: null };
  const raw = (data.memory ?? {}) as CaseMemoryBlob;
  const mind = extractMindFromMemory(raw);
  if (mind && data.longitudinal_group_id && !mind.longitudinal_group_id) {
    mind.longitudinal_group_id = String(data.longitudinal_group_id);
  }
  return { mind, raw };
}

/**
 * Best-effort persist. Never throws to callers — PME must not break sessions.
 */
export async function savePatientMind(
  supabase: SupabaseClient,
  caseInstanceId: string | null | undefined,
  mind: PatientMindState,
  previousRaw?: CaseMemoryBlob | null,
): Promise<boolean> {
  if (!caseInstanceId) return false;
  const memory = embedMindInMemory(previousRaw, mind);
  const { error } = await supabase
    .from("case_memory")
    .upsert(
      {
        case_instance_id: caseInstanceId,
        memory,
        longitudinal_group_id: mind.longitudinal_group_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_instance_id" },
    );
  if (error) {
    console.warn("[pme] case_memory save failed:", error.message);
    return false;
  }
  return true;
}
