/**
 * Stage 8 — Scientific Validation Platform.
 *
 * Observational research layer over sealed session observables.
 * Never modifies patient behaviour, cognition, or memory.
 *
 * Expert portal invite helpers remain available for /validation.
 */

export {
  VALIDATION_ACCESS_COOKIE,
  VALIDATION_ACCESS_MAX_AGE_SEC,
  accessCookieValueForCode,
  configuredInviteCodes,
  isValidAccessCookie,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/validation/invite";

export {
  VALIDATION_ALGORITHM_VERSION,
  VALIDATION_FORBIDDEN_WRITES,
  VALIDATION_FRAMEWORK_VERSION,
  VALIDATION_OWNERSHIP_RULE,
  VALIDATION_VERSION,
  buildValidationVersionLock,
} from "@/lib/validation/versions";

export type * from "@/lib/validation/types";
export {
  LONGITUDINAL_HORIZONS,
} from "@/lib/validation/types";

export {
  buildValidationDashboard,
  runValidationPipeline,
} from "@/lib/validation/engine";

export { scoreRealism, REALISM_WEIGHTS } from "@/lib/validation/realism";
export { scoreConsistency } from "@/lib/validation/consistency";
export {
  detectImpossibleTimeline,
  validateScenarioDsm,
} from "@/lib/validation/scenario-validator";
export {
  cohenKappa,
  computeAllInterRater,
  computeInterRater,
  icc1,
  percentAgreement,
  weightedAgreement,
} from "@/lib/validation/inter-rater";
export { scoreReliability } from "@/lib/validation/reliability";
export { evaluatePsychometrics } from "@/lib/validation/psychometric-engine";
export {
  GOLD_STANDARD_CASES,
  SYNTHETIC_BASELINE,
  distanceToGold,
  groundTruthScorecard,
} from "@/lib/validation/ground-truth";
export {
  HISTORICAL_SIMULATION_CORPUS,
  buildBenchmarkSuite,
  compareAgainstBenchmarks,
  sourcesCovered,
} from "@/lib/validation/clinical-benchmark";
export { buildQualityMetrics, QUALITY_METRIC_IDS } from "@/lib/validation/metrics";
export { buildAuditReports } from "@/lib/validation/audit";
export {
  anonymizeRun,
  buildFhirResearchBundle,
  buildResearchDatasetPackage,
  exportRunsCsv,
  researchExportJson,
} from "@/lib/validation/research-dataset";
export { buildPublicationSupport } from "@/lib/validation/publication";
export {
  evaluateLongitudinal,
  simulateLongitudinalCorpus,
} from "@/lib/validation/longitudinal";
export {
  assessmentObservablesFromScores,
  buildSessionObservables,
  clinicalObservablesFromSnapshot,
} from "@/lib/validation/from-observables";
export {
  clearValidationStoreForTests,
  getValidationRun,
  listExpertRatings,
  listValidationAuditLog,
  listValidationRuns,
  storeExpertRating,
  storeValidationRun,
} from "@/lib/validation/store";
export {
  buildExpertRatingOfflineCorpus,
  buildValidationOfflineCorpus,
} from "@/lib/validation/corpus";
export {
  runValidationAfterAssessment,
} from "@/lib/validation/session-bridge";
export type { ValidationBridgeResult } from "@/lib/validation/session-bridge";
