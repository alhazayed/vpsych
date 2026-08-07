/**
 * Emotion Engine public barrel (Mission 2).
 */

export { EMOTION_ENGINE_VERSION } from "@/lib/emotion/types";
export type {
  EmotionalVariables,
  EmotionVariableKey,
  TherapistIntervention,
  EmotionMode,
  EmotionTransition,
  EmotionState,
  EmotionExpression,
  EmotionTickInput,
  EmotionTickResult,
  EmotionInitInput,
} from "@/lib/emotion/types";
export { EMOTION_VARIABLE_KEYS } from "@/lib/emotion/types";

export {
  baselineForDisorder,
  inertiaForDisorder,
  DEFAULT_BASELINE,
} from "@/lib/emotion/baselines";

export {
  effectForIntervention,
  trustGatedDeltas,
  mergeDeltas,
} from "@/lib/emotion/interventions";

export {
  classifyTherapistIntervention,
  type ClassificationResult,
} from "@/lib/emotion/classify";

export {
  clampEmotion,
  clampVariables,
  applyDeltas,
  decayTowardBaseline,
  selectMode,
  initEmotionState,
  tickEmotion,
  parseEmotionState,
} from "@/lib/emotion/state-machine";

export {
  deriveExpression,
  computeOpenness,
  emotionSummary,
  expressionPromptBlock,
} from "@/lib/emotion/expression";

export {
  loadEmotionState,
  ensureEmotionState,
  saveEmotionState,
} from "@/lib/emotion/store";

export {
  processEmotionTurn,
  emotionSnapshot,
  type ProcessEmotionTurnInput,
  type ProcessEmotionTurnResult,
} from "@/lib/emotion/engine";
