/**
 * Educational Reliability Index engine — weighted scientific scoring (ERI v1.0).
 */

import {
  ACE_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  CGE_ENGINE_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
} from "@/lib/scientific/versions";
import { pearson } from "@/lib/scientific/psychometrics";
import type {
  EriComputeInput,
  EriConfidenceInterval,
  EriDimensionScore,
  EducationalReliabilityIndex,
} from "@/lib/eri/types";
import {
  ERI_VERSION,
  ERI_WEIGHT_MATRIX,
  assertWeightMatrixValid,
  type EriDimensionId,
  weightMap,
} from "@/lib/eri/weights";

assertWeightMatrixValid();

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function dim(
  id: EriDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  clinical_reasoning: string,
  recommendations: string[] = [],
): EriDimensionScore {
  const w = weightMap()[id];
  const s = clamp(score);
  return {
    id,
    score: s,
    weight: w,
    weighted_contribution: Math.round(s * w * 10) / 10,
    confidence: clamp(confidence),
    evidence,
    clinical_reasoning,
    recommendations,
  };
}

/** Simulate a second rater with controlled noise; return Pearson r and % agree within 1 pt (0–5). */
export function simulateInterRaterAgreement(
  scores: number[],
  noiseSd = 0.45,
  seed = 42,
): { r: number | null; pct_agree: number } {
  let h = seed >>> 0;
  const rng = () => {
    h = (Math.imul(h ^ (h >>> 16), 2246822507) >>> 0) ^
      (Math.imul(h ^ (h >>> 13), 3266489909) >>> 0);
    return (h >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const rater2 = scores.map((s) =>
    Math.max(0, Math.min(5, Math.round((s + gauss() * noiseSd) * 10) / 10)),
  );
  const r = pearson(scores, rater2);
  let agree = 0;
  for (let i = 0; i < scores.length; i++) {
    if (Math.abs(scores[i]! - rater2[i]!) <= 1) agree += 1;
  }
  return {
    r,
    pct_agree: scores.length ? Math.round((agree / scores.length) * 1000) / 10 : 0,
  };
}

function scoreCompetencyConsistency(input: EriComputeInput): EriDimensionScore {
  const n = input.item_count;
  const recs: string[] = [];
  let score = 40;
  if (n >= 5) score += 30;
  else if (n >= 3) score += 18;
  else recs.push("Use a multi-dimension rubric (≥5 OSCE-style items)");
  if (input.cronbach_alpha != null) {
    if (input.cronbach_alpha >= 0.7) score += 25;
    else if (input.cronbach_alpha >= 0.6) score += 15;
    else {
      score += 5;
      recs.push("Improve internal consistency (α < 0.6 on item series)");
    }
  } else {
    score += 8;
    recs.push("Accumulate item matrices to report Cronbach α");
  }
  if (input.assessment_mode === "heuristic_fallback") {
    score = Math.min(score, 55);
    recs.push("Heuristic fallback is not a validated OSCE instrument — disclose and remediate AI path");
  }
  return dim(
    "competency_scoring_consistency",
    score,
    input.cronbach_alpha != null ? 85 : 60,
    [
      `items=${n}`,
      `alpha=${input.cronbach_alpha ?? "n/a"}`,
      `mode=${input.assessment_mode ?? "unknown"}`,
    ],
    "Rubric completeness and internal consistency of competency scoring.",
    recs,
  );
}

function scoreFeedbackUsefulness(input: EriComputeInput): EriDimensionScore {
  const cov =
    input.item_count > 0
      ? input.items_with_feedback / input.item_count
      : 0;
  let score = cov * 70 + Math.min(25, input.mean_feedback_chars / 8);
  const recs: string[] = [];
  if (cov < 0.8) recs.push("Ensure every rubric item carries learner-facing feedback");
  if (input.mean_feedback_chars < 40)
    recs.push("Lengthen item feedback — aim for concrete criterion-referenced comments");
  return dim(
    "feedback_usefulness",
    score,
    cov >= 0.8 ? 85 : 55,
    [
      `feedback_coverage=${Math.round(cov * 100)}%`,
      `mean_chars=${Math.round(input.mean_feedback_chars)}`,
    ],
    "Proportion and depth of item-level feedback.",
    recs,
  );
}

function scoreFeedbackSpecificity(input: EriComputeInput): EriDimensionScore {
  let score = Math.min(90, 30 + input.mean_feedback_chars / 4);
  const recs: string[] = [];
  if (input.mean_feedback_chars < 60) {
    score = Math.min(score, 65);
    recs.push("Replace generic phrases with behaviour-specific observations");
  }
  if (input.excerpt_count >= 2) score = Math.min(100, score + 10);
  else recs.push("Attach ≥2 transcript excerpts grounding the feedback");
  return dim(
    "feedback_specificity",
    score,
    input.excerpt_count >= 2 ? 80 : 55,
    [
      `mean_chars=${Math.round(input.mean_feedback_chars)}`,
      `excerpts=${input.excerpt_count}`,
    ],
    "Specificity of feedback via length and transcript grounding.",
    recs,
  );
}

function scoreActionability(input: EriComputeInput): EriDimensionScore {
  let score = 25;
  const ev: string[] = [];
  if (input.learning_goals_count > 0) {
    score += 20;
    ev.push(`goals=${input.learning_goals_count}`);
  }
  if (input.remediation_steps > 0) {
    score += 25;
    ev.push(`remediation_steps=${input.remediation_steps}`);
  }
  if (input.suggested_next_cases_count > 0) {
    score += 20;
    ev.push(`next_cases=${input.suggested_next_cases_count}`);
  }
  if (input.suggested_reading_count > 0) {
    score += 10;
    ev.push(`reading=${input.suggested_reading_count}`);
  }
  const recs: string[] = [];
  if (score < 70)
    recs.push("Attach learning goals, remediation steps, and suggested next cases");
  return dim(
    "actionability",
    score,
    ev.length >= 3 ? 85 : 55,
    ev.length ? ev : ["action_plan_absent"],
    "Actionability of post-session improvement pathway.",
    recs,
  );
}

function scoreSupervisor(input: EriComputeInput): EriDimensionScore {
  const n = input.supervisor_feedback_chars;
  if (n < 40) {
    return dim(
      "supervisor_comments",
      35,
      60,
      [`chars=${n}`],
      "Supervisor comments missing or too brief.",
      ["Generate supervisor-style summary with strengths and growth areas"],
    );
  }
  return dim(
    "supervisor_comments",
    Math.min(95, 55 + n / 20),
    80,
    [`chars=${n}`],
    "Supervisor narrative present with sufficient length for coaching.",
  );
}

function scoreReflection(input: EriComputeInput): EriDimensionScore {
  const n = input.reflective_questions_count;
  if (n < 2) {
    return dim(
      "reflection_quality",
      40,
      65,
      [`questions=${n}`],
      "Insufficient reflective prompts for deliberate practice.",
      ["Provide ≥2–3 reflective questions tied to weak competencies"],
    );
  }
  return dim(
    "reflection_quality",
    Math.min(95, 55 + n * 12),
    85,
    [`questions=${n}`],
    "Reflective questions support metacognitive review.",
  );
}

function scoreObjectives(input: EriComputeInput): EriDimensionScore {
  const lo = input.learning_objectives_count;
  const mapped = input.competencies_mapped;
  let score = 30;
  const ev: string[] = [];
  if (lo >= 2) {
    score += 30;
    ev.push(`objectives=${lo}`);
  } else {
    ev.push(`objectives=${lo}`);
  }
  if (mapped >= 3) {
    score += 30;
    ev.push(`competencies_mapped=${mapped}`);
  } else if (mapped >= 1) {
    score += 15;
    ev.push(`competencies_mapped=${mapped}`);
  }
  const recs: string[] = [];
  if (lo < 2) recs.push("Declare ≥2 learning objectives on templates/presets");
  if (mapped < 3) recs.push("Map rubric items to ACE/CGE competencies");
  return dim(
    "learning_objective_alignment",
    score,
    lo >= 2 && mapped >= 3 ? 85 : 55,
    ev,
    "Alignment between objectives, rubric, and competency graph.",
    recs,
  );
}

function scoreReasoning(input: EriComputeInput): EriDimensionScore {
  const n = input.narrative_chars;
  let score = Math.min(85, 25 + n / 12);
  const recs: string[] = [];
  if (n < 120) {
    score = Math.min(score, 50);
    recs.push("Expand examiner narrative to include clinical reasoning rationale");
  }
  if (input.excerpt_count >= 1) score = Math.min(100, score + 10);
  if (input.assessment_mode === "heuristic_fallback") {
    score = Math.min(score, 45);
    recs.push("Heuristic narratives lack OSCE-grade clinical reasoning depth");
  }
  return dim(
    "clinical_reasoning_quality",
    score,
    n >= 120 ? 80 : 50,
    [`narrative_chars=${n}`, `excerpts=${input.excerpt_count}`],
    "Quality of examiner clinical reasoning narrative.",
    recs,
  );
}

function scoreRemediation(input: EriComputeInput): EriDimensionScore {
  let score = 20;
  const ev: string[] = [];
  if (input.missed_opportunities_count > 0) {
    score += 25;
    ev.push(`missed=${input.missed_opportunities_count}`);
  }
  if (input.remediation_steps > 0) {
    score += 30;
    ev.push(`steps=${input.remediation_steps}`);
  }
  if (input.suggested_next_cases_count > 0) {
    score += 15;
    ev.push(`next=${input.suggested_next_cases_count}`);
  }
  if (input.suggested_reading_count > 0) {
    score += 10;
    ev.push(`reading=${input.suggested_reading_count}`);
  }
  const recs: string[] = [];
  if (score < 70)
    recs.push("Surface missed opportunities with an explicit remediation plan");
  return dim(
    "remediation_quality",
    score,
    ev.length >= 2 ? 82 : 50,
    ev.length ? ev : ["remediation_thin"],
    "Explicit remediation path after performance gaps.",
    recs,
  );
}

function scoreDifficulty(input: EriComputeInput): EriDimensionScore {
  if (!input.difficulty) {
    return dim(
      "difficulty_calibration",
      45,
      50,
      ["difficulty_unset"],
      "Difficulty not recorded on assessment context.",
      ["Stamp difficulty on session / CaseInstance"],
    );
  }
  if (input.difficulty_matches_learner === false) {
    return dim(
      "difficulty_calibration",
      40,
      75,
      [`difficulty=${input.difficulty}`, "mismatch"],
      "Difficulty appears mismatched to learner level.",
      ["Use ACE adaptive difficulty calibration"],
    );
  }
  return dim(
    "difficulty_calibration",
    input.difficulty_matches_learner === true ? 92 : 78,
    input.difficulty_matches_learner == null ? 65 : 85,
    [
      `difficulty=${input.difficulty}`,
      `match=${input.difficulty_matches_learner ?? "unknown"}`,
    ],
    "Difficulty present; match to learner when ACE profile available.",
  );
}

function scoreInterSession(input: EriComputeInput): EriDimensionScore {
  if (input.inter_session_r == null) {
    return dim(
      "inter_session_consistency",
      55,
      45,
      ["series_unavailable"],
      "Insufficient multi-session series for consistency estimate.",
      ["Accumulate ≥2 sessions per learner for consistency tracking"],
    );
  }
  const r = input.inter_session_r;
  let score = 40 + Math.max(0, Math.min(55, r * 55));
  const recs: string[] = [];
  if (r < 0.5) recs.push("Investigate large inter-session score swings for similar cases");
  return dim(
    "inter_session_consistency",
    score,
    75,
    [`r=${Math.round(r * 1000) / 1000}`],
    "Correlation of adjacent session overalls as consistency proxy.",
    recs,
  );
}

function scoreInterRater(input: EriComputeInput): EriDimensionScore {
  if (input.inter_rater_r == null && input.inter_rater_pct_agree == null) {
    return dim(
      "inter_rater_agreement",
      50,
      40,
      ["simulation_unavailable"],
      "No inter-rater simulation available for this assessment.",
      ["Run dual-rater simulation on rubric item scores"],
    );
  }
  const r = input.inter_rater_r ?? 0;
  const pct = input.inter_rater_pct_agree ?? 0;
  const score = Math.min(95, 35 + Math.max(0, r) * 40 + pct * 0.2);
  const recs: string[] = [];
  if (r < 0.6 || pct < 70)
    recs.push("Tighten rubric anchors to improve simulated inter-rater agreement");
  return dim(
    "inter_rater_agreement",
    score,
    70,
    [
      `r=${r == null ? "n/a" : Math.round(r * 1000) / 1000}`,
      `pct_agree=${pct}`,
    ],
    "Simulated dual-rater agreement (not human OSCE κ — disclosed).",
    recs,
  );
}

function scoreLongitudinal(input: EriComputeInput): EriDimensionScore {
  if (input.test_retest_r == null) {
    return dim(
      "longitudinal_stability",
      52,
      45,
      ["retest_unavailable"],
      "No test–retest estimate for this series.",
      ["Collect paired retest overalls for longitudinal stability"],
    );
  }
  const r = input.test_retest_r;
  const score = Math.min(95, 40 + Math.max(0, r) * 55);
  const recs: string[] = [];
  if (r < 0.5) recs.push("Low test–retest stability — review noise and case sampling");
  return dim(
    "longitudinal_stability",
    score,
    75,
    [`test_retest_r=${Math.round(r * 1000) / 1000}`],
    "Longitudinal / test–retest stability of overall scores.",
    recs,
  );
}

function scoreFairness(input: EriComputeInput): EriDimensionScore {
  if (input.fairness_pass == null) {
    return dim(
      "assessment_fairness",
      60,
      45,
      ["fairness_not_audited"],
      "Fairness audit not attached to this assessment.",
      ["Run assessFairnessControls on educational corpus"],
    );
  }
  if (!input.fairness_pass) {
    return dim(
      "assessment_fairness",
      45,
      80,
      ["fairness_partial_or_fail"],
      "Fairness controls show partial/fail findings.",
      ["Remediate failing fairness dimensions before high-stakes use"],
    );
  }
  return dim(
    "assessment_fairness",
    88,
    80,
    ["fairness_pass"],
    "Fairness controls within educational tolerance.",
  );
}

function scoreLanguageParity(input: EriComputeInput): EriDimensionScore {
  const loc = input.locale || "";
  if (!loc) {
    return dim(
      "language_parity",
      40,
      60,
      ["locale_missing"],
      "Locale missing on assessment.",
      ["Always stamp session language/locale"],
    );
  }
  if (input.language_parity_within_tolerance === false) {
    return dim(
      "language_parity",
      42,
      85,
      [
        `locale=${loc}`,
        `abs_diff=${input.language_parity_abs_diff ?? "?"}`,
      ],
      "EN/AR score means exceeded educational parity tolerance.",
      ["Investigate bilingual scoring bias under matched seeds"],
    );
  }
  if (input.language_parity_within_tolerance === true) {
    return dim(
      "language_parity",
      92,
      85,
      [
        `locale=${loc}`,
        `abs_diff=${input.language_parity_abs_diff ?? 0}`,
      ],
      "Language parity within tolerance for matched educational corpus.",
    );
  }
  return dim(
    "language_parity",
    /^(en|ar)/i.test(loc) ? 75 : 60,
    55,
    [`locale=${loc}`, "parity_unmeasured"],
    "Locale set; corpus-level parity not yet attached.",
    ["Attach localeScoreParity to ERI corpus aggregates"],
  );
}

const SCORERS: Record<
  EriDimensionId,
  (i: EriComputeInput) => EriDimensionScore
> = {
  competency_scoring_consistency: scoreCompetencyConsistency,
  feedback_usefulness: scoreFeedbackUsefulness,
  feedback_specificity: scoreFeedbackSpecificity,
  actionability: scoreActionability,
  supervisor_comments: scoreSupervisor,
  reflection_quality: scoreReflection,
  learning_objective_alignment: scoreObjectives,
  clinical_reasoning_quality: scoreReasoning,
  remediation_quality: scoreRemediation,
  difficulty_calibration: scoreDifficulty,
  inter_session_consistency: scoreInterSession,
  inter_rater_agreement: scoreInterRater,
  longitudinal_stability: scoreLongitudinal,
  assessment_fairness: scoreFairness,
  language_parity: scoreLanguageParity,
};

export function confidenceInterval(
  overall: number,
  subscores: EriDimensionScore[],
): EriConfidenceInterval {
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

export function computeEducationalReliabilityIndex(
  input: EriComputeInput,
): EducationalReliabilityIndex {
  const subscores = ERI_WEIGHT_MATRIX.map((w) => SCORERS[w.id](input));
  const overall = clamp(
    subscores.reduce((a, s) => a + s.score * s.weight, 0),
  );
  const ci = confidenceInterval(overall, subscores);
  const recommendations = [
    ...new Set(subscores.flatMap((s) => s.recommendations)),
  ].slice(0, 12);

  const low = subscores
    .filter((s) => s.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => `${s.id}=${s.score}`);

  const educational_reasoning = [
    `ERI ${overall}/100 (v${ERI_VERSION}) for session ${input.session_id ?? "n/a"} @ ${input.locale}.`,
    `Mode=${input.assessment_mode ?? "unknown"}; overall_score=${input.overall_score}.`,
    low.length
      ? `Lowest dimensions: ${low.join(", ")}.`
      : "No dimension scored below 70.",
    `95% CI ≈ [${ci.lower}, ${ci.upper}] via weighted dimension uncertainty.`,
  ].join(" ");

  const evidenceDimensions: Record<string, string[]> = {};
  for (const s of subscores) evidenceDimensions[s.id] = s.evidence;

  return {
    overall,
    subscores,
    confidence_interval: ci,
    evidence: {
      learner_id: input.learner_id ?? null,
      session_id: input.session_id ?? null,
      locale: input.locale,
      difficulty: input.difficulty ?? null,
      assessment_mode: input.assessment_mode ?? null,
      dimensions: evidenceDimensions,
    },
    educational_reasoning,
    recommendations,
    versions: {
      eri_version: ERI_VERSION,
      assessment_version:
        input.assessment_version ?? ASSESSMENT_SCHEMA_VERSION,
      rubric_version: input.rubric_version ?? RUBRIC_SCHEMA_VERSION,
      competency_graph_version:
        input.competency_graph_version ?? CGE_ENGINE_VERSION,
      adaptive_curriculum_version:
        input.adaptive_curriculum_version ?? ACE_ENGINE_VERSION,
      prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
      model_version: input.model_version ?? null,
      computed_at: new Date().toISOString(),
    },
    weight_matrix_version: ERI_VERSION,
  };
}
