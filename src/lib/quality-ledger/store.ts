/**
 * In-memory append-only Quality Ledger store (offline / pre-migration).
 * Mirrors DB immutability: no update or delete.
 */

import type { QualityLedgerEntry } from "@/lib/quality-ledger/types";

const ledgers: QualityLedgerEntry[] = [];
const byId = new Map<string, QualityLedgerEntry>();
const bySession = new Map<string, string>();

export function appendQualityLedgerMemory(
  entry: QualityLedgerEntry,
): QualityLedgerEntry {
  if (byId.has(entry.id)) {
    throw new Error(`Ledger ${entry.id} already exists (immutable)`);
  }
  if (
    entry.event_type === "assessment_completed" &&
    entry.session_id &&
    !entry.previous_ledger_id &&
    bySession.has(entry.session_id)
  ) {
    throw new Error(
      `Assessment ledger already exists for session ${entry.session_id}`,
    );
  }
  const sealed = Object.freeze({
    ...entry,
    scores: Object.freeze([...entry.scores]) as typeof entry.scores,
    snapshots: Object.freeze([...entry.snapshots]) as typeof entry.snapshots,
  }) as QualityLedgerEntry;
  ledgers.push(sealed);
  byId.set(sealed.id, sealed);
  if (
    sealed.event_type === "assessment_completed" &&
    sealed.session_id &&
    !sealed.previous_ledger_id
  ) {
    bySession.set(sealed.session_id, sealed.id);
  }
  return sealed;
}

export function getQualityLedger(id: string): QualityLedgerEntry | null {
  return byId.get(id) ?? null;
}

export function getQualityLedgerBySession(
  sessionId: string,
): QualityLedgerEntry | null {
  const id = bySession.get(sessionId);
  return id ? (byId.get(id) ?? null) : null;
}

export function listQualityLedgers(opts?: {
  limit?: number;
  learner_id?: string;
  institution_id?: string;
  diagnosis_slug?: string;
  event_type?: string;
}): QualityLedgerEntry[] {
  let rows = [...ledgers];
  if (opts?.learner_id) {
    rows = rows.filter((r) => r.learner_id === opts.learner_id);
  }
  if (opts?.institution_id) {
    rows = rows.filter((r) => r.institution_id === opts.institution_id);
  }
  if (opts?.diagnosis_slug) {
    rows = rows.filter((r) => r.diagnosis_slug === opts.diagnosis_slug);
  }
  if (opts?.event_type) {
    rows = rows.filter((r) => r.event_type === opts.event_type);
  }
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows.slice(0, opts?.limit ?? 500);
}

export function clearQualityLedgerMemoryForTests(): void {
  ledgers.length = 0;
  byId.clear();
  bySession.clear();
}

export function qualityLedgerMemoryCount(): number {
  return ledgers.length;
}
