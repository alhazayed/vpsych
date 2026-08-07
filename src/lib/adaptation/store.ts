/**
 * Persist PatientAdaptationState inside case_memory.memory jsonb.
 * Best-effort — must never break the session path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatientAdaptationState } from "@/lib/adaptation/types";
import { ADAPTATION_VERSION } from "@/lib/adaptation/types";

export type CaseMemoryBlob = {
  turns?: unknown[];
  notes?: unknown[];
  scope?: string;
  patient_adaptation?: PatientAdaptationState;
  adaptation_version?: string;
  [key: string]: unknown;
};

export function embedAdaptationInMemory(
  existing: CaseMemoryBlob | null | undefined,
  state: PatientAdaptationState,
): CaseMemoryBlob {
  return {
    ...(existing ?? {}),
    scope: (existing?.scope as string) ?? "case_instance",
    turns: existing?.turns ?? [],
    notes: existing?.notes ?? [],
    patient_adaptation: state,
    adaptation_version: ADAPTATION_VERSION,
  };
}

export function extractAdaptationFromMemory(
  memory: unknown,
): PatientAdaptationState | null {
  if (!memory || typeof memory !== "object") return null;
  const blob = memory as CaseMemoryBlob;
  const state = blob.patient_adaptation;
  if (!state || typeof state !== "object") return null;
  if (!("rapport" in state) || !("trust" in state) || !("effects" in state)) {
    return null;
  }
  return state as PatientAdaptationState;
}

export async function loadAdaptationState(
  supabase: SupabaseClient,
  caseInstanceId: string | null | undefined,
): Promise<{
  state: PatientAdaptationState | null;
  raw: CaseMemoryBlob | null;
}> {
  if (!caseInstanceId) return { state: null, raw: null };
  const { data, error } = await supabase
    .from("case_memory")
    .select("memory")
    .eq("case_instance_id", caseInstanceId)
    .maybeSingle();
  if (error || !data) return { state: null, raw: null };
  const raw = (data.memory ?? {}) as CaseMemoryBlob;
  return { state: extractAdaptationFromMemory(raw), raw };
}

/**
 * Best-effort persist. Never throws — adaptation must not block replies.
 */
export async function saveAdaptationState(
  supabase: SupabaseClient,
  caseInstanceId: string | null | undefined,
  state: PatientAdaptationState,
  previousRaw?: CaseMemoryBlob | null,
): Promise<boolean> {
  if (!caseInstanceId) return false;
  const memory = embedAdaptationInMemory(previousRaw, state);
  const { error } = await supabase.from("case_memory").upsert(
    {
      case_instance_id: caseInstanceId,
      memory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "case_instance_id" },
  );
  if (error) {
    console.warn("[adaptation] case_memory save failed:", error.message);
    return false;
  }
  return true;
}
