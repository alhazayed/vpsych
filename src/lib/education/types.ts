/**
 * Stage 7 — Curriculum & Expert Training Engine contracts.
 *
 * Educational layer only: observe, evaluate, teach, recommend.
 * NEVER writes patient clinical_snapshot / case_memory / LTM / DecisionPlan.
 * Reuses ACE CompetencyId + Assessment ScoreEntry — does not fork weightedOverall.
 */

import type { CaseDifficulty, TherapyModality } from "@/lib/case-engine/types";
import type {
  AceProfession,
  AceTrainingLevel,
  AdaptiveCaseRequest,
  CoachFeedback,
  CompetencyId,
  LearnerProfile,
  LearningPath,
  PerformanceAnalytics,
} from "@/lib/ace/types";
import type { ScoreEntry } from "@/lib/types";

export const EDUCATION_VERSION = "1.0.0" as const;
export const EDUCATION_FRAMEWORK_VERSION = 1 as const;

/** Expert training learner bands (maps onto ACE levels + Case difficulty). */
export type ExpertLearnerLevel =
  | "medical_student"
  | "junior_resident"
  | "senior_resident"
  | "board_candidate"
  | "consultant"
  | "expert_psychiatrist";

/** Certification milestone bands — explainable, never inflated. */
export type CertificationMilestone =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "resident_ready"
  | "board_ready"
  | "consultant_level";

/**
 * Stage 7 educational competency domains.
 * Each maps to one or more ACE CompetencyIds (canonical scorer ownership).
 */
export type EducationCompetencyDomainId =
  | "diagnostic_interviewing"
  | "rapport"
  | "empathy"
  | "reflective_listening"
  | "question_quality"
  | "risk_assessment"
  | "mental_state_examination"
  | "diagnostic_formulation"
  | "differential_diagnosis"
  | "dsm_reasoning"
  | "icd_reasoning"
  | "treatment_planning"
  | "psychotherapy_skills"
  | "crisis_management"
  | "documentation_quality"
  | "professionalism"
  | "ethics"
  | "communication"
  | "clinical_judgement"
  | "session_structure";

export type EducationCompetencyDefinition = {
  id: EducationCompetencyDomainId;
  label: string;
  description: string;
  /** Weight within the Stage 7 framework (sum ≈ 100). */
  weight: number;
  /** ACE competencies this domain aggregates (ACE owns EMA persistence). */
  ace_competencies: CompetencyId[];
  category:
    | "interview"
    | "alliance"
    | "safety"
    | "diagnosis"
    | "treatment"
    | "professional"
    | "structure";
  version: typeof EDUCATION_FRAMEWORK_VERSION;
};

export type EducationCompetencyScore = {
  id: EducationCompetencyDomainId;
  score: number; // 0–100
  weight: number;
  ace_sources: Array<{ competency_id: CompetencyId; score: number }>;
  samples: number;
  trend: number;
};

/** Deterministic transcript/session interview evaluation (educational heuristic). */
export type InterviewProcessSignals = {
  open_question_count: number;
  closed_question_count: number;
  reflection_count: number;
  validation_count: number;
  summarization_count: number;
  psychoeducation_count: number;
  confrontation_count: number;
  advice_count: number;
  interruption_markers: number;
  leading_question_count: number;
  risk_inquiry_present: boolean;
  mse_probe_present: boolean;
  closure_present: boolean;
  therapist_turn_count: number;
  avg_therapist_turn_length: number;
};

export type SessionEvaluationFinding = {
  id: string;
  severity: "info" | "minor" | "major" | "critical";
  category: EducationCompetencyDomainId | "general";
  title: string;
  evidence: string;
  suggestion?: string;
};

export type SessionEvaluationReport = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  education_version: typeof EDUCATION_VERSION;
  session_id: string;
  overall_from_assessment: number;
  process: InterviewProcessSignals;
  findings: SessionEvaluationFinding[];
  coverage: {
    information_gathering: number;
    risk: number;
    mse: number;
    alliance: number;
    structure: number;
  };
  missed_opportunities: string[];
  strengths: string[];
  competency_scores: EducationCompetencyScore[];
};

export type ClinicalReasoningNodeKind =
  | "symptom"
  | "diagnosis"
  | "differential"
  | "risk"
  | "protective"
  | "function"
  | "timeline"
  | "stressor"
  | "trigger"
  | "trauma"
  | "medical"
  | "substance"
  | "family_history"
  | "evidence_gap";

export type ClinicalReasoningNode = {
  id: string;
  kind: ClinicalReasoningNodeKind;
  label: string;
  /** Grounded in case teaching / snapshot / assessment — never invented. */
  source: "case_snapshot" | "assessment" | "transcript" | "package_seed";
  confidence?: number;
};

export type ClinicalReasoningEdge = {
  from: string;
  to: string;
  relation:
    | "supports"
    | "suggests"
    | "contradicts"
    | "missing_for"
    | "raises"
    | "protects_against";
};

export type ClinicalReasoningGraph = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  nodes: ClinicalReasoningNode[];
  edges: ClinicalReasoningEdge[];
  narrative: string[];
};

