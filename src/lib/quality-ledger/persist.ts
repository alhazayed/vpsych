/**
 * Persist Quality Ledger — DB RPC preferred; memory fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildQualityLedgerEntry,
  ledgerEntryToRpcPayload,
} from "@/lib/quality-ledger/engine";
import { buildLedgerFromAssessment } from "@/lib/quality-ledger/from-assessment";
import type { LedgerFromAssessmentOpts } from "@/lib/quality-ledger/from-assessment";
import {
  appendQualityLedgerMemory,
  getQualityLedgerBySession,
  listQualityLedgers,
} from "@/lib/quality-ledger/store";
import type {
  QualityLedgerBuildInput,
  QualityLedgerEntry,
} from "@/lib/quality-ledger/types";
import { requestVqiRecalculation } from "@/lib/vqi/hooks";

export type PersistResult = {
  ok: boolean;
  ledger: QualityLedgerEntry;
  persisted: "database" | "memory";
  error?: string;
};

export async function persistQualityLedger(
  supabase: SupabaseClient | null,
  entry: QualityLedgerEntry,
): Promise<PersistResult> {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("append_quality_ledger", {
        p_row: ledgerEntryToRpcPayload(entry),
      });
      if (!error && data) {
        return {
          ok: true,
          ledger: { ...entry, id: String(data) },
          persisted: "database",
        };
      }
      // Unique violation / already exists — treat as success if memory/session known
      if (error?.code === "23505") {
        return {
          ok: true,
          ledger: entry,
          persisted: "database",
          error: "already_exists",
        };
      }
      console.warn("[quality-ledger] RPC append failed:", error?.message);
    } catch (e) {
      console.warn(
        "[quality-ledger] RPC error:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  try {
    const sealed = appendQualityLedgerMemory(entry);
    return { ok: true, ledger: sealed, persisted: "memory" };
  } catch (e) {
    // Idempotent: return existing session ledger
    if (entry.session_id) {
      const existing = getQualityLedgerBySession(entry.session_id);
      if (existing) {
        return {
          ok: true,
          ledger: existing,
          persisted: "memory",
          error: "already_exists",
        };
      }
    }
    return {
      ok: false,
      ledger: entry,
      persisted: "memory",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Seal ledger for a completed assessment (best-effort; never throws to callers).
 */
export async function sealAssessmentQualityLedger(
  supabase: SupabaseClient | null,
  opts: LedgerFromAssessmentOpts,
): Promise<PersistResult | null> {
  try {
    if (opts.sessionId) {
      const existing = getQualityLedgerBySession(opts.sessionId);
      if (existing) {
        return {
          ok: true,
          ledger: existing,
          persisted: "memory",
          error: "already_exists",
        };
      }
    }
    const entry = buildLedgerFromAssessment(opts);
    const result = await persistQualityLedger(supabase, entry);
    requestVqiRecalculation("assessment_completed", {
      entity_type: "assessment",
      entity_id: opts.sessionId,
      notes: `ledger:${result.ledger.id}`,
    });
    return result;
  } catch (e) {
    console.warn(
      "[quality-ledger] seal failed:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function appendCorrectionLedger(
  supabase: SupabaseClient | null,
  previous: QualityLedgerEntry,
  patch: Partial<QualityLedgerBuildInput> & {
    supersedes_reason: string;
  },
): Promise<PersistResult> {
  const next = buildQualityLedgerEntry({
    ...patch,
    event_type: "correction",
    previous_ledger_id: previous.id,
    supersedes_reason: patch.supersedes_reason,
    session_id: patch.session_id ?? previous.session_id,
    learner_id: patch.learner_id ?? previous.learner_id,
    metrics: patch.metrics ?? {
      vqi: previous.vqi != null ? { overall: previous.vqi } : undefined,
      cfi: previous.cfi != null ? { overall: previous.cfi } : undefined,
      eri: previous.eri != null ? { overall: previous.eri } : undefined,
      avi: previous.avi != null ? { overall: previous.avi } : undefined,
      ale: previous.ale != null ? { overall: previous.ale } : undefined,
      rrs: previous.rrs != null ? { overall: previous.rrs } : undefined,
    },
  });
  return persistQualityLedger(supabase, next);
}

export function loadOfflineLedgerCorpus(): QualityLedgerEntry[] {
  return listQualityLedgers({ limit: 2000 });
}
