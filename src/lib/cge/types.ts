/**
 * Competency Graph Engine (CGE) v3.0 — CBME DAG contracts.
 */

export type MasteryStage =
  | "not_attempted"
  | "novice"
  | "developing"
  | "competent"
  | "proficient"
  | "expert";

export type EdgeKind = "required" | "recommended" | "optional" | "depends_on";

export type NodeDifficulty =
  | "foundation"
  | "intermediate"
  | "advanced"
  | "expert";

export type GraphCompetencyId = string;

export type CompetencyNode = {
  id: GraphCompetencyId;
  name: string;
  description: string;
  domain: string;
  difficulty: NodeDifficulty;
  clinical_importance: number;
  learning_objectives: string[];
  assessment_methods: string[];
  mastery_threshold: number;
  mastery_min_samples: number;
  recommended_resources: string[];
  estimated_training_hours: number;
  version: number;
  enabled: boolean;
  sort_order: number;
};

export type CompetencyEdge = {
  from: GraphCompetencyId; // prerequisite
  to: GraphCompetencyId; // dependent
  kind: EdgeKind;
  weight: number;
  notes?: string;
};

export type CompetencyGraph = {
  version: number;
  nodes: CompetencyNode[];
  edges: CompetencyEdge[];
};

export type LearnerNodeState = {
  competency_id: GraphCompetencyId;
  score: number;
  samples: number;
  stage: MasteryStage;
  confidence: number;
  last_practiced_at?: string | null;
  locked?: boolean;
  instructor_approved?: boolean;
  trend?: number;
};

export type LearnerGraph = {
  learner_id: string;
  graph_version: number;
  nodes: LearnerNodeState[];
  blocked: GraphCompetencyId[];
  mastered: GraphCompetencyId[];
  developing: GraphCompetencyId[];
  at_risk_of_decay: GraphCompetencyId[];
};

export type RootCauseResult = {
  observed_failure: GraphCompetencyId;
  root_cause: GraphCompetencyId;
  chain: GraphCompetencyId[]; // observed → … → root
  weakest_prerequisite: GraphCompetencyId;
  explanation: string;
};

export type RemediationStep = {
  index: number;
  competency_id: GraphCompetencyId;
  title: string;
  case_focus: string;
  diagnosis_slug?: string;
  difficulty: string;
  completed?: boolean;
};

export type RemediationPlan = {
  id: string;
  learner_id: string;
  observed_failure: GraphCompetencyId;
  root_cause_id: GraphCompetencyId;
  pathway: RemediationStep[];
  recommended_cases: Array<{
    disorderSlug?: string;
    focusCompetencies: string[];
    difficulty: string;
    rationale: string;
  }>;
  estimated_hours: number;
  status: "active" | "completed" | "superseded" | "cancelled";
};

export type SupervisorGraphReport = {
  root_cause: RootCauseResult | null;
  weakest_prerequisite: GraphCompetencyId | null;
  strongest: GraphCompetencyId | null;
  fastest_improving: GraphCompetencyId | null;
  at_risk_of_decay: GraphCompetencyId[];
  supervisor_feedback: string;
  learning_plan: string[];
  recommended_next_cases: string[];
  recommended_reading: string[];
  recommended_modalities: string[];
  estimated_hours_to_mastery: number;
};

export type GraphAnalytics = {
  current_mastery: Record<GraphCompetencyId, MasteryStage>;
  learning_velocity: number;
  time_to_competency_hours: Record<string, number>;
  competency_stability: Record<string, number>;
  common_mistakes: string[];
  recurring_blind_spots: GraphCompetencyId[];
};
