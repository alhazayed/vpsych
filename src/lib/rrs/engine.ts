/**
 * Research Readiness Score engine — weighted scientific scoring (RRS v1.0).
 */

import {
  ASSESSMENT_SCHEMA_VERSION,
  PROMPT_ENGINE_VERSION,
} from "@/lib/scientific/versions";
import type {
  ResearchReadinessScore,
  ReproducibilityMatrixRow,
  RrsComputeInput,
  RrsConfidenceInterval,
  RrsDimensionScore,
  VersionMatrixRow,
} from "@/lib/rrs/types";
import {
  RESEARCH_DATASET_VERSION,
  RESEARCH_EXPORT_VERSION,
  RRS_VERSION,
  RRS_WEIGHT_MATRIX,
  assertWeightMatrixValid,
  type RrsDimensionId,
  weightMap,
} from "@/lib/rrs/weights";

assertWeightMatrixValid();

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function dim(
  id: RrsDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  scientific_reasoning: string,
  recommendations: string[] = [],
): RrsDimensionScore {
  const w = weightMap()[id];
  const s = clamp(score);
  return {
    id,
    score: s,
    weight: w,
    weighted_contribution: Math.round(s * w * 10) / 10,
    confidence: clamp(confidence),
    evidence,
    scientific_reasoning,
    recommendations,
  };
}

function scoreVersionControl(input: RrsComputeInput): RrsDimensionScore {
  const locks = [
    input.has_prompt_version,
    input.has_assessment_schema_version,
    input.has_case_snapshot_version,
    input.has_ace_version,
    input.has_cge_version,
    input.has_rubric_version,
  ];
  const n = locks.filter(Boolean).length;
  const score = 30 + (n / locks.length) * 70;
  const recs: string[] = [];
  if (n < locks.length)
    recs.push("Ensure all scientific engine version locks are stamped");
  return dim(
    "version_control",
    score,
    90,
    [`locks=${n}/${locks.length}`],
    "Presence of scientific version locks across engines.",
    recs,
  );
}

function scoreCompleteness(input: RrsComputeInput): RrsDimensionScore {
  const fields = [
    input.has_prompt_version,
    input.has_assessment_schema_version,
    input.has_persona_stamp,
    input.has_model_stamp || input.heuristic_disclosed,
    input.assessment_provenance_present,
    input.scientific_meta_fields >= Math.ceil(input.scientific_meta_required * 0.7),
  ];
  const n = fields.filter(Boolean).length;
  const score = (n / fields.length) * 100;
  const recs: string[] = [];
  if (n < fields.length)
    recs.push("Fill missing research-critical fields on assessments and cases");
  return dim(
    "data_completeness",
    score,
    85,
    [`complete=${n}/${fields.length}`],
    "Completeness of research-critical data fields.",
    recs,
  );
}

function scoreIntegrity(input: RrsComputeInput): RrsDimensionScore {
  let score = 40;
  const ev: string[] = [];
  if (input.evidence_lock_count >= 10) {
    score += 30;
    ev.push(`evidence_locks=${input.evidence_lock_count}`);
  } else {
    ev.push(`evidence_locks=${input.evidence_lock_count}`);
  }
  if (input.has_assessment_schema_version) score += 15;
  if (input.heuristic_disclosed) score += 10;
  const recs: string[] = [];
  if (input.evidence_lock_count < 10)
    recs.push("Expand disorder evidence locks for research integrity");
  return dim(
    "data_integrity",
    score,
    85,
    ev,
    "Integrity via evidence locks, schema, and heuristic disclosure.",
    recs,
  );
}

function scoreAuditability(input: RrsComputeInput): RrsDimensionScore {
  if (!input.audit_trail_present) {
    return dim(
      "auditability",
      35,
      80,
      ["audit_trail=absent"],
      "No security/admin audit trail detected.",
      ["Deploy security_audit_events logging for research-relevant admin actions"],
    );
  }
  return dim(
    "auditability",
    88,
    85,
    ["audit_trail=present"],
    "Security audit trail present for admin/research actions.",
  );
}

