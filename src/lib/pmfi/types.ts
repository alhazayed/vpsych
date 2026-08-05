import type { PmfiDimensionId } from "@/lib/pmfi/weights";
import type { PatientMindState } from "@/lib/pme/types";

export type PmfiDimensionScore = {
  id: PmfiDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  recommendations: string[];
};

export type PatientMindFidelityIndex = {
  overall: number;
  subscores: PmfiDimensionScore[];
  confidence_interval: {
    lower: number;
    upper: number;
    method: "weighted_dimension_uncertainty";
    level: 0.95;
  };
  evidence: {
    disorder_slug: string;
    sessions_together: number;
    turn_traces: number;
    phase: string;
  };
  clinical_reasoning: string;
  recommendations: string[];
  versions: {
    pmfi_version: string;
    pme_version: string;
    computed_at: string;
  };
};

export type PmfiComputeInput = {
  mind: PatientMindState;
  /** Prior mind snapshot for continuity checks (optional). */
  priorMind?: PatientMindState | null;
  expressionLayerWired?: boolean;
  persisted?: boolean;
};
