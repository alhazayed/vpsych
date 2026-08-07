/**
 * Create / mutate PatientMemoryStore — append-only facts; never regenerate history.
 */

import {
  MEMORY_MAX_CONTENT_LENGTH,
  PATIENT_MEMORY_VERSION,
  type ExtractedCandidate,
  type MemoryEntry,
  type PatientMemoryStore,
  type SessionMemorySummary,
} from "./types";

export function emptyPatientMemoryStore(opts: {
  therapistId: string;
  avatarId: string;
  personaId?: string | null;
  longitudinalGroupId?: string | null;
  now?: string;
}): PatientMemoryStore {
  const now = opts.now ?? new Date().toISOString();
  return {
    version: PATIENT_MEMORY_VERSION,
    therapist_id: opts.therapistId,
    avatar_id: opts.avatarId,
    persona_id: opts.personaId ?? null,
    longitudinal_group_id: opts.longitudinalGroupId ?? null,
    entries: [],
    session_summaries: [],
    compressed_count: 0,
    updated_at: now,
  };
}

export function isPatientMemoryStore(value: unknown): value is PatientMemoryStore {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.therapist_id === "string" &&
    typeof v.avatar_id === "string" &&
    Array.isArray(v.entries) &&
    Array.isArray(v.session_summaries)
  );
}

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, MEMORY_MAX_CONTENT_LENGTH);
}

function contentKey(content: string): string {
  return normalizeContent(content).toLowerCase();
}

/** True when an equivalent fact already exists (exact / near-exact). */
export function hasEquivalentFact(
  store: PatientMemoryStore,
  content: string,
  category?: MemoryEntry["category"],
): boolean {
  const key = contentKey(content);
  if (!key) return true;
  return store.entries.some((e) => {
    if (category && e.category !== category) return false;
    const existing = contentKey(e.content);
    return existing === key || existing.includes(key) || key.includes(existing);
  });
}

export function makeMemoryEntryId(
  prefix: string,
  index: number,
  sessionId?: string | null,
): string {
  const sid = sessionId ? sessionId.slice(0, 8) : "nosess";
  return `${prefix}-${sid}-${index}-${Date.now().toString(36)}`;
}

/**
 * Append candidates that are not already present. Never overwrites existing facts.
 */
export function appendMemoryEntries(
  store: PatientMemoryStore,
  candidates: ExtractedCandidate[],
  opts?: { sessionId?: string | null; now?: string },
): { store: PatientMemoryStore; added: MemoryEntry[] } {
  const now = opts?.now ?? new Date().toISOString();
  const sessionId = opts?.sessionId ?? null;
  const entries = [...store.entries];
  const added: MemoryEntry[] = [];
  let i = entries.length;

  for (const c of candidates) {
    const content = normalizeContent(c.content);
    if (content.length < 8) continue;
    if (hasEquivalentFact({ ...store, entries }, content, c.category)) continue;

    const entry: MemoryEntry = {
      id: makeMemoryEntryId(c.category, i, sessionId),
      category: c.category,
      content,
      source: c.source,
      session_id: sessionId,
      turn_index: c.turn_index,
      salience: Math.max(0, Math.min(1, c.salience)),
      topics: [...new Set(c.topics.map((t) => t.toLowerCase().trim()).filter(Boolean))],
      created_at: now,
      updated_at: now,
    };
    entries.push(entry);
    added.push(entry);
    i += 1;
  }

  if (added.length === 0) {
    return { store, added: [] };
  }

  return {
    store: {
      ...store,
      entries,
      updated_at: now,
    },
    added,
  };
}

export function appendSessionSummary(
  store: PatientMemoryStore,
  summary: SessionMemorySummary,
): PatientMemoryStore {
  const existing = store.session_summaries.find(
    (s) => s.session_id === summary.session_id,
  );
  if (existing) {
    // Idempotent — do not regenerate; keep first persisted summary.
    return store;
  }
  return {
    ...store,
    session_summaries: [...store.session_summaries, summary],
    updated_at: summary.created_at,
  };
}
