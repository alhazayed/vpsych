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
import { mergeCaseMemory } from "@/lib/case-memory";

type MemoryRow = {
  case_instance_id: string;
  memory: Record<string, unknown> | null;
};

export async function loadEmotionState(
  supabase: SupabaseClient,
  caseInstanceId: string,
): Promise<EmotionState | null> {
  return (await readEmotionState(supabase, caseInstanceId)).state;
}

async function readEmotionState(
  supabase: SupabaseClient,
  caseInstanceId: string,
): Promise<{ state: EmotionState | null; failed: boolean }> {
  try {
    const { data, error } = await supabase
      .from("case_memory")
      .select("case_instance_id, memory")
      .eq("case_instance_id", caseInstanceId)
      .maybeSingle();
    if (error) {
      console.warn("[emotion] load failed", { caseInstanceId, error: error.message });
      return { state: null, failed: true };
    }
    if (!data) return { state: null, failed: false };
    const row = data as MemoryRow;
    const mem = row.memory ?? {};
    return { state: parseEmotionState(mem.emotion), failed: false };
  } catch (err) {
    console.warn("[emotion] load threw", {
      caseInstanceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: null, failed: true };
  }
}

/**
 * Load existing emotion state or initialize from disorder prior and persist.
 * Returns null when the read fails (callers already treat null as
 * "emotion unavailable"), so a transient error never resets the stored state.
 */
export async function ensureEmotionState(
  supabase: SupabaseClient,
  opts: {
    caseInstanceId: string;
    sessionId: string;
    disorderSlug?: string | null;
  },
): Promise<EmotionState | null> {
  const loaded = await readEmotionState(supabase, opts.caseInstanceId);
  if (loaded.failed) return null;
  const existing = loaded.state;
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
  await saveEmotionState(supabase, opts.caseInstanceId, state);
  return state; // in-memory even if persist soft-fails
}

export async function saveEmotionState(
  supabase: SupabaseClient,
  caseInstanceId: string,
  state: EmotionState,
): Promise<boolean> {
  // Shared read-modify-write: merges `emotion` into the current blob and is
  // queued with the adaptation / mind-state saves for the same case.
  return mergeCaseMemory(supabase, caseInstanceId, "emotion", (current) => ({
    ...current,
    emotion: state,
  }));
}
