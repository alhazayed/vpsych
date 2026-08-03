/**
 * HCE state hydration and persistence on case_memory (v2).
 */

import type { CaseMemoryRow, HceMemoryState } from "@/lib/hce/types";
import {
  HCE_MEMORY_SCHEMA_VERSION,
  type EmotionVector,
} from "@/lib/hce/types";
import { defaultInternalState } from "@/lib/hce/engines/internal-state";

const DEFAULT_VECTOR: EmotionVector = {
  sadness: 40,
  anxiety: 35,
  anger: 10,
  hope: 30,
  fatigue: 35,
};

export function defaultHceState(): HceMemoryState {
  return {
    schema_version: HCE_MEMORY_SCHEMA_VERSION,
    episodic: [],
    emotional_episodic: [],
    relationship: { alliance: 50, last_tone: "neutral" },
    internal: defaultInternalState(),
    disclosed: [],
    disclosure_layer: 1,
    safety: { si_assessed: false, level: "none" },
    emotion: {
      primary: "neutral",
      intensity: 4,
      congruence: "guarded",
      vector: { ...DEFAULT_VECTOR },
    },
    environment: { fatigue: 0, phase: "opening" },
    behavior: {
      cooperation: 55,
      active_defense: null,
      speech_pace: "measured",
      turn_length_target: 40,
    },
  };
}

export function extractHceState(memoryRow: CaseMemoryRow | null): HceMemoryState {
  if (!memoryRow?.memory) return defaultHceState();
  const raw = memoryRow.memory.hce;
  if (!raw || typeof raw !== "object") return defaultHceState();
  const h = raw as Partial<HceMemoryState>;
  const base = defaultHceState();
  return {
    ...base,
    ...h,
    schema_version: HCE_MEMORY_SCHEMA_VERSION,
    relationship: { ...base.relationship, ...h.relationship },
    internal: { ...base.internal, ...h.internal },
    safety: { ...base.safety, ...h.safety },
    emotion: {
      ...base.emotion,
      ...h.emotion,
      vector: { ...base.emotion.vector, ...h.emotion?.vector },
    },
    environment: { ...base.environment, ...h.environment },
    behavior: { ...base.behavior, ...h.behavior },
    episodic: Array.isArray(h.episodic) ? h.episodic : base.episodic,
    emotional_episodic: Array.isArray(h.emotional_episodic)
      ? h.emotional_episodic
      : base.emotional_episodic,
    disclosed: Array.isArray(h.disclosed) ? h.disclosed : base.disclosed,
    longitudinal: h.longitudinal ?? base.longitudinal,
  };
}

export function mergeCaseMemory(
  existing: Record<string, unknown>,
  hceState: HceMemoryState,
): Record<string, unknown> {
  return {
    ...existing,
    hce: hceState,
    scope: existing.scope ?? "case_instance",
  };
}