function scoreReproducibility(input: RrsComputeInput): RrsDimensionScore {
  let score = 25;
  const ev: string[] = [];
  if (input.seeded_sims_present) {
    score += 35;
    ev.push("seeded_sims");
  }
  if (input.peer_metric_corpora >= 3) {
    score += 25;
    ev.push(`corpora=${input.peer_metric_corpora}`);
  } else if (input.peer_metric_corpora > 0) {
    score += 12;
    ev.push(`corpora=${input.peer_metric_corpora}`);
  }
  if (input.has_prompt_version && input.has_assessment_schema_version) {
    score += 15;
    ev.push("version_locks");
  }
  const recs: string[] = [];
  if (!input.seeded_sims_present)
    recs.push("Provide seeded offline simulations for reproducibility");
  return dim(
    "reproducibility",
    score,
    85,
    ev.length ? ev : ["repro_thin"],
    "Reproducibility of scientific simulations and corpora.",
    recs,
  );
}

function scoreAssessmentRepro(input: RrsComputeInput): RrsDimensionScore {
  let score = 30;
  const ev: string[] = [];
  if (input.has_assessment_schema_version) {
    score += 25;
    ev.push("schema");
  }
  if (input.assessment_provenance_present) {
    score += 25;
    ev.push("provenance");
  }
  if (input.has_model_stamp || input.heuristic_disclosed) {
    score += 20;
    ev.push(input.has_model_stamp ? "model_stamp" : "heuristic_disclosed");
  }
  const recs: string[] = [];
  if (!input.assessment_provenance_present)
    recs.push("Embed scientific_provenance on every assessment score blob");
  return dim(
    "assessment_reproducibility",
    score,
    85,
    ev,
    "Ability to re-interpret assessments via schema and provenance.",
    recs,
  );
}

function scorePromptVersioning(input: RrsComputeInput): RrsDimensionScore {
  if (!input.has_prompt_version) {
    return dim(
      "prompt_versioning",
      20,
      95,
      ["prompt_version=missing"],
      "Prompt engine version missing.",
      ["Stamp prompt_engine_version on scientific_meta"],
    );
  }
  return dim(
    "prompt_versioning",
    95,
    95,
    [`prompt_version=${input.prompt_version ?? "locked"}`],
    "Prompt engine version locked and available.",
  );
}

function scorePersonaVersioning(input: RrsComputeInput): RrsDimensionScore {
  if (!input.has_persona_stamp) {
    return dim(
      "persona_versioning",
      45,
      70,
      ["persona_stamp=missing"],
      "Persona identity/version not consistently stamped.",
      ["Stamp persona slug/id on CaseInstance and research exports"],
    );
  }
  return dim(
    "persona_versioning",
    85,
    80,
    ["persona_stamp=present"],
    "Persona identity stamped for research traceability.",
  );
}

function scoreTemplateVersioning(input: RrsComputeInput): RrsDimensionScore {
  if (!input.has_template_version) {
    return dim(
      "clinical_template_versioning",
      55,
      65,
      ["template_version=partial"],
      "Template/preset versioning present in engines but not always stamped.",
      ["Always stamp template_version / preset_version when generating from templates"],
    );
  }
  return dim(
    "clinical_template_versioning",
    90,
    85,
    ["template_version=present"],
    "Clinical template/preset version stamped.",
  );
}

function scoreModelVersioning(input: RrsComputeInput): RrsDimensionScore {
  if (input.has_model_stamp) {
    return dim(
      "ai_model_versioning",
      92,
      90,
      [`model=${input.model_version ?? "stamped"}`],
      "AI model version recorded on assessment.",
    );
  }
  if (input.heuristic_disclosed) {
    return dim(
      "ai_model_versioning",
      70,
      85,
      ["heuristic_disclosed"],
      "Heuristic path disclosed when model absent — acceptable for degradation audits.",
      ["Prefer LLM examiner with explicit model id for publication datasets"],
    );
  }
  return dim(
    "ai_model_versioning",
    30,
    90,
    ["model=missing"],
    "AI model version missing without heuristic disclosure.",
    ["Record ai_model / ai_source on every assessment"],
  );
}

