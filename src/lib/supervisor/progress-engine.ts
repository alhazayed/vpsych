/**
 * Progress Engine — longitudinal therapist skill trends.
 */

import { weightedTherapistOverall } from "@/lib/supervisor/therapist-evaluation";
import type {
  ExpertReviewReport,
  ProgressSnapshot,
  TherapistSkillId,
} from "@/lib/supervisor/types";

export function buildProgressSnapshot(input: {
  review: ExpertReviewReport;
  priorSkillScores?: Array<{ id: TherapistSkillId; score: number }>;
  sessionsReviewed?: number;
}): ProgressSnapshot {
  const overall = weightedTherapistOverall(input.review.skill_scores);
  const priorMap = new Map(
    (input.priorSkillScores ?? []).map((p) => [p.id, p.score]),
  );

  const skill_trends = input.review.skill_scores.map((s) => {
    const prev = priorMap.get(s.id);
    return {
      id: s.id,
      score: s.score,
      delta: prev == null ? 0 : s.score - prev,
    };
  });

  const deltas = skill_trends.map((t) => t.delta);
  const meanDelta =
    deltas.length === 0
      ? 0
      : deltas.reduce((a, b) => a + b, 0) / deltas.length;

  const regression =
    meanDelta < -5 ||
    skill_trends.filter((t) => t.delta < -10).length >= 3;
  const plateau =
    !regression &&
    Math.abs(meanDelta) < 2 &&
    (input.sessionsReviewed ?? 0) >= 5;

  return {
    sessions_reviewed: input.sessionsReviewed ?? 1,
    overall_ema: overall,
    skill_trends,
    plateau,
    regression,
    velocity: Math.round(meanDelta * 10) / 10,
  };
}

export function buildProgressGraph(
  points: Array<{ overall: number }>,
): Array<{ n: number; overall: number }> {
  return points.map((p, i) => ({ n: i + 1, overall: p.overall }));
}
