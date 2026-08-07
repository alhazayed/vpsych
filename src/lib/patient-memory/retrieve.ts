/**
 * Retrieve relevant long-term memories for the current therapist turn.
 */

import {
  MEMORY_RETRIEVAL_LIMIT,
  type MemoryCategory,
  type MemoryEntry,
  type MemoryRetrievalHit,
  type MemoryRetrievalResult,
  type PatientMemoryStore,
} from "./types";
import { formatMemoryPromptBlock, formatReferenceCues } from "./prompt";

const CATEGORY_BOOST: Record<MemoryCategory, number> = {
  trauma: 1.25,
  medication: 1.15,
  children: 1.15,
  promise: 1.2,
  therapist_mistake: 1.1,
  previous_session: 1.05,
  relationship: 1.0,
  life_event: 0.95,
  occupation: 0.9,
  future_plan: 0.9,
  other: 0.7,
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9\u0600-\u06ff]+/i)
      .filter((t) => t.length > 2),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) {
    if (b.has(t)) hit += 1;
  }
  return hit / Math.sqrt(a.size * b.size);
}

/**
 * Score and rank memory entries against the current therapist message.
 * Always prefers high-salience durable facts even without lexical overlap.
 */
export function retrieveMemories(
  store: PatientMemoryStore,
  query: string,
  opts?: { limit?: number; alwaysIncludeCategories?: MemoryCategory[] },
): MemoryRetrievalResult {
  const limit = opts?.limit ?? MEMORY_RETRIEVAL_LIMIT;
  const qTokens = tokenize(query);
  const always = new Set(
    opts?.alwaysIncludeCategories ?? [
      "trauma",
      "medication",
      "children",
      "promise",
    ],
  );

  const hits: MemoryRetrievalHit[] = [];

  for (const entry of store.entries) {
    const eTokens = tokenize(
      `${entry.content} ${entry.topics.join(" ")} ${entry.category}`,
    );
    const lexical = overlapScore(qTokens, eTokens);
    const boost = CATEGORY_BOOST[entry.category] ?? 1;
    const alwaysBonus = always.has(entry.category) ? 0.15 : 0;
    const recency =
      entry.session_id && store.session_summaries.length > 0
        ? 0.05 *
          Math.max(
            0,
            store.session_summaries.findIndex((s) => s.session_id === entry.session_id),
          )
        : 0;

    let score = lexical * 0.55 + entry.salience * 0.35 * boost + alwaysBonus + recency;

    // Keep sticky categories visible even on cold opens.
    if (lexical === 0 && always.has(entry.category) && entry.salience >= 0.8) {
      score = Math.max(score, 0.35 * boost);
    }

    if (score < 0.12) continue;

    const reason =
      lexical > 0.2
        ? `topic overlap with current turn (${entry.category})`
        : `high-salience ${entry.category} memory`;

    hits.push({ entry, score, reason });
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, limit);

  // Prior session summaries as soft context when query mentions past sessions.
  const priorCue =
    /\b(last|previous|before|remember|week|session)\b/i.test(query) ||
    top.some((h) => h.entry.category === "previous_session");

  const entries = top.map((h) => h.entry);
  if (priorCue && store.session_summaries.length > 0) {
    // Summaries already reflected via entry_ids; cues still useful.
  }

  return {
    hits: top,
    promptBlock: formatMemoryPromptBlock(entries, store.session_summaries.slice(-3)),
    referenceCues: formatReferenceCues(entries, store.session_summaries.slice(-2)),
  };
}

/** Convenience: pick entries only. */
export function selectMemoryEntries(
  store: PatientMemoryStore,
  query: string,
  limit = MEMORY_RETRIEVAL_LIMIT,
): MemoryEntry[] {
  return retrieveMemories(store, query, { limit }).hits.map((h) => h.entry);
}
