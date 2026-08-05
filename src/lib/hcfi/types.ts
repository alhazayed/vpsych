/**
 * Human Conversation Fidelity Index — result contracts.
 */

import type { HcfiDimensionId } from "@/lib/hcfi/weights";

export type HcfiDimensionScore = {
  id: HcfiDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  clinical_reasoning: string;
  recommendations: string[];
};

export type HcfiConfidenceInterval = {
  lower: number;
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type HcfiVersionLock = {
  hcfi_version: string;
  prompt_version: string | null;
  model_version: string | null;
  persona_version: string | null;
  disorder_slug: string | null;
  computed_at: string;
};

export type HumanConversationFidelityIndex = {
  overall: number;
  subscores: HcfiDimensionScore[];
  confidence_interval: HcfiConfidenceInterval;
  evidence: {
    disorder_slug: string;
    locale: string;
    therapist_turns: number;
    patient_turns: number;
    alliance_band: "low" | "moderate" | "high" | "unknown";
    dimensions: Record<string, string[]>;
  };
  clinical_reasoning: string;
  recommendations: string[];
  versions: HcfiVersionLock;
  weight_matrix_version: string;
};

export type HcfiMessage = {
  role: "user" | "assistant" | "system" | string;
  content: string;
};

export type HcfiComputeInput = {
  disorder_slug: string;
  disorder_category?: string | null;
  locale: string;
  messages: HcfiMessage[];
  /** Expected speech profile cues present in system prompt / case */
  has_speech_profile?: boolean;
  has_alliance_reactivity?: boolean;
  has_cultural_cues?: boolean;
  has_voice_settings?: boolean;
  prompt_version?: string | null;
  model_version?: string | null;
  persona_version?: string | null;
  /** When true, patient replies came from persona_fallback (low immersion). */
  persona_fallback?: boolean;
  alliance_band?: "low" | "moderate" | "high" | "unknown";
};

export type HcfiAggregateRow = {
  key: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  ci95: { lower: number; upper: number };
};

export type HcfiDashboardData = {
  hcfi_version: string;
  n: number;
  mean_overall: number;
  by_disorder: HcfiAggregateRow[];
  by_locale: HcfiAggregateRow[];
  timeline: Array<{ at: string; mean: number; n: number }>;
  recommendations: string[];
};
