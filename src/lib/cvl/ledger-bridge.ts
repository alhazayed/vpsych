/**
 * Seal Clinical Fidelity Level into the Quality Ledger when available.
 * Never invents ledger scores — only records CFL provenance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CflRecord } from "@/lib/cvl/types";
import { buildQualityLedgerEntry } from "@/lib/quality-ledger/engine";
import { persistQualityLedger } from "@/lib/quality-ledger/persist";

export type CvlLedgerSeal = {
  ok: boolean;
  ledger_ref: string | null;
  persisted: "database" | "memory" | "deferred";
  note: string;
};

export function cflLedgerPayload(cfl: CflRecord): Record<string, unknown> {
  return {
    event_type: "cvl_cfl_assigned",
    case_ref: cfl.case_ref,
    disorder_slug: cfl.disorder_slug,
    level: cfl.level,
    rationale: cfl.rationale,
    evidence_refs: cfl.evidence_refs,
    metrics: cfl.metrics,
    human_approved: cfl.human_approved,
    is_fabricated: false,
    source: "cvl",
  };
}

/**
 * Soft seal — returns a deterministic ref without requiring DB.
 * Prefer `sealCflToQualityLedgerAsync` from admin routes.
 */
export function sealCflToQualityLedger(cfl: CflRecord): CvlLedgerSeal {
  const ref = `cvl-cfl:${cfl.case_ref}:${cfl.level}:${cfl.computed_at}`;
  return {
    ok: true,
    ledger_ref: ref,
    persisted: "deferred",
    note: cfl.human_approved
      ? "CFL seal ready for Quality Ledger append (human-approved)."
      : "CFL computed — human approval required before research claims.",
  };
}

/** Append CFL provenance to Quality Ledger (best-effort). */
export async function sealCflToQualityLedgerAsync(
  supabase: SupabaseClient | null,
  cfl: CflRecord,
): Promise<CvlLedgerSeal> {
  const soft = sealCflToQualityLedger(cfl);
  try {
    const entry = buildQualityLedgerEntry({
      event_type: "cvl_cfl_assigned",
      diagnosis_slug: cfl.disorder_slug,
      assessment_id: `cvl-cfl:${cfl.case_ref}`,
      metrics: {},
      evidence: cflLedgerPayload(cfl),
      payload: {
        ...cflLedgerPayload(cfl),
        rationale: cfl.rationale,
      },
      calculation_inputs: {
        cvl_version: "1.0.0",
        cfl_level: cfl.level,
        human_approved: cfl.human_approved,
      },
    });
    const result = await persistQualityLedger(supabase, entry);
    return {
      ok: result.ok,
      ledger_ref: result.ledger.id || soft.ledger_ref,
      persisted: result.persisted,
      note: cfl.human_approved
        ? `CFL sealed to Quality Ledger (${result.persisted}).`
        : "CFL stored — human approval still required before research claims.",
    };
  } catch (e) {
    return {
      ok: false,
      ledger_ref: soft.ledger_ref,
      persisted: "deferred",
      note: `Quality Ledger seal failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
