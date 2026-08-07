/**
 * Stage 9 — Supervisor AI platform.
 *
 * Evaluates therapists. Observes completed sessions. Educational only.
 * NEVER modifies patient behaviour, cognition, memory, emotion, adaptation,
 * case engine, clinical intelligence, or validation ownership.
 */

export {
  SUPERVISOR_VERSION,
  SUPERVISOR_FRAMEWORK_VERSION,
} from "@/lib/supervisor/types";
export type * from "@/lib/supervisor/types";

export {
  SUPERVISOR_FORBIDDEN_WRITES,
  SUPERVISOR_OWNERSHIP_RULE,
  buildSupervisorVersionLock,
} from "@/lib/supervisor/versions";

export {
  THERAPIST_SKILL_DEFINITIONS,
  COMPETENCY_LEVEL_ORDER,
  buildCompetencyProgression,
  levelFromScore,
  levelRank,
  nextLevel,
  skillDefinitionById,
  criteriaForNextLevel,
} from "@/lib/supervisor/competency-engine";

export {
  evaluateTherapistSkills,
  weightedTherapistOverall,
} from "@/lib/supervisor/therapist-evaluation";

export {
  detectModalities,
  recognizedFromCase,
} from "@/lib/supervisor/modality-detector";

export { buildSessionReview } from "@/lib/supervisor/session-review";
export { buildExpertReview } from "@/lib/supervisor/expert-review";

export {
  buildClinicalSupervisor,
  buildCommunicationSupervisor,
  buildPsychotherapySupervisor,
  buildRiskSupervisor,
  buildDsmSupervisor,
} from "@/lib/supervisor/domain-supervisors";

export { generateSupervisionFeedback } from "@/lib/supervisor/feedback-generator";
export { generateLearningRecommendations } from "@/lib/supervisor/learning-recommendations";
export { evaluateSupervisorCertification } from "@/lib/supervisor/certification-engine";
export {
  buildProgressSnapshot,
  buildProgressGraph,
} from "@/lib/supervisor/progress-engine";
export { buildSupervisorPortfolio } from "@/lib/supervisor/portfolio-engine";
export { buildReflectivePractice } from "@/lib/supervisor/reflective-practice";

export {
  runSupervisorEngine,
  buildSupervisorDashboard,
} from "@/lib/supervisor/engine";

export {
  runSupervisorAfterAssessment,
} from "@/lib/supervisor/session-bridge";
export type { SupervisorBridgeResult } from "@/lib/supervisor/session-bridge";

export {
  storeSupervisorBundle,
  getSupervisorBundle,
  listSupervisorBundlesForUser,
  clearSupervisorStoreForTests,
} from "@/lib/supervisor/store";