function scoreDatasetConsistency(input: RrsComputeInput): RrsDimensionScore {
  let score = 30;
  const ev: string[] = [];
  if (input.evidence_lock_count >= 10) {
    score += 25;
    ev.push("evidence_matrix");
  }
  if (input.peer_metric_corpora >= 4) {
    score += 30;
    ev.push(`peer_corpora=${input.peer_metric_corpora}`);
  } else if (input.peer_metric_corpora >= 2) {
    score += 18;
    ev.push(`peer_corpora=${input.peer_metric_corpora}`);
  }
  if (input.dataset_version) {
    score += 15;
    ev.push(`dataset_version=${input.dataset_version}`);
  }
  const recs: string[] = [];
  if (input.peer_metric_corpora < 3)
    recs.push("Maintain offline corpora for CFI/ERI/AVI/ALE research analyses");
  return dim(
    "dataset_consistency",
    score,
    80,
    ev.length ? ev : ["dataset_thin"],
    "Consistency of research datasets and peer metric corpora.",
    recs,
  );
}

function scoreLongitudinal(input: RrsComputeInput): RrsDimensionScore {
  if (!input.longitudinal_session_order_ok) {
    return dim(
      "longitudinal_consistency",
      45,
      60,
      ["session_order=unverified"],
      "Longitudinal session ordering not verified.",
      ["Preserve created_at order and learner_id linkage in exports"],
    );
  }
  return dim(
    "longitudinal_consistency",
    85,
    75,
    ["session_order=ok"],
    "Longitudinal session ordering preserved for trajectories.",
  );
}

function scoreExportQuality(input: RrsComputeInput): RrsDimensionScore {
  if (!input.research_export_api_present) {
    return dim(
      "export_quality",
      40,
      90,
      ["research_export_api=absent", "disclosed"],
      "Dedicated anonymized research export API not present in this deployment — disclosed limitation.",
      [
        "Ship research export endpoint with schema, dataset_version, and redaction profile",
      ],
    );
  }
  return dim(
    "export_quality",
    88,
    85,
    [
      `export_version=${input.export_version ?? RESEARCH_EXPORT_VERSION}`,
      "research_export_api=present",
    ],
    "Research export packaging present with versioned schema.",
  );
}

function scoreMetadata(input: RrsComputeInput): RrsDimensionScore {
  const req = Math.max(1, input.scientific_meta_required);
  const ratio = Math.min(1, input.scientific_meta_fields / req);
  const score = 25 + ratio * 70;
  const recs: string[] = [];
  if (ratio < 0.8)
    recs.push("Complete scientific_meta / provenance metadata for publication");
  return dim(
    "metadata_completeness",
    score,
    85,
    [
      `meta_fields=${input.scientific_meta_fields}/${req}`,
      `schema=${input.schema_version ?? ASSESSMENT_SCHEMA_VERSION}`,
    ],
    "Completeness of scientific metadata for publication packages.",
    recs,
  );
}

function scoreAnonymization(input: RrsComputeInput): RrsDimensionScore {
  if (!input.anonymization_pipeline_present) {
    return dim(
      "anonymization_readiness",
      38,
      90,
      ["anonymization_pipeline=absent", "disclosed"],
      "De-identification pipeline for research datasets not productized — disclosed.",
      [
        "Implement anonymized export stripping PII while retaining scientific IDs/versions",
      ],
    );
  }
  return dim(
    "anonymization_readiness",
    90,
    85,
    ["anonymization_pipeline=present"],
    "Anonymization pipeline available for research datasets.",
  );
}

function scoreGdpr(input: RrsComputeInput): RrsDimensionScore {
  if (input.gdpr_dsar_productized) {
    return dim(
      "gdpr_compliance",
      90,
      85,
      ["dsar=productized", `documented=${input.gdpr_documented}`],
      "GDPR DSAR export/erase productized.",
    );
  }
  if (input.gdpr_documented) {
    return dim(
      "gdpr_compliance",
      55,
      85,
      ["dsar=documented_only"],
      "GDPR/DSAR documented but not fully productized — honest partial score.",
      ["Productize GDPR data-subject export and erasure workflows"],
    );
  }
  return dim(
    "gdpr_compliance",
    30,
    90,
    ["gdpr=undocumented"],
    "GDPR research pathways undocumented.",
    ["Document and productize GDPR/DSAR research pathways"],
  );
}

