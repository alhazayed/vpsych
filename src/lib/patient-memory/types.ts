/**
 * Mission 4 — Long-Term Patient Memory types.
 *
 * Patients remember prior sessions, promises, medications, relationships,
 * life events, trauma, children, occupation, and future plans.
 * History is persisted — never regenerated.
 */

export const PATIENT_MEMORY_VERSION = "1.0.0" as const;

export const MEMORY_CATEGORIES = [
  "previous_session",
  "therapist_mistake",
  "promise",
  "medication",
  "relationship",
  "life_event",
  "trauma",
  "children",
  "occupation",
  "future_plan",
  "other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type MemorySource =
  | "transcript"
  | "session_summary"
  | "persona_seed"
  | "therapist_turn"
  | "compression";

export type MemoryEntry = {
  id: string;
  category: MemoryCategory;
  /** Durable fact — patient-perspective when possible. Never invent. */
  content: string;
  source: MemorySource;
  session_id: string | null;
  turn_index: number | null;
  /** 0–1; trauma/meds/children/promises stay high through compression. */
  salience: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  /** Entry ids merged into this one during compression. */
  compressed_from?: string[];
};

export type SessionMemorySummary = {
  session_id: string;
  started_at: string | null;
  ended_at: string | null;
  /** Short durable summary extracted from the real transcript. */
  summary: string;
  entry_ids: string[];
  themes: string[];
  created_at: string;
};

export type PatientMemoryStore = {
  version: typeof PATIENT_MEMORY_VERSION;
  therapist_id: string;
  avatar_id: string;
  persona_id?: string | null;
  longitudinal_group_id?: string | null;
  entries: MemoryEntry[];
  session_summaries: SessionMemorySummary[];
  compressed_count: number;
  updated_at: string;
};

export type MemoryRetrievalHit = {
  entry: MemoryEntry;
  score: number;
  reason: string;
};

export type MemoryRetrievalResult = {
  hits: MemoryRetrievalHit[];
  /** Prompt-ready block; empty string when nothing to recall. */
  promptBlock: string;
  /** Natural cue examples for the patient voice. */
  referenceCues: string[];
};

export type ExtractedCandidate = {
  category: MemoryCategory;
  content: string;
  salience: number;
  topics: string[];
  source: MemorySource;
  turn_index: number | null;
};

export type CompressResult = {
  store: PatientMemoryStore;
  removed: number;
  created: number;
};

export type SummarizeSessionInput = {
  sessionId: string;
  messages: Array<{ role: string; content: string; created_at?: string }>;
  startedAt?: string | null;
  endedAt?: string | null;
};

/** Soft caps — compression consolidates; facts are not discarded without merge. */
export const MEMORY_SOFT_CAP = 80;
export const MEMORY_HARD_CAP = 120;
export const MEMORY_RETRIEVAL_LIMIT = 12;
export const MEMORY_MAX_CONTENT_LENGTH = 280;
export const MEMORY_MAX_SUMMARY_LENGTH = 600;
