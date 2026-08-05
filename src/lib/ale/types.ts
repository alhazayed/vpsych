/**
 * Adaptive Learning Effectiveness — result contracts.
 */

import type { AleDimensionId } from "@/lib/ale/weights";

export type AleDimensionScore = {
  id: AleDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  scientific_reasoning: string;
  recommendations: string[];
};

export type AleConfidenceInterval = {
  lower: number;
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type AleVersionLock = {
  ale_version: string;
  adaptive_version: string | null;
  curriculum_version: string | null;
  competency_graph_version: string | null;
  computed_at: string;
};

export type AdaptiveLearningEffectiveness = {
  overall: number;
  subscores: AleDimensionScore[];
  confidence_interval: AleConfidenceInterval;
  evidence: {
    learner_archetype: string | null;
    sessions: number;
    dimensions: Record<string, string[]>;
  };
  curriculum_quality_report: string;
  recommendations: string[];
  learning_curve: Array<{ session: number; overall: number }>;
  difficulty_curve: Array<{ session: number; difficulty: string; rank: number }>;
  versions: AleVersionLock;
  weight_matrix_version: string;
};

export type AleComputeInput = {
  learner_archetype?: string | null;
  session_overalls: number[];
  difficulty_sequence: string[];
  focus_hits_on_weakest: number;
  focus_attempts: number;
  unique_disorders: number;
  unique_difficulties: number;
  unique_fingerprints: number;
  total_cases: number;
  remediation_sessions: number;
  miss_flag_counts: number[];
  objective_alignment_hits: number;
  objective_alignment_attempts: number;
  graph_utilized_sessions: number;
  pathway_steps: number;
  adaptive_decisions: number;
  adaptive_version?: string | null;
  curriculum_version?: string | null;
  competency_graph_version?: string | null;
};

export type AleAggregateRow = {
  key: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  ci95: { lower: number; upper: number };
};

export type AleDashboardData = {
  ale_version: string;
  overall_mean: number | null;
  n: number;
  learning_curves: Array<{
    archetype: string;
    points: Array<{ session: number; overall: number }>;
  }>;
  difficulty_curves: Array<{
    archetype: string;
    points: Array<{ session: number; difficulty: string; rank: number }>;
  }>;
  by_archetype: AleAggregateRow[];
  curriculum_quality: {
    mean_ale: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    recommendations: string[];
  };
  low_ale_recommendations: string[];
};
