/**
 * Memory Engine — factual + emotional episodic recall (Layers 3 + 13).
 */

import {
  HCE_MAX_EPISODIC,
  HCE_MAX_FACT_LENGTH,
  HCE_MAX_MEMORY_WRITES,
} from "@/lib/hce/config";
import type {
  EmotionalMemory,
  EpisodicMemory,
  GptTurnOutput,
  HceMemoryState,
  MemoryEngineOutput,
} from "@/lib/hce/types";

const HCE_MAX_EMOTIONAL = 24;

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

  const emotional_recall = state.emotional_episodic
    .slice(-6)
    .map((e) => `Felt ${e.feeling} when ${e.trigger} (turn ${e.turn})`);

  // Layer 3 — link current topics to prior emotional moments
  for (const em of state.emotional_episodic.slice(-10)) {
    if (topics.some((t) => em.trigger.toLowerCase().includes(t))) {
      emotional_recall.push(
        `When you mentioned something related to ${em.trigger}, it reminded me of feeling ${em.feeling}.`,
      );
    }
  }

  const relationship_summary = `Alliance ~${state.relationship.alliance}; trust ${state.internal.trust}; stage ${state.internal.alliance_stage}; layer ${state.disclosure_layer}`;
  const forbidden_repetition = state.episodic
    .slice(-6)
    .map((e) => e.fact)
    .filter((f) => f.length < 120);

  if (state.longitudinal?.emotional_carryover) {
    emotional_recall.push(`From prior sessions: ${state.longitudinal.emotional_carryover}`);
  }

  return {
    recalled_facts: recalled,
    emotional_recall,
    relationship_summary,
    topics_touched: topics,
    forbidden_repetition,
  };
}

export function applyMemoryWrites(
  state: HceMemoryState,
  writes: GptTurnOutput["memory_writes"],
  emotionalWrites: GptTurnOutput["emotional_memory_writes"],
  turnIndex: number,
  userMessage: string,
): HceMemoryState {
  const next = {
    ...state,
    episodic: [...state.episodic],
    emotional_episodic: [...state.emotional_episodic],
  };
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

  for (const ew of emotionalWrites ?? []) {
    if (!ew?.feeling || !ew?.trigger) continue;
    next.emotional_episodic.push({
      id: `em-${turnIndex}-${next.emotional_episodic.length}`,
      feeling: ew.feeling.slice(0, 80),
      trigger: ew.trigger.slice(0, 120),
      turn: turnIndex,
      intensity: ew.intensity ?? 5,
    });
  }

  if (next.episodic.length > HCE_MAX_EPISODIC) {
    next.episodic = next.episodic.slice(-HCE_MAX_EPISODIC);
  }
  if (next.emotional_episodic.length > HCE_MAX_EMOTIONAL) {
    next.emotional_episodic = next.emotional_episodic.slice(-HCE_MAX_EMOTIONAL);
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
    "father",
    "mother",
    "grandmother",
    "grandma",
    "parent",
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
  emotional: EmotionalMemory[],
): string {
  const facts =
    episodic.length === 0
      ? "No factual episodic memory yet."
      : episodic
          .slice(-8)
          .map((e) => `- ${e.fact}`)
          .join("\n");
  const feelings =
    emotional.length === 0
      ? ""
      : emotional
          .slice(-5)
          .map((e) => `- Felt ${e.feeling} re: ${e.trigger}`)
          .join("\n");
  return [facts, feelings ? `Emotional memory:\n${feelings}` : ""]
    .filter(Boolean)
    .join("\n");
}
