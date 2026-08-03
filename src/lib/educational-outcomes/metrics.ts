/**
 * Educational outcomes metrics — growth, reliability, retention, scoring.
 */

import type { LearnerCompetency, LearnerProfile } from "@/lib/ace/types";
import type { AbilityTier } from "./journeys";

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export function assessedMean(comps: LearnerCompetency[]): number {
  const a = comps.filter((c) => c.samples > 0);
  return a.length ? mean(a.map((c) => c.score)) : 0;
}

export function focusMean(
  comps: LearnerCompetency[],
  focus: string[],
): number {
  const rows = comps.filter(
    (c) => focus.includes(c.competency_id) && c.samples > 0,
  );
  return rows.length ? mean(rows.map((c) => c.score)) : 0;
}

/** OLS slope of a series (index → value). */
export function olsSlope(series: number[]): number {
  if (series.length < 2) return 0;
  const n = series.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += series[i]!;
    sumXY += i * series[i]!;
    sumXX += i * i;
  }
  const den = n * sumXX - sumX * sumX;
  if (den === 0) return 0;
  return (n * sumXY - sumX * sumY) / den;
}

export type GrowthReport = {
  start_overall: number;
  end_overall: number;
  delta_overall: number;
  start_focus: number;
  end_focus: number;
  delta_focus: number;
  learning_curve: number[];
  curve_slope: number;
  final_velocity: number;
  final_confidence: number;
  sessions: number;
};

export function buildGrowthReport(
  learningCurve: number[],
  startFocus: number,
  endFocus: number,
  profile: LearnerProfile,
): GrowthReport {
  const start = learningCurve[0] ?? 0;
  const end = learningCurve[learningCurve.length - 1] ?? 0;
  return {
    start_overall: Math.round(start * 10) / 10,
    end_overall: Math.round(end * 10) / 10,
    delta_overall: Math.round((end - start) * 10) / 10,
    start_focus: Math.round(startFocus * 10) / 10,
    end_focus: Math.round(endFocus * 10) / 10,
    delta_focus: Math.round((endFocus - startFocus) * 10) / 10,
    learning_curve: learningCurve.map((x) => Math.round(x * 10) / 10),
    curve_slope: Math.round(olsSlope(learningCurve) * 1000) / 1000,
    final_velocity: profile.learning_velocity,
    final_confidence: profile.confidence_score,
    sessions: learningCurve.length,
  };
}

export type ReliabilityReport = {
  repeats: number;
  score_series: number[];
  mean: number;
  std_dev: number;
  /** Max absolute deviation from mean */
  max_abs_dev: number;
  /** Acceptable if std_dev ≤ 5 and max_abs_dev ≤ 8 for identical inputs */
  acceptable: boolean;
};

export function analyzeReliability(scores: number[]): ReliabilityReport {
  const m = mean(scores);
  const sd = stdDev(scores);
  const maxAbs = scores.length
    ? Math.max(...scores.map((s) => Math.abs(s - m)))
    : 0;
  return {
    repeats: scores.length,
    score_series: scores.map((s) => Math.round(s * 10) / 10),
    mean: Math.round(m * 10) / 10,
    std_dev: Math.round(sd * 100) / 100,
    max_abs_dev: Math.round(maxAbs * 10) / 10,
    acceptable: sd <= 5 && maxAbs <= 8,
  };
}

export type RetentionReport = {
  pre_gap_focus: number;
  post_gap_focus: number;
  retained_ratio: number;
  gap_days: number;
  /** Acceptable if retained ≥ 85% after 45-day idle with decay model */
  acceptable: boolean;
};

export function analyzeRetention(
  pre: number,
  post: number,
  gapDays: number,
): RetentionReport {
  const ratio = pre > 0 ? post / pre : 1;
  // CBME: ≥85% at ≤60d idle; ≥80% at longer gaps without refresher (skill fade expected)
  const threshold = gapDays <= 60 ? 0.85 : 0.8;
  return {
    pre_gap_focus: Math.round(pre * 10) / 10,
    post_gap_focus: Math.round(post * 10) / 10,
    retained_ratio: Math.round(ratio * 1000) / 1000,
    gap_days: gapDays,
    acceptable: ratio >= threshold,
  };
}

export type TierOutcome = {
  tier: AbilityTier;
  improved: boolean;
  /** Excellent learners should see complexity adaptations */
  increasing_challenge: boolean;
  complexity_hits: number;
  remediation_hits: number;
  growth: GrowthReport;
};

/** Board educational effectiveness score (0–100). */
export function computeEffectivenessScore(input: {
  weakImproved: boolean;
  averageProgressed: boolean;
  excellentChallenged: boolean;
  meanDeltaFocus: number;
  minWeakDelta: number;
  reliabilityOk: boolean;
  retentionOk: boolean;
  retentionRatio: number;
  feedbackOk: boolean;
  adaptiveOk: boolean;
  graphOk: boolean;
  consistencyOk: boolean;
}): { score: number; verdict: "FAILED" | "WITH_RECOMMENDATIONS" | "CERTIFIED" } {
  let score = 40;
  if (input.weakImproved) score += 10;
  if (input.averageProgressed) score += 8;
  if (input.excellentChallenged) score += 8;
  if (input.meanDeltaFocus >= 8) score += 10;
  else if (input.meanDeltaFocus >= 4) score += 5;
  if (input.reliabilityOk) score += 8;
  if (input.retentionOk) score += 6;
  if (input.feedbackOk) score += 5;
  if (input.adaptiveOk) score += 5;
  if (input.graphOk) score += 5;
  if (input.consistencyOk) score += 5;
  score = Math.min(100, score);
  // Deduct when any weak archetype barely moves, or long-gap retention < 85%
  if (input.minWeakDelta < 8) score -= 4;
  if (input.retentionRatio < 0.85) score -= 3;
  score = Math.max(0, Math.min(100, score));

  let verdict: "FAILED" | "WITH_RECOMMENDATIONS" | "CERTIFIED" = "FAILED";
  const certReady =
    score >= 92 &&
    input.weakImproved &&
    input.reliabilityOk &&
    input.minWeakDelta >= 10 &&
    input.retentionRatio >= 0.85;
  if (certReady) {
    verdict = "CERTIFIED";
  } else if (
    score >= 80 &&
    input.weakImproved &&
    input.averageProgressed &&
    input.reliabilityOk
  ) {
    verdict = "WITH_RECOMMENDATIONS";
  }
  return { score, verdict };
}
