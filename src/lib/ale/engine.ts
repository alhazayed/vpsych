/**
 * Adaptive Learning Effectiveness engine — weighted scientific scoring (ALE v1.0).
 */

import {
  ACE_ENGINE_VERSION,
  CGE_ENGINE_VERSION,
} from "@/lib/scientific/versions";
import type {
  AdaptiveLearningEffectiveness,
  AleComputeInput,
  AleConfidenceInterval,
  AleDimensionScore,
} from "@/lib/ale/types";
import {
  ALE_VERSION,
  ALE_WEIGHT_MATRIX,
  assertWeightMatrixValid,
  type AleDimensionId,
  weightMap,
} from "@/lib/ale/weights";

assertWeightMatrixValid();

const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function dim(
  id: AleDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  scientific_reasoning: string,
  recommendations: string[] = [],
): AleDimensionScore {
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

export function difficultyRank(d: string): number {
  return DIFFICULTY_RANK[d] ?? 1;
}

function linearSlope(ys: number[]): number | null {
  if (ys.length < 2) return null;
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

function scoreDifficultyProgression(input: AleComputeInput): AleDimensionScore {
  const ranks = input.difficulty_sequence.map(difficultyRank);
  if (ranks.length < 2) {
    return dim(
      "difficulty_progression",
      40,
      40,
      ["sequence_short"],
      "Insufficient difficulty sequence.",
      ["Run ≥3 adaptive sessions to evaluate progression"],
    );
  }
  const overalls = input.session_overalls;
  let appropriate = 0;
  let checked = 0;
  for (let i = 1; i < ranks.length; i++) {
    const dDiff = ranks[i]! - ranks[i - 1]!;
    const oPrev = overalls[i - 1] ?? 50;
    checked += 1;
    // Rising difficulty after strong performance, holding/lowering after weak
    if (oPrev >= 70 && dDiff >= 0) appropriate += 1;
    else if (oPrev < 55 && dDiff <= 0) appropriate += 1;
    else if (oPrev >= 55 && oPrev < 70 && Math.abs(dDiff) <= 1) appropriate += 1;
  }
  const ratio = checked ? appropriate / checked : 0;
  const score = 35 + ratio * 60;
  const recs: string[] = [];
  if (ratio < 0.6)
    recs.push("Calibrate difficulty deltas to mastery — avoid blind escalation");
  return dim(
    "difficulty_progression",
    score,
    80,
    [`appropriate_ratio=${Math.round(ratio * 100)}%`, `steps=${checked}`],
    "Difficulty changes relative to prior session performance.",
    recs,
  );
}

function scoreCaseSequencing(input: AleComputeInput): AleDimensionScore {
  const n = input.total_cases;
  if (n < 2) {
    return dim(
      "case_sequencing",
      40,
      40,
      ["cases<2"],
      "Too few cases to evaluate sequencing.",
    );
  }
  const uniq = input.unique_fingerprints;
  const diversity = uniq / n;
  // Good sequencing: not all identical, not pure random thrash — prefer high unique with focus
  let score = 30 + diversity * 50;
  if (input.focus_attempts > 0) {
    const hit = input.focus_hits_on_weakest / input.focus_attempts;
    score += hit * 20;
  }
  const recs: string[] = [];
  if (diversity < 0.4)
    recs.push("Increase fingerprint diversity — avoid identical next-case loops");
  if (diversity > 0.95 && input.focus_hits_on_weakest === 0)
    recs.push("High diversity without remediation focus — check adaptive rules");
  return dim(
    "case_sequencing",
    score,
    75,
    [
      `unique_fingerprints=${uniq}`,
      `total=${n}`,
      `focus_hit_rate=${
        input.focus_attempts
          ? Math.round((input.focus_hits_on_weakest / input.focus_attempts) * 100)
          : 0
      }%`,
    ],
    "Next-case uniqueness balanced with deficit targeting.",
    recs,
  );
}

function scoreRemediation(input: AleComputeInput): AleDimensionScore {
  const attempts = input.focus_attempts;
  if (attempts === 0) {
    return dim(
      "competency_remediation",
      35,
      50,
      ["no_focus_attempts"],
      "No remediation focus recorded.",
      ["Ensure adaptive_mode selects focus competencies for weak skills"],
    );
  }
  const hit = input.focus_hits_on_weakest / attempts;
  const remShare =
    input.total_cases > 0 ? input.remediation_sessions / input.total_cases : 0;
  const score = 25 + hit * 50 + Math.min(25, remShare * 40);
  const recs: string[] = [];
  if (hit < 0.5)
    recs.push("Raise rate at which next cases target the weakest competency");
  return dim(
    "competency_remediation",
    score,
    85,
    [
      `focus_hit_rate=${Math.round(hit * 100)}%`,
      `remediation_share=${Math.round(remShare * 100)}%`,
    ],
    "Remediation focus on measured competency deficits.",
    recs,
  );
}

function scoreEfficiency(input: AleComputeInput): AleDimensionScore {
  const ys = input.session_overalls;
  if (ys.length < 2) {
    return dim(
      "learning_efficiency",
      40,
      40,
      ["sessions<2"],
      "Insufficient sessions for efficiency.",
    );
  }
  const gain = ys[ys.length - 1]! - ys[0]!;
  const perSession = gain / (ys.length - 1);
  const adaptiveShare =
    input.total_cases > 0 ? input.adaptive_decisions / input.total_cases : 0;
  let score = 40 + Math.max(-10, Math.min(40, perSession * 8));
  score += adaptiveShare * 20;
  const recs: string[] = [];
  if (perSession < 1)
    recs.push("Low gain per session — tighten adaptive remediation loops");
  return dim(
    "learning_efficiency",
    score,
    75,
    [
      `gain=${Math.round(gain * 10) / 10}`,
      `per_session=${Math.round(perSession * 10) / 10}`,
      `adaptive_share=${Math.round(adaptiveShare * 100)}%`,
    ],
    "Learning gain per session under adaptive decisions.",
    recs,
  );
}

function scoreRetention(input: AleComputeInput): AleDimensionScore {
  const ys = input.session_overalls;
  if (ys.length < 4) {
    return dim(
      "knowledge_retention",
      50,
      45,
      ["sessions<4"],
      "Need ≥4 sessions to estimate retention.",
      ["Extend longitudinal adaptive runs"],
    );
  }
  const mid = Math.floor(ys.length / 2);
  const midMean =
    ys.slice(1, mid + 1).reduce((a, b) => a + b, 0) / Math.max(1, mid);
  const lateMean =
    ys.slice(mid).reduce((a, b) => a + b, 0) / Math.max(1, ys.length - mid);
  const retention = lateMean - midMean; // should not collapse
  const score = clamp(70 + retention * 2);
  const recs: string[] = [];
  if (retention < -5)
    recs.push("Late-session drop detected — add spaced remediation / retention cases");
  return dim(
    "knowledge_retention",
    score,
    70,
    [
      `mid_mean=${Math.round(midMean * 10) / 10}`,
      `late_mean=${Math.round(lateMean * 10) / 10}`,
      `delta=${Math.round(retention * 10) / 10}`,
    ],
    "Retention of mid-trajectory gains in later sessions.",
    recs,
  );
}

function scoreMistakeReduction(input: AleComputeInput): AleDimensionScore {
  const misses = input.miss_flag_counts;
  if (misses.length < 2) {
    return dim(
      "reduction_of_repeated_mistakes",
      48,
      40,
      ["miss_series_short"],
      "Insufficient miss-flag series.",
      ["Track miss flags longitudinally"],
    );
  }
  const first = misses.slice(0, Math.ceil(misses.length / 2));
  const last = misses.slice(Math.floor(misses.length / 2));
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const drop = mean(first) - mean(last);
  const score = clamp(55 + drop * 15);
  const recs: string[] = [];
  if (drop < 0)
    recs.push("Repeated mistakes not declining — intensify remediation focus");
  return dim(
    "reduction_of_repeated_mistakes",
    score,
    75,
    [
      `early_miss_mean=${Math.round(mean(first) * 10) / 10}`,
      `late_miss_mean=${Math.round(mean(last) * 10) / 10}`,
      `drop=${Math.round(drop * 10) / 10}`,
    ],
    "Decline in repeated miss flags over the learning trajectory.",
    recs,
  );
}

function scoreImprovementSpeed(input: AleComputeInput): AleDimensionScore {
  const slope = linearSlope(input.session_overalls);
  if (slope == null) {
    return dim(
      "improvement_speed",
      40,
      40,
      ["slope=n/a"],
      "Cannot estimate improvement slope.",
    );
  }
  // slope of ~2–5 points/session is healthy; negative is poor
  const score = clamp(50 + slope * 10);
  const recs: string[] = [];
  if (slope < 0.5)
    recs.push("Slow improvement slope — review adaptive rule priorities");
  return dim(
    "improvement_speed",
    score,
    80,
    [`slope=${Math.round(slope * 100) / 100}`],
    "Linear improvement speed across longitudinal sessions.",
    recs,
  );
}

function scoreDiversity(input: AleComputeInput): AleDimensionScore {
  if (input.total_cases < 2) {
    return dim(
      "case_diversity",
      40,
      40,
      ["cases<2"],
      "Insufficient cases for diversity.",
    );
  }
  const disorderDiv = input.unique_disorders / input.total_cases;
  const diffDiv = input.unique_difficulties / Math.min(4, input.total_cases);
  const score = 30 + disorderDiv * 40 + Math.min(30, diffDiv * 40);
  const recs: string[] = [];
  if (input.unique_disorders < 2)
    recs.push("Expand disorder diversity while preserving remediation focus");
  return dim(
    "case_diversity",
    score,
    70,
    [
      `unique_disorders=${input.unique_disorders}`,
      `unique_difficulties=${input.unique_difficulties}`,
      `total=${input.total_cases}`,
    ],
    "Case diversity across disorders and difficulty levels.",
    recs,
  );
}

function scoreObjectiveAlignment(input: AleComputeInput): AleDimensionScore {
  if (input.objective_alignment_attempts === 0) {
    return dim(
      "instructor_objective_alignment",
      55,
      45,
      ["no_objectives"],
      "No instructor objectives attached — neutral-mid score.",
      ["Attach instructor presets / primary objectives to adaptive runs"],
    );
  }
  const hit =
    input.objective_alignment_hits / input.objective_alignment_attempts;
  const score = 35 + hit * 60;
  const recs: string[] = [];
  if (hit < 0.5)
    recs.push("Align adaptive focus with instructor primary objectives");
  return dim(
    "instructor_objective_alignment",
    score,
    80,
    [`alignment_rate=${Math.round(hit * 100)}%`],
    "Alignment of adaptive focus with instructor objectives.",
    recs,
  );
}

function scoreAdaptiveAccuracy(input: AleComputeInput): AleDimensionScore {
  if (input.focus_attempts === 0) {
    return dim(
      "adaptive_accuracy",
      40,
      45,
      ["no_focus"],
      "No adaptive focus decisions to score.",
      ["Enable adaptive_mode and ACE rules"],
    );
  }
  const hit = input.focus_hits_on_weakest / input.focus_attempts;
  const score = 30 + hit * 65;
  const recs: string[] = [];
  if (hit < 0.6)
    recs.push("Improve adaptive accuracy — focus should match weakest assessed competency");
  return dim(
    "adaptive_accuracy",
    score,
    85,
    [`accuracy=${Math.round(hit * 100)}%`],
    "Accuracy of adaptive focus vs measured weakest competency.",
    recs,
  );
}

function scoreGraphUtilization(input: AleComputeInput): AleDimensionScore {
  if (input.total_cases === 0) {
    return dim(
      "competency_graph_utilization",
      40,
      40,
      ["no_cases"],
      "No cases for graph utilization.",
    );
  }
  const share = input.graph_utilized_sessions / input.total_cases;
  const score = 35 + share * 60;
  const recs: string[] = [];
  if (share < 0.5)
    recs.push("Increase Competency Graph Engine utilization for root-cause remediation");
  return dim(
    "competency_graph_utilization",
    score,
    75,
    [
      `graph_sessions=${input.graph_utilized_sessions}`,
      `share=${Math.round(share * 100)}%`,
    ],
    "Share of sessions using graph-aware adaptive generation.",
    recs,
  );
}

function scorePathwayQuality(input: AleComputeInput): AleDimensionScore {
  if (input.pathway_steps <= 0) {
    return dim(
      "learning_pathway_quality",
      40,
      50,
      ["pathway_empty"],
      "Learning pathway empty or missing.",
      ["Generate curriculum / graph learning pathways for learners"],
    );
  }
  const score = Math.min(95, 45 + input.pathway_steps * 8);
  return dim(
    "learning_pathway_quality",
    score,
    80,
    [`pathway_steps=${input.pathway_steps}`],
    "Coherence/length of generated learning pathway.",
  );
}

const SCORERS: Record<AleDimensionId, (i: AleComputeInput) => AleDimensionScore> =
  {
    difficulty_progression: scoreDifficultyProgression,
    case_sequencing: scoreCaseSequencing,
    competency_remediation: scoreRemediation,
    learning_efficiency: scoreEfficiency,
    knowledge_retention: scoreRetention,
    reduction_of_repeated_mistakes: scoreMistakeReduction,
    improvement_speed: scoreImprovementSpeed,
    case_diversity: scoreDiversity,
    instructor_objective_alignment: scoreObjectiveAlignment,
    adaptive_accuracy: scoreAdaptiveAccuracy,
    competency_graph_utilization: scoreGraphUtilization,
    learning_pathway_quality: scorePathwayQuality,
  };

export function confidenceInterval(
  overall: number,
  subscores: AleDimensionScore[],
): AleConfidenceInterval {
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

export function computeAdaptiveLearningEffectiveness(
  input: AleComputeInput,
): AdaptiveLearningEffectiveness {
  const subscores = ALE_WEIGHT_MATRIX.map((w) => SCORERS[w.id](input));
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

  const learning_curve = input.session_overalls.map((overallScore, i) => ({
    session: i + 1,
    overall: Math.round(overallScore * 10) / 10,
  }));
  const difficulty_curve = input.difficulty_sequence.map((d, i) => ({
    session: i + 1,
    difficulty: d,
    rank: difficultyRank(d),
  }));

  const curriculum_quality_report = [
    `ALE ${overall}/100 (v${ALE_VERSION}) for archetype=${input.learner_archetype ?? "n/a"} across ${input.session_overalls.length} sessions.`,
    `ACE=${input.adaptive_version ?? ACE_ENGINE_VERSION}; CGE=${input.competency_graph_version ?? CGE_ENGINE_VERSION}.`,
    `Adaptive decisions=${input.adaptive_decisions}; graph sessions=${input.graph_utilized_sessions}; pathway_steps=${input.pathway_steps}.`,
    low.length
      ? `Lowest dimensions: ${low.join(", ")}.`
      : "No dimension scored below 70.",
    `95% CI ≈ [${ci.lower}, ${ci.upper}].`,
  ].join(" ");

  const evidenceDimensions: Record<string, string[]> = {};
  for (const s of subscores) evidenceDimensions[s.id] = s.evidence;

  return {
    overall,
    subscores,
    confidence_interval: ci,
    evidence: {
      learner_archetype: input.learner_archetype ?? null,
      sessions: input.session_overalls.length,
      dimensions: evidenceDimensions,
    },
    curriculum_quality_report,
    recommendations,
    learning_curve,
    difficulty_curve,
    versions: {
      ale_version: ALE_VERSION,
      adaptive_version: input.adaptive_version ?? ACE_ENGINE_VERSION,
      curriculum_version: input.curriculum_version ?? ACE_ENGINE_VERSION,
      competency_graph_version:
        input.competency_graph_version ?? CGE_ENGINE_VERSION,
      computed_at: new Date().toISOString(),
    },
    weight_matrix_version: ALE_VERSION,
  };
}
