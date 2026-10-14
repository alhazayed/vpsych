/**
 * Read-modify-write for `case_memory.memory`.
 *
 * Several engines keep their own namespace in the same jsonb blob (emotion,
 * patient_adaptation, clinical_intelligence). Writing a whole blob that was
 * read earlier in the turn silently reverts whatever another engine saved in
 * between, so every writer goes through here: it re-reads the current blob,
 * applies only its own change, and writes the result.
 *
 * Writes for the same case are queued within this server instance so a
 * fire-and-forget save is never overtaken by a later one. A failed read never
 * writes (it would replace real state with a blank blob); failures are logged
 * with the case id and the operation, never with clinical content.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CaseMemoryRecord = Record<string, unknown>;

const queues = new Map<string, Promise<unknown>>();

export function mergeCaseMemory(
  supabase: SupabaseClient,
  caseInstanceId: string,
  op: string,
  patch: (current: CaseMemoryRecord) => CaseMemoryRecord,
): Promise<boolean> {
  const previous = queues.get(caseInstanceId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => writeMerged(supabase, caseInstanceId, op, patch));
  queues.set(caseInstanceId, next);
  void next.finally(() => {
    if (queues.get(caseInstanceId) === next) queues.delete(caseInstanceId);
  });
  return next;
}

async function writeMerged(
  supabase: SupabaseClient,
  caseInstanceId: string,
  op: string,
  patch: (current: CaseMemoryRecord) => CaseMemoryRecord,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("case_memory")
      .select("memory")
      .eq("case_instance_id", caseInstanceId)
      .maybeSingle();
    if (error) {
      console.warn("[case-memory] read failed; not writing", {
        op,
        caseInstanceId,
        error: error.message,
      });
      return false;
    }
    const row = data as { memory?: unknown } | null;
    const current =
      row?.memory && typeof row.memory === "object"
        ? (row.memory as CaseMemoryRecord)
        : {};
    const memory = patch(current);
    const { error: writeErr } = await supabase.from("case_memory").upsert(
      {
        case_instance_id: caseInstanceId,
        memory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_instance_id" },
    );
    if (writeErr) {
      console.warn("[case-memory] write failed", {
        op,
        caseInstanceId,
        error: writeErr.message,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[case-memory] write threw", {
      op,
      caseInstanceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
