/**
 * Stage 9 — Supervisor AI platform contracts.
 *
 * Educational supervision of therapists. Observes completed sessions only.
 * NEVER writes clinical_snapshot / case_memory / LTM / DecisionPlan / patient prompts.
 * NEVER changes patient cognition, emotion, adaptation, case engine, or validation.
 * NEVER invents diagnoses or evidence — every claim must cite session events.
 */

import type { CompetencyId, LearnerProfile } from "@/lib/ace/types";
import type { TherapyModality } from "@/lib/case-engine/types";
import type {
  DiagnosticReasoningReport,
  EducationSessionBundle,
  ExpertFeedbackReport,
  SessionEvaluationReport,
} from "@/lib/education/types";
import type { ScoreEntry } from "@/lib/types";
import type {
  QualityMetricsBundle,
  ValidationRunResult,
} from "@/lib/validation/types";

export const SUPERVISOR_VERSION = "1.0.0" as const;
export const SUPERVISOR_FRAMEWORK_VERSION = 1 as const;

/** Dreyfus-style competency progression (Stage 9). */
export type CompetencyLevel =
  | "novice"
  | "advanced_beginner"
  | "competent"
  | "proficient"
  | "expert"
  | "master";

/** Supervision feedback depth bands. */
export type SupervisionBand =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "consultant"
  | "board";

/** Therapist evaluation dimensions — observable trainee behaviours. */
export type TherapistSkillId =
  | "rapport"
  | "alliance"
  | "empathy"
  | "active_listening"
  | "reflection"
  | "validation"
  | "open_questions"
  | "closed_questions"
  | "summarization"
  | "boundary_management"
  | "risk_assessment"
  | "diagnostic_reasoning"
  | "case_formulation"
  | "clinical_prioritization"
  | "professional_language"
  | "ethics"
  | "documentation"
  | "session_structure"
  | "treatment_planning"
  | "termination";

/**
 * Modalities the Supervisor may recognize from session evidence.
 * Recognition is observational — never forced onto the case.
 */
export type RecognizedModality =
  | "cbt"
  | "dbt"
  | "act"
  | "mi"
  | "psychodynamic"
  | "supportive"
  | "behavioral"
  | "solution_focused"
  | "family_therapy"
  | "trauma_focused"
  | "acceptance"
  | "schema_therapy"
  | "ipt"
  | "unknown";

export type SupervisorVersionLock = {
  supervisor_version: string;
  framework_version: number;
  computed_at: string;
};

export type EvidenceCitation = {
  source: "transcript" | "assessment" | "education" | "validation" | "case_teaching";
  /** Verbatim or paraphrased session event — never invented. */
  excerpt: string;
  skill?: TherapistSkillId;
  message_index?: number;
};

export type TherapistSkillScore = {
  id: TherapistSkillId;
  score: number; // 0–100
  level: CompetencyLevel;
  weight: number;
  evidence: EvidenceCitation[];
  notes: string[];
};

export type TherapistSkillDefinition = {
  id: TherapistSkillId;
  label: string;
  description: string;
  weight: number;
  category:
    | "alliance"
    | "communication"
    | "structure"
    | "safety"
    | "reasoning"
    | "professional"
    | "planning";
  /** ACE competencies this skill may aggregate when EMA present. */
  ace_competencies: CompetencyId[];
  observable_markers: string[];
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
};

export type ModalityDetection = {
  modality: RecognizedModality;
  confidence: number; // 0–1
  evidence: EvidenceCitation[];
  /** True when case snapshot modality matches recognition. */
  matches_case_modality: boolean;
};

export type SessionReviewReport = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  session_id: string;
  strengths: string[];
  missed_opportunities: string[];
  alternative_interventions: string[];
  supervisor_comments: string[];
  evidence: EvidenceCitation[];
  clinical_references: string[];
  dsm_references: string[];
  icd_references: string[];
  educational_notes: string[];
};

export type DomainSupervisorReport = {
  domain:
    | "clinical"
    | "communication"
    | "psychotherapy"
    | "risk"
    | "dsm";
  summary: string;
  findings: string[];
  recommendations: string[];
  evidence: EvidenceCitation[];
  severity: "info" | "minor" | "major" | "critical";
};

export type ExpertReviewReport = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  overall_impression: string;
  skill_scores: TherapistSkillScore[];
  modalities_observed: ModalityDetection[];
  session_review: SessionReviewReport;
  domain_reports: DomainSupervisorReport[];
  /** Stage 8 quality metrics when available — observational grounding. */
  validation_metrics: Partial<QualityMetricsBundle> | null;
};

export type BandedFeedback = {
  band: SupervisionBand;
  summary: string;
  strengths: string[];
  growth_areas: string[];
  expectations: string[];
  next_actions: string[];
};

