/**
 * Stage 7 — Curriculum & Expert Training Engine.
 *
 * Observes assessment + ACE/CGE. Teaches trainees. NEVER modifies the patient.
 */

export {
  EDUCATION_VERSION,
  EDUCATION_FRAMEWORK_VERSION,
} from "@/lib/education/types";
export type * from "@/lib/education/types";

export {
  EDUCATION_COMPETENCY_DEFINITIONS,
  educationCompetencyById,
  scoreEducationCompetencies,
  weightedEducationOverall,
} from "@/lib/education/competency-framework";

export {
  analyzeInterviewProcess,
  evaluateSession,
} from "@/lib/education/session-evaluation";

export {
  buildClinicalReasoningGraph,
  buildDiagnosticReasoningReport,
} from "@/lib/education/clinical-reasoning";

export {
  expertLevelFromAce,
  caseDifficultyForLevel,
  buildDifficultyProfile,
} from "@/lib/education/difficulty";

export {
  buildExpertFeedback,
  formatTeachingBrief,
} from "@/lib/education/feedback";

export { generateEducationCurriculum } from "@/lib/education/curriculum";
export type { EducationCurriculumPlan } from "@/lib/education/curriculum";

export {
  evaluateCertificationMilestone,
} from "@/lib/education/certification";
export type { MilestoneEvaluation } from "@/lib/education/certification";

export {
  projectLongitudinalLearning,
  simulateLearnerArc,
  milestoneRank,
} from "@/lib/education/progress";

export {
  buildEducationAnalytics,
  educationOverallFromProfile,
} from "@/lib/education/analytics";

export { buildTraineePortfolio } from "@/lib/education/portfolio";

export {
  microSkillsFor,
  teachingPlanFromFeedback,
} from "@/lib/education/teaching";

export {
  buildEducationSessionBundle,
  runEducationAfterAssessment,
} from "@/lib/education/session-bridge";
export type { EducationAdaptiveSummary } from "@/lib/education/session-bridge";