function scoreInstitutional(input: RrsComputeInput): RrsDimensionScore {
  let score = 40;
  const ev: string[] = [];
  if (input.irb_high_stakes_disclosed) {
    score += 20;
    ev.push("high_stakes_disclosed");
  }
  if (input.has_prompt_version && input.has_assessment_schema_version) {
    score += 15;
    ev.push("version_locks");
  }
  if (input.evidence_lock_count >= 10) {
    score += 15;
    ev.push("evidence_matrix");
  }
  if (input.peer_metric_corpora >= 3) {
    score += 10;
    ev.push("peer_metrics");
  }
  const recs: string[] = [];
  if (!input.research_export_api_present || !input.anonymization_pipeline_present) {
    recs.push(
      "Institutional research use requires anonymized export + DPA before publication datasets",
    );
  }
  return dim(
    "institutional_research_readiness",
    score,
    80,
    ev,
    "Readiness for supervised educational/research deployment (not high-stakes solo scoring).",
    recs,
  );
}

const SCORERS: Record<RrsDimensionId, (i: RrsComputeInput) => RrsDimensionScore> =
  {
    version_control: scoreVersionControl,
    data_completeness: scoreCompleteness,
    data_integrity: scoreIntegrity,
    auditability: scoreAuditability,
    reproducibility: scoreReproducibility,
    assessment_reproducibility: scoreAssessmentRepro,
    prompt_versioning: scorePromptVersioning,
    persona_versioning: scorePersonaVersioning,
    clinical_template_versioning: scoreTemplateVersioning,
    ai_model_versioning: scoreModelVersioning,
    dataset_consistency: scoreDatasetConsistency,
    longitudinal_consistency: scoreLongitudinal,
    export_quality: scoreExportQuality,
    metadata_completeness: scoreMetadata,
    anonymization_readiness: scoreAnonymization,
    gdpr_compliance: scoreGdpr,
    institutional_research_readiness: scoreInstitutional,
  };

export function confidenceInterval(
  overall: number,
  subscores: RrsDimensionScore[],
): RrsConfidenceInterval {
  const variance = subscores.reduce((acc, s) => {
    const uncertainty = ((100 - s.confidence) / 100) * 15;
    return acc + s.weight * uncertainty * uncertainty;
  }, 0);
  const se = Math.sqrt(variance);
  const margin = 1.96 * se;
  return {
    lower: clamp(overall - margin),
    upper: clamp(overall + margin),
    method: "weighted_dimension_uncertainty",
    level: 0.95,
  };
}

export function buildVersionMatrix(input: RrsComputeInput): VersionMatrixRow[] {
  const row = (
    component: string,
    version: string | null | undefined,
    present: boolean,
  ): VersionMatrixRow => ({
    component,
    version: version ?? null,
    status: present && version ? "locked" : present ? "partial" : "missing",
  });
  return [
    row("rrs", RRS_VERSION, true),
    row("dataset", input.dataset_version ?? RESEARCH_DATASET_VERSION, true),
    row(
      "assessment_schema",
      input.schema_version ?? ASSESSMENT_SCHEMA_VERSION,
      input.has_assessment_schema_version,
    ),
    row(
      "prompt_engine",
      input.prompt_version ?? PROMPT_ENGINE_VERSION,
      input.has_prompt_version,
    ),
    row("ai_model", input.model_version ?? null, input.has_model_stamp),
    row(
      "export",
      input.export_version ?? RESEARCH_EXPORT_VERSION,
      input.research_export_api_present,
    ),
    row("persona", input.has_persona_stamp ? "stamped" : null, input.has_persona_stamp),
    row(
      "clinical_template",
      input.has_template_version ? "stamped" : null,
      input.has_template_version,
    ),
  ];
}

