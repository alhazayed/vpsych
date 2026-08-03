/**
 * Assessment Validity Index engine — weighted scientific scoring (AVI v1.0).
 */

import {
  ASSESSMENT_SCHEMA_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
} from "@/lib/scientific/versions";
import { mean, stddev, variance as sampleVariance } from "@/lib/scientific/psychometrics";
import type {
  AssessmentValidityIndex,
  AviComputeInput,
  AviConfidenceInterval,
  AviDimensionScore,
} from "@/lib/avi/types";
import {
  AVI_VERSION,
  AVI_WEIGHT_MATRIX,
  assertWeightMatrixValid,
  type AviDimensionId,
  weightMap,
} from "@/lib/avi/weights";

assertWeightMatrixValid();

const CLINICAL_CORE = new Set([
  "alliance",
  "assessment",
  "interventions",
  "safety",
  "structure",
  "diagnostic_accuracy",
  "empathy",
  "risk_assessment",
  "communication",
]);

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function dim(
  id: AviDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  scientific_reasoning: string,
  recommendations: string[] = [],
): AviDimensionScore {
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

export function computeRepeatVariance(overalls: number[]): number | null {
  if (overalls.length < 2) return null;
  return Math.round(sampleVariance(overalls) * 100) / 100;
}

function scoreContent(input: AviComputeInput): AviDimensionScore {
  const n = input.rubric_item_count;
  const clinicalHits = input.clinical_core_item_ids.filter((id) =>
    CLINICAL_CORE.has(id),
  ).length;
  let score = 30 + Math.min(40, n * 8) + Math.min(25, clinicalHits * 5);
  const recs: string[] = [];
  if (n < 5) recs.push("Expand rubric to ≥5 OSCE-style competency dimensions");
  if (clinicalHits < 3)
    recs.push("Include safety, assessment, and alliance (or equivalent) content");
  return dim(
    "content_validity",
    score,
    n >= 5 ? 85 : 60,
    [`items=${n}`, `clinical_core_hits=${clinicalHits}`],
    "Content coverage of claimed clinical competency domains.",
    recs,
  );
}

function scoreConstruct(input: AviComputeInput): AviDimensionScore {
  let score = 40;
  const ev: string[] = [];
  const recs: string[] = [];
  if (input.cronbach_alpha != null) {
    ev.push(`alpha=${input.cronbach_alpha}`);
    if (input.cronbach_alpha >= 0.7) score += 25;
    else if (input.cronbach_alpha >= 0.6) score += 15;
    else {
      score += 5;
      recs.push("Improve construct coherence (α < 0.6)");
    }
  } else {
    ev.push("alpha=n/a");
    recs.push("Accumulate item matrices to estimate Cronbach α");
  }
  if (input.discrimination_index != null) {
    ev.push(`discrimination=${input.discrimination_index}`);
    if (input.discrimination_index >= 0.3) score += 20;
    else if (input.discrimination_index >= 0.15) score += 10;
    else recs.push("Low item–total discrimination — revise weak items");
  }
  if (input.assessment_mode === "heuristic_fallback") {
    score = Math.min(score, 50);
    recs.push("Heuristic scoring weakens construct validity claims");
  }
  return dim(
    "construct_validity",
    score,
    input.cronbach_alpha != null ? 80 : 50,
    ev,
    "Construct validity via internal consistency and discrimination.",
    recs,
  );
}

function scoreFace(input: AviComputeInput): AviDimensionScore {
  const looksLikeOsce =
    input.rubric_item_count >= 4 &&
    input.clinical_core_item_ids.some((id) => CLINICAL_CORE.has(id));
  let score = looksLikeOsce ? 85 : 55;
  const recs: string[] = [];
  if (input.assessment_mode === "llm_examiner") score = Math.min(100, score + 8);
  if (input.assessment_mode === "heuristic_fallback") {
    score = Math.min(score, 60);
    recs.push("Disclose heuristic path — face validity is provisional");
  }
  return dim(
    "face_validity",
    score,
    75,
    [
      `osce_like=${looksLikeOsce}`,
      `mode=${input.assessment_mode ?? "unknown"}`,
    ],
    "Face validity as a clinical skills assessment instrument.",
    recs,
  );
}

function scoreCriterion(input: AviComputeInput): AviDimensionScore {
  if (input.has_external_criterion === true && input.criterion_correlation != null) {
    const r = input.criterion_correlation;
    const score = Math.min(95, 40 + Math.max(0, r) * 55);
    const recs: string[] = [];
    if (r < 0.5)
      recs.push("Strengthen criterion correlation with human OSCE examiners");
    return dim(
      "criterion_validity",
      score,
      85,
      [`r=${Math.round(r * 1000) / 1000}`, "external_criterion=true"],
      "Criterion validity against an external reference standard.",
      recs,
    );
  }
  // Honest partial credit for disclosed absence — not invented validity
  return dim(
    "criterion_validity",
    45,
    90,
    ["external_criterion=absent", "disclosed"],
    "No published external criterion study vs human OSCE examiners — disclosed limitation.",
    [
      "Commission human OSCE co-validation study before high-stakes criterion claims",
    ],
  );
}

function scoreInternalConsistency(input: AviComputeInput): AviDimensionScore {
  if (input.cronbach_alpha == null) {
    return dim(
      "internal_consistency",
      50,
      45,
      ["alpha=n/a"],
      "Internal consistency not yet estimated for this series.",
      ["Collect multi-subject item matrices for Cronbach α"],
    );
  }
  const a = input.cronbach_alpha;
  let score = 35 + Math.max(0, Math.min(60, a * 60));
  const recs: string[] = [];
  if (a < 0.7) recs.push("Target Cronbach α ≥ 0.70 for educational research use");
  return dim(
    "internal_consistency",
    score,
    85,
    [`alpha=${Math.round(a * 1000) / 1000}`],
    "Internal consistency of the assessment instrument.",
    recs,
  );
}

function scoreReliability(input: AviComputeInput): AviDimensionScore {
  if (input.test_retest_r == null) {
    return dim(
      "reliability",
      48,
      45,
      ["retest=n/a"],
      "Test–retest reliability not estimated.",
      ["Run repeated assessments to estimate stability"],
    );
  }
  const r = input.test_retest_r;
  const score = Math.min(95, 35 + Math.max(0, r) * 60);
  const recs: string[] = [];
  if (r < 0.6) recs.push("Improve test–retest reliability (r < 0.6)");
  return dim(
    "reliability",
    score,
    80,
    [`test_retest_r=${Math.round(r * 1000) / 1000}`],
    "Reliability via test–retest correlation of overall scores.",
    recs,
  );
}

function scoreCompetencyAlignment(input: AviComputeInput): AviDimensionScore {
  const mapped = input.competencies_mapped;
  let score = 25 + Math.min(55, mapped * 12);
  if (input.learning_objectives_count >= 2) score = Math.min(100, score + 15);
  const recs: string[] = [];
  if (mapped < 3) recs.push("Map rubric items to ≥3 ACE/CGE competencies");
  if (input.learning_objectives_count < 2)
    recs.push("Attach learning objectives to assessed sessions");
  return dim(
    "competency_alignment",
    score,
    mapped >= 3 ? 85 : 55,
    [
      `competencies_mapped=${mapped}`,
      `objectives=${input.learning_objectives_count}`,
    ],
    "Alignment of scored dimensions to competency graph claims.",
    recs,
  );
}

function scoreClinicalRelevance(input: AviComputeInput): AviDimensionScore {
  const hits = input.clinical_core_item_ids.filter((id) =>
    CLINICAL_CORE.has(id),
  ).length;
  const hasSafety = input.clinical_core_item_ids.some((id) =>
    /safety|risk/.test(id),
  );
  let score = 35 + Math.min(40, hits * 8);
  if (hasSafety) score = Math.min(100, score + 15);
  const recs: string[] = [];
  if (!hasSafety) recs.push("Include an explicit safety/risk scoring dimension");
  return dim(
    "clinical_relevance",
    score,
    hits >= 3 ? 85 : 55,
    [`clinical_hits=${hits}`, `safety=${hasSafety}`],
    "Clinical meaningfulness of scored dimensions.",
    recs,
  );
}

function scoreEducationalRelevance(input: AviComputeInput): AviDimensionScore {
  let score = 25;
  const ev: string[] = [];
  if (input.mean_feedback_chars >= 40) {
    score += 30;
    ev.push(`mean_feedback_chars=${Math.round(input.mean_feedback_chars)}`);
  } else {
    ev.push(`mean_feedback_chars=${Math.round(input.mean_feedback_chars)}`);
  }
  if (input.narrative_chars >= 80) {
    score += 25;
    ev.push(`narrative_chars=${input.narrative_chars}`);
  }
  if (input.excerpt_count >= 1) {
    score += 15;
    ev.push(`excerpts=${input.excerpt_count}`);
  }
  const recs: string[] = [];
  if (score < 70)
    recs.push("Strengthen educational value via feedback, narrative, and excerpts");
  return dim(
    "educational_relevance",
    score,
    ev.length >= 2 ? 80 : 50,
    ev.length ? ev : ["thin_educational_signal"],
    "Educational usefulness of assessment outputs beyond raw scores.",
    recs,
  );
}

function scoreBias(input: AviComputeInput): AviDimensionScore {
  if (input.fairness_pass == null && input.language_parity_within_tolerance == null) {
    return dim(
      "bias",
      55,
      40,
      ["bias_audit=absent"],
      "Bias/fairness audit not attached.",
      ["Attach locale parity and fairness controls to AVI corpus"],
    );
  }
  const parityOk = input.language_parity_within_tolerance !== false;
  const fairOk = input.fairness_pass !== false;
  if (parityOk && fairOk) {
    return dim(
      "bias",
      88,
      80,
      [
        `parity_ok=${parityOk}`,
        `fairness_ok=${fairOk}`,
        `abs_diff=${input.language_parity_abs_diff ?? "n/a"}`,
      ],
      "Bias controls within educational tolerance.",
    );
  }
  return dim(
    "bias",
    48,
    85,
    [
      `parity_ok=${parityOk}`,
      `fairness_ok=${fairOk}`,
      `abs_diff=${input.language_parity_abs_diff ?? "n/a"}`,
    ],
    "Bias or language parity outside tolerance.",
    ["Investigate bilingual / subgroup scoring bias before high-stakes use"],
  );
}

function scoreDifficultyDiscrimination(input: AviComputeInput): AviDimensionScore {
  if (input.difficulty_separation == null) {
    return dim(
      "difficulty_discrimination",
      50,
      40,
      ["separation=n/a"],
      "Difficulty separation not measured across levels.",
      ["Compare score means across beginner→expert cases"],
    );
  }
  const sep = input.difficulty_separation;
  const score = Math.min(95, 40 + Math.max(0, sep) * 4);
  const recs: string[] = [];
  if (sep < 5)
    recs.push("Difficulty levels do not separate scores enough — recalibrate cases");
  return dim(
    "difficulty_discrimination",
    score,
    75,
    [`mean_separation=${Math.round(sep * 10) / 10}`],
    "Ability of the instrument to discriminate by case difficulty.",
    recs,
  );
}

function scoreCompetencyDiscrimination(input: AviComputeInput): AviDimensionScore {
  if (input.discrimination_index == null) {
    return dim(
      "competency_discrimination",
      50,
      40,
      ["discrimination=n/a"],
      "Competency discrimination index unavailable.",
      ["Compute item–total discrimination on assessment series"],
    );
  }
  const d = input.discrimination_index;
  const score = Math.min(95, 35 + Math.max(0, d) * 100);
  const recs: string[] = [];
  if (d < 0.2) recs.push("Raise item–total discrimination (target ≥ 0.20)");
  return dim(
    "competency_discrimination",
    score,
    80,
    [`discrimination=${Math.round(d * 1000) / 1000}`],
    "Discrimination of strong vs weak competency performance.",
    recs,
  );
}

function scoreRepeatability(input: AviComputeInput): AviDimensionScore {
  const reps = input.repeated_overalls ?? [];
  if (reps.length < 2) {
    return dim(
      "repeatability",
      48,
      40,
      ["repeats=0"],
      "No repeated assessments for stability/variance.",
      ["Run ≥3 repeated assessments on identical case seeds"],
    );
  }
  const v = computeRepeatVariance(reps) ?? 0;
  const sd = stddev(reps);
  // Lower variance → higher score (sd of 0 → 95; sd of 15 → ~40)
  const score = clamp(95 - sd * 3.5);
  const recs: string[] = [];
  if (sd > 8)
    recs.push("High repeat variance — investigate model temperature / heuristic noise");
  return dim(
    "repeatability",
    score,
    85,
    [
      `n=${reps.length}`,
      `variance=${v}`,
      `sd=${Math.round(sd * 10) / 10}`,
      `mean=${Math.round(mean(reps) * 10) / 10}`,
    ],
    "Scoring stability under repeated assessments of the same case.",
    recs,
  );
}

function scoreExplainability(input: AviComputeInput): AviDimensionScore {
  let score = 20;
  const ev: string[] = [];
  if (input.mean_feedback_chars > 0) {
    score += 25;
    ev.push("item_feedback");
  }
  if (input.narrative_chars >= 60) {
    score += 25;
    ev.push("narrative");
  }
  if (input.excerpt_count > 0) {
    score += 15;
    ev.push("excerpts");
  }
  if (input.has_scientific_provenance) {
    score += 20;
    ev.push("scientific_provenance");
  }
  const recs: string[] = [];
  if (score < 70)
    recs.push("Require feedback + narrative + provenance for explainable scores");
  return dim(
    "explainability",
    score,
    ev.length >= 3 ? 85 : 55,
    ev.length ? ev : ["opaque_scores"],
    "Explainability of assessment scores to learners and faculty.",
    recs,
  );
}

const SCORERS: Record<AviDimensionId, (i: AviComputeInput) => AviDimensionScore> = {
  content_validity: scoreContent,
  construct_validity: scoreConstruct,
  face_validity: scoreFace,
  criterion_validity: scoreCriterion,
  internal_consistency: scoreInternalConsistency,
  reliability: scoreReliability,
  competency_alignment: scoreCompetencyAlignment,
  clinical_relevance: scoreClinicalRelevance,
  educational_relevance: scoreEducationalRelevance,
  bias: scoreBias,
  difficulty_discrimination: scoreDifficultyDiscrimination,
  competency_discrimination: scoreCompetencyDiscrimination,
  repeatability: scoreRepeatability,
  explainability: scoreExplainability,
};

export function confidenceInterval(
  overall: number,
  subscores: AviDimensionScore[],
): AviConfidenceInterval {
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

export function computeAssessmentValidityIndex(
  input: AviComputeInput,
): AssessmentValidityIndex {
  const subscores = AVI_WEIGHT_MATRIX.map((w) => SCORERS[w.id](input));
  const overall = clamp(
    subscores.reduce((a, s) => a + s.score * s.weight, 0),
  );
  const ci = confidenceInterval(overall, subscores);
  const recommendations = [
    ...new Set(subscores.flatMap((s) => s.recommendations)),
  ].slice(0, 12);
  const variance = computeRepeatVariance(input.repeated_overalls ?? []);

  const low = subscores
    .filter((s) => s.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => `${s.id}=${s.score}`);

  const validity_report = [
    `AVI ${overall}/100 (v${AVI_VERSION}) @ ${input.locale}; mode=${input.assessment_mode ?? "unknown"}.`,
    `Schema=${input.assessment_schema_version ?? ASSESSMENT_SCHEMA_VERSION}; prompt=${input.prompt_version ?? PROMPT_ENGINE_VERSION}; model=${input.model_version ?? "n/a"}.`,
    variance != null
      ? `Repeated-assessment variance=${variance} (n=${input.repeated_overalls?.length ?? 0}).`
      : "Repeated-assessment variance not computed.",
    low.length
      ? `Lowest validity dimensions: ${low.join(", ")}.`
      : "No dimension scored below 70.",
    `95% CI ≈ [${ci.lower}, ${ci.upper}].`,
    input.has_external_criterion
      ? "External criterion evidence attached."
      : "Criterion validity limited — no external human OSCE co-validation study.",
  ].join(" ");

  const evidenceDimensions: Record<string, string[]> = {};
  for (const s of subscores) evidenceDimensions[s.id] = s.evidence;

  return {
    overall,
    variance,
    subscores,
    confidence_interval: ci,
    evidence: {
      assessment_mode: input.assessment_mode ?? null,
      locale: input.locale,
      rubric_item_count: input.rubric_item_count,
      repeat_n: input.repeated_overalls?.length ?? null,
      dimensions: evidenceDimensions,
    },
    validity_report,
    recommendations,
    versions: {
      avi_version: AVI_VERSION,
      assessment_schema_version:
        input.assessment_schema_version ?? ASSESSMENT_SCHEMA_VERSION,
      prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
      model_version: input.model_version ?? null,
      rubric_version: input.rubric_version ?? RUBRIC_SCHEMA_VERSION,
      computed_at: new Date().toISOString(),
    },
    weight_matrix_version: AVI_VERSION,
  };
}
