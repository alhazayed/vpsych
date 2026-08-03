/**
 * HCE state hydration and persistence on case_memory.
 */

import type { CaseMemoryRow, HceMemoryState } from "@/lib/hce/types";
import { HCE_MEMORY_SCHEMA_VERSION } from "@/lib/hce/types";

export function defaultHceState(): HceMemoryState {
  return {
    schema_version: HCE_MEMORY_SCHEMA_VERSION,
    episodic: [],
    relationship: { alliance: 50, last_tone: "neutral" },
    disclosed: [],
    disclosure_layer: 1,
    safety: { si_assessed: false, level: "none" },
    emotion: {
      primary: "neutral",
      intensity: 4,
      congruence: "guarded",
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
    relationship: { ...base.relationship, ...h.relationship },
    safety: { ...base.safety, ...h.safety },
    emotion: { ...base.emotion, ...h.emotion },
    environment: { ...base.environment, ...h.environment },
    behavior: { ...base.behavior, ...h.behavior },
    episodic: Array.isArray(h.episodic) ? h.episodic : base.episodic,
    disclosed: Array.isArray(h.disclosed) ? h.disclosed : base.disclosed,
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
