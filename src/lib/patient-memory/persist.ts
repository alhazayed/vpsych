/**
 * Persist / load Patient Long-Term Memory — DB preferred; in-memory fallback.
 * Best-effort: never throws to callers when tables are missing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMemoryStoreMemory,
  putMemoryStoreMemory,
} from "./memory-store";
import {
  emptyPatientMemoryStore,
  isPatientMemoryStore,
} from "./store";
import type { PatientMemoryStore } from "./types";

export type PersistMemoryResult = {
  ok: boolean;
  store: PatientMemoryStore;
  persisted: "database" | "memory";
  error?: string;
};

/**
 * Load memory for a therapist↔avatar dyad. Returns empty store when none.
 */
export async function loadPatientMemory(
  supabase: SupabaseClient | null | undefined,
  opts: {
    therapistId: string;
    avatarId: string;
    personaId?: string | null;
    longitudinalGroupId?: string | null;
  },
): Promise<PersistMemoryResult> {
  const fallback = (): PersistMemoryResult => {
    const cached = getMemoryStoreMemory(opts.therapistId, opts.avatarId);
    if (cached) {
      return { ok: true, store: cached, persisted: "memory" };
    }
    const empty = emptyPatientMemoryStore({
      therapistId: opts.therapistId,
      avatarId: opts.avatarId,
      personaId: opts.personaId,
      longitudinalGroupId: opts.longitudinalGroupId,
    });
    return { ok: true, store: empty, persisted: "memory" };
  };

  if (!supabase) return fallback();

  try {
    const { data, error } = await supabase
      .from("patient_long_term_memory")
      .select("memory, longitudinal_group_id")
      .eq("therapist_id", opts.therapistId)
      .eq("avatar_id", opts.avatarId)
      .maybeSingle();

    if (error) {
      // Table missing / RLS — degrade silently.
      console.warn("[patient-memory] load:", error.message);
      return fallback();
    }

    if (data?.memory && isPatientMemoryStore(data.memory)) {
      const store: PatientMemoryStore = {
        ...data.memory,
        therapist_id: opts.therapistId,
        avatar_id: opts.avatarId,
        longitudinal_group_id:
          data.longitudinal_group_id ??
          data.memory.longitudinal_group_id ??
          opts.longitudinalGroupId ??
          null,
      };
      putMemoryStoreMemory(store);
      return { ok: true, store, persisted: "database" };
    }

    return fallback();
  } catch (e) {
    console.warn(
      "[patient-memory] load error:",
      e instanceof Error ? e.message : e,
    );
    return fallback();
  }
}

/**
 * Upsert the full memory document. Prefer DB; always mirror to process memory.
 */
export async function savePatientMemory(
  supabase: SupabaseClient | null | undefined,
  store: PatientMemoryStore,
): Promise<PersistMemoryResult> {
  const mirrored = putMemoryStoreMemory(store);

  if (!supabase) {
    return { ok: true, store: mirrored, persisted: "memory" };
  }

  try {
    const row = {
      therapist_id: store.therapist_id,
      avatar_id: store.avatar_id,
      longitudinal_group_id: store.longitudinal_group_id ?? null,
      memory: store,
      entry_count: store.entries.length,
      compressed_count: store.compressed_count,
      updated_at: store.updated_at,
    };

    const { error } = await supabase
      .from("patient_long_term_memory")
      .upsert(row, { onConflict: "therapist_id,avatar_id" });

    if (error) {
      console.warn("[patient-memory] save:", error.message);
      return {
        ok: true,
        store: mirrored,
        persisted: "memory",
        error: error.message,
      };
    }

    return { ok: true, store: mirrored, persisted: "database" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[patient-memory] save error:", msg);
    return { ok: true, store: mirrored, persisted: "memory", error: msg };
  }
}
