/**
 * Research Readiness Score (RRS) v1.0 — weight matrix.
 *
 * Weights sum to 1.0. Domains measure whether VPsych data can support
 * scientific research and publication (Mission RRS).
 * Do not alter weights without bumping RRS_VERSION.
 */

export const RRS_VERSION = "1.0.0";
/** Research dataset packaging contract version. */
export const RESEARCH_DATASET_VERSION = "1.0.0";
/** Research export schema / packaging version. */
export const RESEARCH_EXPORT_VERSION = "1.0.0";

export type RrsDimensionId =
  | "version_control"
  | "data_completeness"
  | "data_integrity"
  | "auditability"
  | "reproducibility"
  | "assessment_reproducibility"
  | "prompt_versioning"
  | "persona_versioning"
  | "clinical_template_versioning"
  | "ai_model_versioning"
  | "dataset_consistency"
  | "longitudinal_consistency"
  | "export_quality"
  | "metadata_completeness"
  | "anonymization_readiness"
  | "gdpr_compliance"
  | "institutional_research_readiness";

export type RrsWeightEntry = {
  id: RrsDimensionId;
  weight: number;
  rationale: string;
};

/** Canonical weight matrix — sum MUST equal 1.0 within 1e-9. */
export const RRS_WEIGHT_MATRIX: RrsWeightEntry[] = [
  {
    id: "version_control",
    weight: 0.07,
    rationale: "Scientific version locks present and coherent across engines",
  },
  {
    id: "data_completeness",
    weight: 0.06,
    rationale: "Required research fields populated on assessments / cases",
  },
  {
    id: "data_integrity",
    weight: 0.06,
    rationale: "Schema checks, evidence locks, and no invented criterion claims",
  },
  {
    id: "auditability",
    weight: 0.06,
    rationale: "Security/admin audit trail exists for research-relevant actions",
  },
  {
    id: "reproducibility",
    weight: 0.08,
    rationale: "Seeded sims and offline corpora reproduce under fixed seeds",
  },
  {
    id: "assessment_reproducibility",
    weight: 0.07,
    rationale: "Assessment schema + provenance enable re-scoring audits",
  },
  {
    id: "prompt_versioning",
    weight: 0.06,
    rationale: "Patient prompt engine version locked and stamped",
  },
  {
    id: "persona_versioning",
    weight: 0.04,
    rationale: "Persona identity stamped on case / research exports",
  },
  {
    id: "clinical_template_versioning",
    weight: 0.05,
    rationale: "Scenario template / preset versions locked when used",
  },
  {
    id: "ai_model_versioning",
    weight: 0.06,
    rationale: "AI model id recorded on assessments (or heuristic disclosed)",
  },
  {
    id: "dataset_consistency",
    weight: 0.06,
    rationale: "Peer metric corpora + evidence matrix consistent for analysis",
  },
  {
    id: "longitudinal_consistency",
    weight: 0.05,
    rationale: "Learner trajectories retain session order and version stamps",
  },
  {
    id: "export_quality",
    weight: 0.05,
    rationale: "Research export packaging quality (honest if pipeline absent)",
  },
  {
    id: "metadata_completeness",
    weight: 0.06,
    rationale: "Scientific meta / provenance fields complete for publication",
  },
  {
    id: "anonymization_readiness",
    weight: 0.05,
    rationale: "De-identification pathway ready for research datasets",
  },
  {
    id: "gdpr_compliance",
    weight: 0.06,
    rationale: "GDPR/DSAR research pathways documented and/or productized",
  },
  {
    id: "institutional_research_readiness",
    weight: 0.06,
    rationale: "IRB/educational-research deployment readiness (not high-stakes solo)",
  },
];

export function assertWeightMatrixValid(): void {
  const sum = RRS_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`RRS weight matrix sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(RRS_WEIGHT_MATRIX.map((e) => e.id));
  if (ids.size !== RRS_WEIGHT_MATRIX.length) {
    throw new Error("Duplicate RRS dimension ids in weight matrix");
  }
}

export function weightMap(): Record<RrsDimensionId, number> {
  return Object.fromEntries(
    RRS_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<RrsDimensionId, number>;
}