export type SupervisionFeedbackPack = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  beginner: BandedFeedback;
  intermediate: BandedFeedback;
  advanced: BandedFeedback;
  consultant: BandedFeedback;
  board: BandedFeedback;
  /** Selected band for this learner's current level. */
  primary: BandedFeedback;
};

export type CompetencyProgressionEntry = {
  skill_id: TherapistSkillId;
  level: CompetencyLevel;
  score: number;
  evidence: EvidenceCitation[];
  next_level_criteria: string[];
};

export type CompetencyProgressionReport = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  overall_level: CompetencyLevel;
  entries: CompetencyProgressionEntry[];
  heatmap: Array<{ id: TherapistSkillId; score: number; level: CompetencyLevel }>;
};

export type LearningRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  skill_id?: TherapistSkillId;
  title: string;
  rationale: string;
  evidence: EvidenceCitation[];
  practice_suggestion: string;
};

export type CertificationProgress = {
  current_band: SupervisionBand;
  progress_pct: number;
  milestones_met: string[];
  milestones_pending: string[];
  board_ready: boolean;
  rationale: string[];
};

export type ProgressSnapshot = {
  sessions_reviewed: number;
  overall_ema: number;
  skill_trends: Array<{ id: TherapistSkillId; score: number; delta: number }>;
  plateau: boolean;
  regression: boolean;
  velocity: number;
};

export type PortfolioCaseLogEntry = {
  session_id: string;
  diagnosis_slug: string | null;
  modalities: RecognizedModality[];
  overall: number;
  strengths: string[];
  weaknesses: string[];
  reviewed_at: string;
};

export type SupervisorPortfolio = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  learner_id: string;
  user_id: string;
  case_log: PortfolioCaseLogEntry[];
  competency_log: CompetencyProgressionEntry[];
  strength_evolution: Array<{ skill: TherapistSkillId; scores: number[] }>;
  weakness_evolution: Array<{ skill: TherapistSkillId; scores: number[] }>;
  milestones: string[];
  certification: CertificationProgress;
  updated_at: string;
};

export type ReflectivePracticePack = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  reflection_questions: string[];
  alternative_hypotheses: string[];
  bias_detection: string[];
  countertransference_reminders: string[];
  clinical_uncertainty_notes: string[];
};

export type SupervisorSessionBundle = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  supervisor_version: typeof SUPERVISOR_VERSION;
  session_id: string;
  expert_review: ExpertReviewReport;
  feedback: SupervisionFeedbackPack;
  competencies: CompetencyProgressionReport;
  recommendations: LearningRecommendation[];
  certification: CertificationProgress;
  progress: ProgressSnapshot;
  portfolio: SupervisorPortfolio;
  reflective: ReflectivePracticePack;
  versions: SupervisorVersionLock;
};

export type SupervisorRunInput = {
  sessionId: string;
  userId: string;
  overall: number;
  items: ScoreEntry[];
  messages: Array<{ role: string; content: string }>;
  language?: string | null;
  narrative?: string | null;
  diagnosisSlug?: string | null;
  clinicalSnapshot?: {
    primary_diagnosis?: {
      slug: string;
      name: string;
      dsm5_code?: string | null;
      icd11_code?: string | null;
    } | null;
    comorbidities?: Array<{ slug: string; name: string }>;
    clinical_core?: {
      symptom_profile?: Array<{ id: string; description: string }>;
      risk_profile?: Record<string, unknown>;
      protective_factors?: Array<{ id: string; label: string }>;
      session_goals?: string[];
      ideal_approach?: string;
    } | null;
    clinical_teaching?: {
      differentials?: string[];
      rule_outs?: string[];
      teaching_points?: string[];
      common_mistakes?: string[];
    } | null;
    therapy_modality?: TherapyModality;
  } | null;
  learnerProfile?: LearnerProfile | null;
  educationBundle?: EducationSessionBundle | null;
  educationEvaluation?: SessionEvaluationReport | null;
  educationDiagnostic?: DiagnosticReasoningReport | null;
  educationFeedback?: ExpertFeedbackReport | null;
  /** Stage 8 validation run — optional observational grounding. */
  validationRun?: ValidationRunResult | null;
  priorSkillScores?: Array<{ id: TherapistSkillId; score: number }>;
};

export type SupervisorDashboard = {
  version: typeof SUPERVISOR_FRAMEWORK_VERSION;
  portfolio: SupervisorPortfolio;
  competency_heatmap: CompetencyProgressionReport["heatmap"];
  progress_graph: Array<{ n: number; overall: number }>;
  certification_tracker: CertificationProgress;
  longitudinal: ProgressSnapshot;
  latest_session: SupervisorSessionBundle | null;
  quality_gate_notes: string[];
};
