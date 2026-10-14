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
import { reportFailure } from "@/lib/ops/degradation";

export type PersistMemoryResult = {
  ok: boolean;
  store: PatientMemoryStore;
  persisted: "database" | "memory";
  error?: string;
  /**
   * The database row could not be read (error, or a stored document this
   * version does not recognise). Callers must not save over it: the store
   * returned is a stand-in, and saving it would replace the real memory.
   */
  loadFailed?: boolean;
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
  const fallback = (loadFailed = false): PersistMemoryResult => {
    const cached = getMemoryStoreMemory(opts.therapistId, opts.avatarId);
    if (cached) {
      return { ok: true, store: cached, persisted: "memory", loadFailed };
    }
    const empty = emptyPatientMemoryStore({
      therapistId: opts.therapistId,
      avatarId: opts.avatarId,
      personaId: opts.personaId,
      longitudinalGroupId: opts.longitudinalGroupId,
    });
    return { ok: true, store: empty, persisted: "memory", loadFailed };
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
      // Table missing / RLS / transient: degrade, and never save over the row.
      console.warn("[patient-memory] load failed", {
        therapistId: opts.therapistId,
        avatarId: opts.avatarId,
        error: error.message,
      });
      reportFailure("patient_memory_load_failed", {
        avatarId: opts.avatarId,
        code: error.code,
      });
      return fallback(true);
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

    if (data?.memory) {
      console.warn("[patient-memory] stored document not recognised; not saving over it", {
        therapistId: opts.therapistId,
        avatarId: opts.avatarId,
      });
      return fallback(true);
    }

    return fallback();
  } catch (e) {
    console.warn("[patient-memory] load threw", {
      therapistId: opts.therapistId,
      avatarId: opts.avatarId,
      error: e instanceof Error ? e.message : String(e),
    });
    return fallback(true);
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
