/**
 * Persist multi-ledger events — DB RPC preferred, memory fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEducationalEvent,
  educationalEventToRpc,
  type EducationalEvent,
  type EducationalEventInput,
} from "@/lib/ledgers/education";
import {
  buildOperationalEvent,
  operationalEventToRpc,
  type OperationalEvent,
  type OperationalEventInput,
} from "@/lib/ledgers/operational";
import {
  appendCorrelationMemory,
  appendEducationalMemory,
  appendOperationalMemory,
} from "@/lib/ledgers/store";
import {
  buildCorrelation,
  type CrossLedgerRefs,
  type LedgerCorrelation,
} from "@/lib/ledgers/shared";

export async function recordOperationalEvent(
  supabase: SupabaseClient | null,
  input: OperationalEventInput,
): Promise<{ ok: boolean; event: OperationalEvent; persisted: "database" | "memory" }> {
  const event = buildOperationalEvent(input);
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("append_operational_event", {
        p_row: operationalEventToRpc(event),
      });
      if (!error && data) {
        return {
          ok: true,
          event: { ...event, id: String(data) },
          persisted: "database",
        };
      }
      if (error) console.warn("[operational-ledger]", error.message);
    } catch (e) {
      console.warn(
        "[operational-ledger]",
        e instanceof Error ? e.message : e,
      );
    }
  }
  try {
    return {
      ok: true,
      event: appendOperationalMemory(event),
      persisted: "memory",
    };
  } catch {
    return { ok: false, event, persisted: "memory" };
  }
}

export async function recordEducationalEvent(
  supabase: SupabaseClient | null,
  input: EducationalEventInput,
): Promise<{ ok: boolean; event: EducationalEvent; persisted: "database" | "memory" }> {
  const event = buildEducationalEvent(input);
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("append_educational_event", {
        p_row: educationalEventToRpc(event),
      });
      if (!error && data) {
        return {
          ok: true,
          event: { ...event, id: String(data) },
          persisted: "database",
        };
      }
      if (error) console.warn("[educational-ledger]", error.message);
    } catch (e) {
      console.warn(
        "[educational-ledger]",
        e instanceof Error ? e.message : e,
      );
    }
  }
  try {
    return {
      ok: true,
      event: appendEducationalMemory(event),
      persisted: "memory",
    };
  } catch {
    return { ok: false, event, persisted: "memory" };
  }
}

export async function recordCorrelation(
  supabase: SupabaseClient | null,
  refs: CrossLedgerRefs,
  correlationId?: string,
): Promise<{ ok: boolean; correlation: LedgerCorrelation; persisted: "database" | "memory" }> {
  const correlation = buildCorrelation(refs, correlationId);
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("link_ledger_correlation", {
        p_row: { ...correlation },
      });
      if (!error && data) {
        return {
          ok: true,
          correlation: { ...correlation, id: String(data) },
          persisted: "database",
        };
      }
      if (error) console.warn("[ledger-correlation]", error.message);
    } catch (e) {
      console.warn(
        "[ledger-correlation]",
        e instanceof Error ? e.message : e,
      );
    }
  }
  return {
    ok: true,
    correlation: appendCorrelationMemory(correlation),
    persisted: "memory",
  };
}
