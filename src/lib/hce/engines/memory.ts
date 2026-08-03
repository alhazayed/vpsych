/**
 * Memory Engine — episodic recall and validated writes.
 */

import {
  HCE_MAX_EPISODIC,
  HCE_MAX_FACT_LENGTH,
  HCE_MAX_MEMORY_WRITES,
} from "@/lib/hce/config";
import type {
  EpisodicMemory,
  GptTurnOutput,
  HceMemoryState,
  MemoryEngineOutput,
} from "@/lib/hce/types";

function sanitizeFact(value: string): string {
  return value.trim().slice(0, HCE_MAX_FACT_LENGTH);
}

export function memoryTick(
  state: HceMemoryState,
  userMessage: string,
): MemoryEngineOutput {
  const topics = extractTopics(userMessage);
  const recalled = state.episodic
    .slice(-12)
    .map((e) => e.fact)
    .filter(Boolean);

  const relationship_summary = `Alliance ~${state.relationship.alliance}; tone ${state.relationship.last_tone}; layer ${state.disclosure_layer}`;
  const forbidden_repetition = state.episodic
    .slice(-6)
    .map((e) => e.fact)
    .filter((f) => f.length < 120);

  return {
    recalled_facts: recalled,
    relationship_summary,
    topics_touched: topics,
    forbidden_repetition,
  };
}

export function applyMemoryWrites(
  state: HceMemoryState,
  writes: GptTurnOutput["memory_writes"],
  turnIndex: number,
  userMessage: string,
): HceMemoryState {
  const next = { ...state, episodic: [...state.episodic] };
  const topics = extractTopics(userMessage);

  if (writes?.length) {
    for (const w of writes.slice(0, HCE_MAX_MEMORY_WRITES)) {
      if (!w?.key || !w?.value) continue;
      const fact = sanitizeFact(`${w.key}: ${w.value}`);
      if (!fact) continue;
      next.episodic.push({
        id: `m-${turnIndex}-${next.episodic.length}`,
        fact,
        turn: turnIndex,
        topics,
      });
    }
  } else {
    const auto = sanitizeFact(userMessage);
    if (auto.length > 12) {
      next.episodic.push({
        id: `auto-${turnIndex}`,
        fact: `Therapist asked about: ${auto.slice(0, 100)}`,
        turn: turnIndex,
        topics,
      });
    }
  }

  if (next.episodic.length > HCE_MAX_EPISODIC) {
    next.episodic = next.episodic.slice(-HCE_MAX_EPISODIC);
  }

  return next;
}

function extractTopics(message: string): string[] {
  const lower = message.toLowerCase();
  const topics: string[] = [];
  const catalog = [
    "medication",
    "sleep",
    "work",
    "family",
    "grandmother",
    "grandma",
    "suicide",
    "death",
    "grief",
    "partner",
    "money",
    "anxiety",
    "mood",
    "appetite",
  ];
  for (const t of catalog) {
    if (lower.includes(t)) topics.push(t);
  }
  return topics;
}

export function summarizeEpisodicForPrompt(
  episodic: EpisodicMemory[],
): string {
  if (!episodic.length) return "No prior episodic memory yet.";
  return episodic
    .slice(-8)
    .map((e) => `- ${e.fact}`)
    .join("\n");
}
