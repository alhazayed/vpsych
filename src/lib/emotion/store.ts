/**
 * Persist Emotion Engine state in case_memory.memory.emotion (jsonb sidecar).
 * Soft-fails when case_memory / service role is unavailable — sessions still run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  initEmotionState,
  parseEmotionState,
} from "@/lib/emotion/state-machine";
import type { EmotionState } from "@/lib/emotion/types";

type MemoryRow = {
  case_instance_id: string;
  memory: Record<string, unknown> | null;
};

export async function loadEmotionState(
  supabase: SupabaseClient,
  caseInstanceId: string,
): Promise<EmotionState | null> {
  try {
    const { data, error } = await supabase
      .from("case_memory")
      .select("case_instance_id, memory")
      .eq("case_instance_id", caseInstanceId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as MemoryRow;
    const mem = row.memory ?? {};
    return parseEmotionState(mem.emotion);
  } catch {
    return null;
  }
}

/**
 * Load existing emotion state or initialize from disorder prior and persist.
 */
export async function ensureEmotionState(
  supabase: SupabaseClient,
  opts: {
    caseInstanceId: string;
    sessionId: string;
    disorderSlug?: string | null;
  },
): Promise<EmotionState | null> {
  const existing = await loadEmotionState(supabase, opts.caseInstanceId);
  if (existing) {
    if (!existing.session_id) {
      existing.session_id = opts.sessionId;
    }
    return existing;
  }

  const state = initEmotionState({
    caseInstanceId: opts.caseInstanceId,
    sessionId: opts.sessionId,
    disorderSlug: opts.disorderSlug,
  });
  const saved = await saveEmotionState(supabase, opts.caseInstanceId, state);
  return saved ? state : state; // return in-memory even if persist soft-fails
}

export async function saveEmotionState(
  supabase: SupabaseClient,
  caseInstanceId: string,
  state: EmotionState,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("case_memory")
      .select("memory")
      .eq("case_instance_id", caseInstanceId)
      .maybeSingle();

    if (error) {
      console.warn("[emotion] load for save failed:", error.message);
      return false;
    }

    const prev =
      data && typeof data.memory === "object" && data.memory
        ? (data.memory as Record<string, unknown>)
        : {};

    const nextMemory = {
      ...prev,
      emotion: state,
    };

    if (!data) {
      const { error: insertErr } = await supabase.from("case_memory").insert({
        case_instance_id: caseInstanceId,
        memory: nextMemory,
      });
      if (insertErr) {
        console.warn("[emotion] insert failed:", insertErr.message);
        return false;
      }
      return true;
    }

    const { error: updateErr } = await supabase
      .from("case_memory")
      .update({ memory: nextMemory, updated_at: new Date().toISOString() })
      .eq("case_instance_id", caseInstanceId);

    if (updateErr) {
      console.warn("[emotion] update failed:", updateErr.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "[emotion] save exception:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
