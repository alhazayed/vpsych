/**
 * Session summarization — extract durable facts from the real transcript.
 * Does not regenerate or invent history.
 */

import { extractFromTranscript } from "./extract";
import {
  appendMemoryEntries,
  appendSessionSummary,
} from "./store";
import {
  MEMORY_MAX_SUMMARY_LENGTH,
  type PatientMemoryStore,
  type SessionMemorySummary,
  type SummarizeSessionInput,
} from "./types";

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Build a short durable summary strictly from extracted transcript facts.
 * If nothing extractable, returns a minimal attendance note — never invents
 * clinical content.
 */
export function buildSessionSummaryText(
  messages: Array<{ role: string; content: string }>,
  entryContents: string[],
): { summary: string; themes: string[] } {
  const themes = [
    ...new Set(
      extractFromTranscript(messages).flatMap((c) => c.topics),
    ),
  ].slice(0, 8);

  if (entryContents.length === 0) {
    const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
    return {
      summary: clip(
        `Session with ${turns.length} turns. No durable clinical facts extracted.`,
        MEMORY_MAX_SUMMARY_LENGTH,
      ),
      themes,
    };
  }

  const bullets = entryContents.slice(0, 8).map((c) => `- ${c}`);
  return {
    summary: clip(
      `Remembered from this session:\n${bullets.join("\n")}`,
      MEMORY_MAX_SUMMARY_LENGTH,
    ),
    themes,
  };
}

/**
 * Summarize a completed session into the memory store.
 * Appends new extracted entries + one session summary (idempotent per session).
 */
export function summarizeSessionIntoStore(
  store: PatientMemoryStore,
  input: SummarizeSessionInput,
  opts?: { now?: string },
): {
  store: PatientMemoryStore;
  addedCount: number;
  summary: SessionMemorySummary | null;
} {
  const now = opts?.now ?? new Date().toISOString();

  if (store.session_summaries.some((s) => s.session_id === input.sessionId)) {
    return { store, addedCount: 0, summary: null };
  }

  const candidates = extractFromTranscript(input.messages);
  const { store: withEntries, added } = appendMemoryEntries(store, candidates, {
    sessionId: input.sessionId,
    now,
  });

  // Also persist a previous_session marker when the therapist asked about
  // something memorable, even if extract already covered it.
  const therapistAsks = input.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter((c) => c.length > 20);

  const askCandidates = therapistAsks.slice(0, 3).map((ask, i) => ({
    category: "previous_session" as const,
    content: `In session, therapist asked: ${clip(ask, 140)}`,
    salience: 0.68,
    topics: ["previous_session"],
    source: "session_summary" as const,
    turn_index: i,
  }));

  const { store: withAsks, added: addedAsks } = appendMemoryEntries(
    withEntries,
    askCandidates,
    { sessionId: input.sessionId, now },
  );

  const allAdded = [...added, ...addedAsks];
  const { summary, themes } = buildSessionSummaryText(
    input.messages,
    allAdded.map((e) => e.content),
  );

  const sessionSummary: SessionMemorySummary = {
    session_id: input.sessionId,
    started_at: input.startedAt ?? null,
    ended_at: input.endedAt ?? null,
    summary,
    entry_ids: allAdded.map((e) => e.id),
    themes,
    created_at: now,
  };

  const next = appendSessionSummary(withAsks, sessionSummary);
  return { store: next, addedCount: allAdded.length, summary: sessionSummary };
}