export type DiagnosticReasoningReport = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  /** Teaching labels only — not a clinical diagnosis for a real patient. */
  supported_diagnoses: Array<{
    slug: string;
    name: string;
    confidence: number;
    supporting_evidence: string[];
  }>;
  alternative_diagnoses: Array<{
    slug: string;
    name: string;
    confidence: number;
    why: string;
  }>;
  missing_evidence: string[];
  contradictory_evidence: string[];
  next_interview_questions: string[];
  /** Explicit: educational SP case key — not trainee invention. */
  case_primary_slug: string | null;
};

export type DifficultyProfile = {
  learner_level: ExpertLearnerLevel;
  case_difficulty: CaseDifficulty;
  insight_bias: "high" | "moderate" | "partial" | "low" | "very_low";
  comorbidity_weight: number;
  diagnostic_ambiguity: "low" | "moderate" | "high" | "expert";
  deception_bias: "none" | "mild" | "moderate";
  memory_quality: "clear" | "mixed" | "vague";
  emotion_regulation_challenge: "low" | "moderate" | "high";
  therapy_response_complexity: "simple" | "mixed" | "resistant";
  adaptations: string[];
};

export type ExpertFeedbackReport = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  strengths: string[];
  weaknesses: string[];
  missed_opportunities: string[];
  risk_omissions: string[];
  diagnostic_gaps: string[];
  interview_gaps: string[];
  communication_analysis: string[];
  suggested_wording: Array<{ instead_of?: string; try: string; why: string }>;
  alternative_approaches: string[];
  priority_improvements: string[];
  evidence_based_references: string[];
  coach: CoachFeedback;
};

export type LongitudinalHorizon = 10 | 25 | 50 | 100;

export type LearningTrajectoryPoint = {
  sessions_completed: number;
  overall_ema: number;
  milestone: CertificationMilestone;
  plateau: boolean;
  regression: boolean;
  mastery_domains: EducationCompetencyDomainId[];
};

export type LongitudinalLearningReport = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  horizon: LongitudinalHorizon;
  points: LearningTrajectoryPoint[];
  current_milestone: CertificationMilestone;
  velocity: number;
  plateau_detected: boolean;
  regression_detected: boolean;
  mastery_count: number;
};

export type TraineePortfolio = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  learner_id: string;
  user_id: string;
  profession: AceProfession;
  training_level: AceTrainingLevel;
  expert_level: ExpertLearnerLevel;
  milestone: CertificationMilestone;
  cases_completed: number;
  diagnoses_practiced: string[];
  therapy_modalities: TherapyModality[];
  competencies: EducationCompetencyScore[];
  achievements: string[];
  weaknesses: EducationCompetencyDomainId[];
  learning_recommendations: string[];
  session_count: number;
  certifications: Array<{
    badge_slug: string;
    title: string;
    status: string;
  }>;
  updated_at: string;
};

export type EducationAnalyticsDashboard = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  competency_radar: Array<{ id: EducationCompetencyDomainId; score: number; weight: number }>;
  learning_velocity: number;
  risk_recognition_rate: number;
  diagnostic_accuracy_proxy: number;
  therapy_performance: number;
  alliance_quality: number;
  interview_completeness: number;
  mse_completeness: number;
  progress_trend: number;
  ace_analytics: PerformanceAnalytics | null;
};

export type EducationSessionBundle = {
  version: typeof EDUCATION_FRAMEWORK_VERSION;
  evaluation: SessionEvaluationReport;
  reasoning: ClinicalReasoningGraph;
  diagnostic: DiagnosticReasoningReport;
  feedback: ExpertFeedbackReport;
  difficulty: DifficultyProfile;
  next_case: AdaptiveCaseRequest | null;
  learning_path_summary: string[];
  milestone: CertificationMilestone;
};

export type EducationRunInput = {
  sessionId: string;
  userId: string;
  overall: number;
  items: ScoreEntry[];
  messages: Array<{ role: string; content: string }>;
  language?: string | null;
  diagnosisSlug?: string | null;
  narrative?: string | null;
  durationSec?: number;
  timeLimitSec?: number;
  /** Frozen case snapshot — read-only educational gold / teaching cues. */
  clinicalSnapshot?: {
    primary_diagnosis?: { slug: string; name: string; dsm5_code?: string | null; icd11_code?: string | null } | null;
    comorbidities?: Array<{ slug: string; name: string }>;
    clinical_core?: {
      symptom_profile?: Array<{ id: string; description: string; salience?: string }>;
      risk_profile?: Record<string, unknown>;
      protective_factors?: Array<{ id: string; label: string }>;
      disclosure_rules?: Array<{ topic: string }>;
      session_goals?: string[];
      ideal_approach?: string;
      mse?: Record<string, unknown> | null;
      formulation?: { patient_goals?: string[]; belief_system?: { core_beliefs?: Array<{ statement: string }> } } | null;
    } | null;
    clinical_teaching?: {
      differentials?: string[];
      rule_outs?: string[];
      teaching_points?: string[];
      common_mistakes?: string[];
      insight_expectation?: string;
      judgment_expectation?: string;
    } | null;
    difficulty?: CaseDifficulty;
    therapy_modality?: TherapyModality;
    /** Opaque teaching modifiers from case mint — numbers and strings allowed. */
    difficulty_modifiers?: Record<string, string | number>;
  } | null;
  learnerProfile?: LearnerProfile | null;
  aceCoach?: CoachFeedback | null;
  aceNextCase?: AdaptiveCaseRequest | null;
  aceLearningPath?: LearningPath | null;
};
