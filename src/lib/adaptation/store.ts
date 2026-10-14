/**
 * Persist PatientAdaptationState inside case_memory.memory jsonb.
 * Best-effort — must never break the session path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatientAdaptationState } from "@/lib/adaptation/types";
import { ADAPTATION_VERSION } from "@/lib/adaptation/types";
import { mergeCaseMemory } from "@/lib/case-memory";

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
  if (error) {
    console.warn("[adaptation] case_memory load failed", {
      caseInstanceId,
      error: error.message,
    });
    return { state: null, raw: null };
  }
  if (!data) return { state: null, raw: null };
  const raw = (data.memory ?? {}) as CaseMemoryBlob;
  return { state: extractAdaptationFromMemory(raw), raw };
}

/**
 * Best-effort persist. Never throws — adaptation must not block replies.
 *
 * Merges into the current case_memory row (see `mergeCaseMemory`) so a save
 * started early in the turn never reverts emotion or mind state saved later.
 * `alsoApply` adds other namespaces in the same write (e.g. a carried mind
 * state seed).
 */
export async function saveAdaptationState(
  supabase: SupabaseClient,
  caseInstanceId: string | null | undefined,
  state: PatientAdaptationState,
  alsoApply?: (memory: CaseMemoryBlob) => CaseMemoryBlob,
): Promise<boolean> {
  if (!caseInstanceId) return false;
  return mergeCaseMemory(supabase, caseInstanceId, "adaptation", (current) => {
    const withAdaptation = embedAdaptationInMemory(current as CaseMemoryBlob, state);
    return alsoApply ? alsoApply(withAdaptation) : withAdaptation;
  });
}
