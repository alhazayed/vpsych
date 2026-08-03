/**
 * Institution / cohort analytics aggregations.
 */

import type {
  AssignmentCompletion,
  LearningAssignment,
} from "@/lib/enterprise/types";

export type LearnerOutcomeRow = {
  user_id: string;
  display_name?: string;
  scores: number[];
  competency_scores?: Record<string, number>;
  completed_required: number;
  total_required: number;
  at_risk?: boolean;
};

export type InstitutionAnalytics = {
  institution_id: string;
  learner_count: number;
  assignment_count: number;
  required_assignment_count: number;
  elective_assignment_count: number;
  completion_count: number;
  pass_rate: number | null;
  mean_score: number | null;
  competency_distribution: Record<string, { mean: number; n: number }>;
  at_risk_learners: Array<{ user_id: string; reason: string }>;
  program_outcomes: {
    required_completion_rate: number | null;
    overdue_open_assignments: number;
  };
};

export function computePassRate(
  completions: AssignmentCompletion[],
  passThreshold = 70,
): number | null {
  const scored = completions.filter(
    (c) => c.score != null && ["submitted", "passed", "failed"].includes(c.status),
  );
  if (!scored.length) return null;
  const passed = scored.filter(
    (c) => (c.score as number) >= passThreshold || c.status === "passed",
  );
  return Math.round((passed.length / scored.length) * 1000) / 10;
}

export function computeMeanScore(
  completions: AssignmentCompletion[],
): number | null {
  const scores = completions
    .map((c) => c.score)
    .filter((s): s is number => typeof s === "number");
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function competencyDistribution(
  rows: LearnerOutcomeRow[],
): Record<string, { mean: number; n: number }> {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const row of rows) {
    for (const [k, v] of Object.entries(row.competency_scores ?? {})) {
      if (!acc[k]) acc[k] = { sum: 0, n: 0 };
      acc[k].sum += v;
      acc[k].n += 1;
    }
  }
  const out: Record<string, { mean: number; n: number }> = {};
  for (const [k, v] of Object.entries(acc)) {
    out[k] = { mean: Math.round((v.sum / v.n) * 10) / 10, n: v.n };
  }
  return out;
}

export function identifyAtRiskLearners(
  rows: LearnerOutcomeRow[],
  opts?: { minMean?: number; minCompletionRate?: number },
): Array<{ user_id: string; reason: string }> {
  const minMean = opts?.minMean ?? 55;
  const minCompletion = opts?.minCompletionRate ?? 0.5;
  const atRisk: Array<{ user_id: string; reason: string }> = [];
  for (const row of rows) {
    const mean =
      row.scores.length > 0
        ? row.scores.reduce((a, b) => a + b, 0) / row.scores.length
        : null;
    const completionRate =
      row.total_required > 0 ? row.completed_required / row.total_required : 1;
    if (mean != null && mean < minMean) {
      atRisk.push({ user_id: row.user_id, reason: `mean_score_below_${minMean}` });
    } else if (completionRate < minCompletion) {
      atRisk.push({
        user_id: row.user_id,
        reason: `required_completion_below_${Math.round(minCompletion * 100)}pct`,
      });
    } else if (row.at_risk) {
      atRisk.push({ user_id: row.user_id, reason: "flagged" });
    }
  }
  return atRisk;
}

export function buildInstitutionAnalytics(input: {
  institution_id: string;
  assignments: LearningAssignment[];
  completions: AssignmentCompletion[];
  learners: LearnerOutcomeRow[];
  now?: Date;
}): InstitutionAnalytics {
  const now = input.now ?? new Date();
  const required = input.assignments.filter((a) => a.is_required);
  const electives = input.assignments.filter((a) => a.is_elective);
  const overdue = input.assignments.filter(
    (a) =>
      a.status === "published" &&
      a.due_at &&
      new Date(a.due_at).getTime() < now.getTime(),
  );

  const requiredIds = new Set(required.map((a) => a.id));
  const requiredCompletions = input.completions.filter((c) =>
    requiredIds.has(c.assignment_id),
  );
  const requiredDone = requiredCompletions.filter((c) =>
    ["submitted", "passed", "failed"].includes(c.status),
  );
  const requiredCompletionRate =
    required.length === 0 || input.learners.length === 0
      ? null
      : Math.round(
          (requiredDone.length /
            Math.max(1, required.length * input.learners.length)) *
            1000,
        ) / 10;

  return {
    institution_id: input.institution_id,
    learner_count: input.learners.length,
    assignment_count: input.assignments.length,
    required_assignment_count: required.length,
    elective_assignment_count: electives.length,
    completion_count: input.completions.length,
    pass_rate: computePassRate(input.completions),
    mean_score: computeMeanScore(input.completions),
    competency_distribution: competencyDistribution(input.learners),
    at_risk_learners: identifyAtRiskLearners(input.learners),
    program_outcomes: {
      required_completion_rate: requiredCompletionRate,
      overdue_open_assignments: overdue.length,
    },
  };
}