export function buildReproducibilityMatrix(
  input: RrsComputeInput,
): ReproducibilityMatrixRow[] {
  return [
    {
      artifact: "educational_outcome_sims",
      seeded: input.seeded_sims_present,
      offline_corpus: input.seeded_sims_present,
      version_locked: input.has_ace_version,
      notes: "Seeded ACE outcome simulations",
    },
    {
      artifact: "peer_metric_corpora",
      seeded: input.peer_metric_corpora > 0,
      offline_corpus: input.peer_metric_corpora >= 3,
      version_locked: input.peer_metric_corpora >= 3,
      notes: `CFI/ERI/AVI/ALE corpora count=${input.peer_metric_corpora}`,
    },
    {
      artifact: "assessment_provenance",
      seeded: false,
      offline_corpus: input.assessment_provenance_present,
      version_locked: input.has_assessment_schema_version,
      notes: "scientific_provenance on scores JSON",
    },
    {
      artifact: "research_export",
      seeded: false,
      offline_corpus: input.research_export_api_present,
      version_locked: input.research_export_api_present,
      notes: input.research_export_api_present
        ? "Export API present"
        : "Export API absent (disclosed)",
    },
  ];
}

export function computeResearchReadinessScore(
  input: RrsComputeInput,
): ResearchReadinessScore {
  const subscores = RRS_WEIGHT_MATRIX.map((w) => SCORERS[w.id](input));
  const overall = clamp(
    subscores.reduce((a, s) => a + s.score * s.weight, 0),
  );
  const ci = confidenceInterval(overall, subscores);
  const recommendations = [
    ...new Set(subscores.flatMap((s) => s.recommendations)),
  ].slice(0, 12);
  const version_matrix = buildVersionMatrix(input);
  const reproducibility_matrix = buildReproducibilityMatrix(input);

  const low = subscores
    .filter((s) => s.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => `${s.id}=${s.score}`);

  const publication_readiness_report = [
    `RRS ${overall}/100 (v${RRS_VERSION}) for dataset=${input.dataset_id ?? "platform"}.`,
    `Schema=${input.schema_version ?? ASSESSMENT_SCHEMA_VERSION}; prompt=${input.prompt_version ?? PROMPT_ENGINE_VERSION}; model=${input.model_version ?? "n/a"}; export=${input.export_version ?? RESEARCH_EXPORT_VERSION}.`,
    low.length
      ? `Lowest dimensions: ${low.join(", ")}.`
      : "No dimension scored below 70.",
    input.research_export_api_present
      ? "Research export pathway present."
      : "Publication datasets require anonymized export API (currently disclosed as absent).",
    `95% CI ≈ [${ci.lower}, ${ci.upper}].`,
  ].join(" ");

  const dataset_quality_report = [
    `Dataset quality for ${input.dataset_id ?? "platform"} @ ${RESEARCH_DATASET_VERSION}.`,
    `Evidence locks=${input.evidence_lock_count}; peer corpora=${input.peer_metric_corpora}; meta_fields=${input.scientific_meta_fields}/${input.scientific_meta_required}.`,
    `Completeness=${subscores.find((s) => s.id === "data_completeness")?.score}; integrity=${subscores.find((s) => s.id === "data_integrity")?.score}; metadata=${subscores.find((s) => s.id === "metadata_completeness")?.score}.`,
    input.anonymization_pipeline_present
      ? "Anonymization pipeline present."
      : "Anonymization pipeline not productized — do not publish identifiable session data.",
  ].join(" ");

  const evidenceDimensions: Record<string, string[]> = {};
  for (const s of subscores) evidenceDimensions[s.id] = s.evidence;

  return {
    overall,
    subscores,
    confidence_interval: ci,
    evidence: {
      dataset_id: input.dataset_id ?? null,
      dimensions: evidenceDimensions,
    },
    publication_readiness_report,
    dataset_quality_report,
    recommendations,
    version_matrix,
    reproducibility_matrix,
    versions: {
      rrs_version: RRS_VERSION,
      dataset_version: input.dataset_version ?? RESEARCH_DATASET_VERSION,
      schema_version: input.schema_version ?? ASSESSMENT_SCHEMA_VERSION,
      prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
      model_version: input.model_version ?? null,
      export_version: input.export_version ?? RESEARCH_EXPORT_VERSION,
      computed_at: new Date().toISOString(),
    },
    weight_matrix_version: RRS_VERSION,
  };
}
