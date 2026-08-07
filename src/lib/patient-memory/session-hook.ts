/**
 * Session lifecycle hooks for Long-Term Patient Memory.
 * Best-effort and non-blocking — never prevent message/report persistence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { compressMemoryStore, needsCompression } from "./compress";
import { seedFromPersonaIdentity } from "./extract";
import { loadPatientMemory, savePatientMemory } from "./persist";
import { injectMemoryIntoSystemPrompt } from "./prompt";
import { retrieveMemories } from "./retrieve";
import { appendMemoryEntries } from "./store";
import { summarizeSessionIntoStore } from "./summarize";
import type {
  MemoryRetrievalResult,
  PatientMemoryStore,
} from "./types";

export type MemoryContextForTurn = {
  store: PatientMemoryStore;
  retrieval: MemoryRetrievalResult;
  /** System prompt with memory block injected (or original when empty). */
  systemPrompt: string;
};

/**
 * Load + retrieve memory for a live turn; seed persona facts once.
 */
export async function prepareMemoryForTurn(
  supabase: SupabaseClient | null | undefined,
  opts: {
    therapistId: string;
    avatarId: string;
    personaId?: string | null;
    longitudinalGroupId?: string | null;
    userMessage: string;
    systemPrompt: string;
    identity?: {
      occupation?: string | null;
      family_context?: string | null;
      living_situation?: string | null;
      display_name?: string | null;
      city?: string | null;
    } | null;
  },
): Promise<MemoryContextForTurn> {
  try {
    let { store } = await loadPatientMemory(supabase, {
      therapistId: opts.therapistId,
      avatarId: opts.avatarId,
      personaId: opts.personaId,
      longitudinalGroupId: opts.longitudinalGroupId,
    });

    if (opts.identity && store.entries.every((e) => e.source !== "persona_seed")) {
      const seeds = seedFromPersonaIdentity(opts.identity);
      const seeded = appendMemoryEntries(store, seeds);
      store = seeded.store;
      if (seeded.added.length > 0) {
        await savePatientMemory(supabase, store);
      }
    }

    const retrieval = retrieveMemories(store, opts.userMessage);
    const systemPrompt = injectMemoryIntoSystemPrompt(
      opts.systemPrompt,
      retrieval.promptBlock,
    );

    return { store, retrieval, systemPrompt };
  } catch (e) {
    console.warn(
      "[patient-memory] prepare turn:",
      e instanceof Error ? e.message : e,
    );
    return {
      store: {
        version: "1.0.0",
        therapist_id: opts.therapistId,
        avatar_id: opts.avatarId,
        entries: [],
        session_summaries: [],
        compressed_count: 0,
        updated_at: new Date().toISOString(),
      },
      retrieval: { hits: [], promptBlock: "", referenceCues: [] },
      systemPrompt: opts.systemPrompt,
    };
  }
}

/**
 * After a completed session: summarize transcript → persist → compress if needed.
 * Never throws.
 */
export async function runPatientMemoryAfterSession(
  supabase: SupabaseClient | null | undefined,
  opts: {
    therapistId: string;
    avatarId: string;
    sessionId: string;
    messages: Array<{ role: string; content: string; created_at?: string }>;
    startedAt?: string | null;
    endedAt?: string | null;
    personaId?: string | null;
    longitudinalGroupId?: string | null;
    identity?: {
      occupation?: string | null;
      family_context?: string | null;
      living_situation?: string | null;
    } | null;
  },
): Promise<{
  ok: boolean;
  addedCount: number;
  compressed: boolean;
  persisted: "database" | "memory" | "skipped";
  error?: string;
}> {
  try {
    let { store } = await loadPatientMemory(supabase, {
      therapistId: opts.therapistId,
      avatarId: opts.avatarId,
      personaId: opts.personaId,
      longitudinalGroupId: opts.longitudinalGroupId,
    });

    if (opts.identity) {
      const seeds = seedFromPersonaIdentity(opts.identity);
      store = appendMemoryEntries(store, seeds).store;
    }

    const summarized = summarizeSessionIntoStore(store, {
      sessionId: opts.sessionId,
      messages: opts.messages,
      startedAt: opts.startedAt,
      endedAt: opts.endedAt,
    });
    store = summarized.store;

    let compressed = false;
    if (needsCompression(store)) {
      const result = compressMemoryStore(store);
      store = result.store;
      compressed = result.removed > 0;
    }

    const saved = await savePatientMemory(supabase, store);
    return {
      ok: true,
      addedCount: summarized.addedCount,
      compressed,
      persisted: saved.persisted,
      error: saved.error,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[patient-memory] after session:", msg);
    return {
      ok: false,
      addedCount: 0,
      compressed: false,
      persisted: "skipped",
      error: msg,
    };
  }
}
