/**
 * Mission 8 — Patient Adaptation Engine barrel.
 *
 * Rapport Model + Trust Model + Adaptation Engine.
 * Import from `@/lib/adaptation` only (not internal modules).
 */

export { ADAPTATION_VERSION } from "@/lib/adaptation/types";
export type {
  AdaptationDirective,
  AdaptationEffects,
  AdaptationTurnTrace,
  PatientAdaptationState,
  PatientStance,
  RapportState,
  TherapistBehaviourCue,
  TherapistTurnSignals,
  TreatmentArc,
  TrustState,
} from "@/lib/adaptation/types";

export {
  signalTherapistBehaviour,
  clamp01to100,
} from "@/lib/adaptation/signals";

export {
  createRapportState,
  updateRapport,
  carryRapportToNextSession,
} from "@/lib/adaptation/rapport";

export {
  createTrustState,
  updateTrust,
  carryTrustToNextSession,
} from "@/lib/adaptation/trust";

export {
  createAdaptationState,
  processTherapistTurn,
  beginNextSession,
  applyAdaptationEffects,
} from "@/lib/adaptation/engine";
export type { ProcessAdaptationResult } from "@/lib/adaptation/engine";

export {
  buildAdaptationDirective,
  formatAdaptationBlock,
} from "@/lib/adaptation/expression";

export {
  embedAdaptationInMemory,
  extractAdaptationFromMemory,
  loadAdaptationState,
  saveAdaptationState,
} from "@/lib/adaptation/store";
export type { CaseMemoryBlob } from "@/lib/adaptation/store";
