/**
 * In-memory Patient Long-Term Memory store (offline / pre-migration / tests).
 * Mirrors DB semantics: append facts; no silent delete without compression merge.
 */

import type { PatientMemoryStore } from "./types";

const byDyad = new Map<string, PatientMemoryStore>();

export function dyadKey(therapistId: string, avatarId: string): string {
  return `${therapistId}::${avatarId}`;
}

export function getMemoryStoreMemory(
  therapistId: string,
  avatarId: string,
): PatientMemoryStore | null {
  return byDyad.get(dyadKey(therapistId, avatarId)) ?? null;
}

export function putMemoryStoreMemory(store: PatientMemoryStore): PatientMemoryStore {
  const frozen: PatientMemoryStore = {
    ...store,
    entries: store.entries.map((e) => ({ ...e })),
    session_summaries: store.session_summaries.map((s) => ({
      ...s,
      entry_ids: [...s.entry_ids],
      themes: [...s.themes],
    })),
  };
  byDyad.set(dyadKey(store.therapist_id, store.avatar_id), frozen);
  return frozen;
}

export function clearPatientMemoryMemoryForTests(): void {
  byDyad.clear();
}

export function patientMemoryMemoryCount(): number {
  return byDyad.size;
}

export function listMemoryStoresMemory(): PatientMemoryStore[] {
  return [...byDyad.values()];
}
