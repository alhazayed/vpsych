/**
 * Mission 10 — Humanization Engine public barrel.
 */

export {
  isHumanizationGloballyEnabled,
  isHumanizationEnabledForSession,
} from "@/lib/humanization/config";
export { HUMANIZATION_CATALOG, ALL_BEHAVIOR_IDS } from "@/lib/humanization/catalog";
export { applyClinicalGates } from "@/lib/humanization/clinical-gates";
export { classifyTherapistMove } from "@/lib/humanization/classify-move";
export { buildHumanizationTurn, toClientHints } from "@/lib/humanization/layer";
export {
  mergeHumanizationFidelity,
  appendHumanizationReinforcement,
} from "@/lib/humanization/integrate";
export { emotionTick } from "@/lib/humanization/engines/emotion";
export { behaviorTick } from "@/lib/humanization/engines/behavior";
export { memoryTick } from "@/lib/humanization/engines/memory";
export { voiceTick } from "@/lib/humanization/engines/voice";
export type {
  HumanizationBehaviorId,
  HumanizationTurnPlan,
  HumanizationTurnInput,
  HumanizationClientHints,
  EmotionEngineOutput,
  BehaviorEngineOutput,
  MemoryEngineOutput,
  VoiceEngineOutput,
  AffectPrimary,
  TherapistMove,
} from "@/lib/humanization/types";
