/**
 * Learner Authenticity Score (LAS) — Workstream B.
 */

import {
  LAS_VERSION,
  type AuthenticityScoreResult,
  type LearnerRatingForm,
} from "@/lib/validation/types";

const WEIGHTS: Record<keyof LearnerRatingForm["ratings"], number> = {
  immersion: 0.14,
  learning_value: 0.18,
  confidence_after: 0.12,
  diagnostic_reasoning: 0.14,
  interview_confidence: 0.12,
  perceived_realism: 0.14,
  educational_usefulness: 0.16,
};

function likertTo100(n: number): number {
  return ((n - 1) / 4) * 100;
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function scoreLearnerForm(form: LearnerRatingForm): number {
  let total = 0;
  for (const [k, w] of Object.entries(WEIGHTS) as Array<
    [keyof LearnerRatingForm["ratings"], number]
  >) {
    total += likertTo100(form.ratings[k]) * w;
  }
  return Math.round(total * 10) / 10;
}

export function computeLearnerAuthenticityScore(
  forms: LearnerRatingForm[],
): AuthenticityScoreResult {
  const keys = Object.keys(WEIGHTS) as Array<keyof LearnerRatingForm["ratings"]>;
  const subscores = keys.map((id) => {
    const vals = forms.map((f) => likertTo100(f.ratings[id]));
    const score = Math.round(mean(vals) * 10) / 10;
    const weight = WEIGHTS[id];
    return {
      id,
      score,
      weight,
      weighted_contribution: Math.round(score * weight * 10) / 10,
    };
  });
  const perForm = forms.map(scoreLearnerForm);
  const overall = Math.round(mean(perForm) * 10) / 10;
  const s = sd(perForm);
  const se = forms.length ? s / Math.sqrt(forms.length) : 0;
  const margin = 1.96 * se;

  const recommendations: string[] = [];
  if (forms.length < 20) {
    recommendations.push(
      "LAS n < 20 — expand learner cohorts across med student / resident / GP tracks.",
    );
  }
  const learning = subscores.find((s) => s.id === "learning_value")?.score ?? 0;
  if (learning < 70) {
    recommendations.push(
      "Learning value below target — tighten educational openings and feedback loops.",
    );
  }

  return {
    overall,
    subscores,
    n_ratings: forms.length,
    ci95: {
      lower: Math.round(Math.max(0, overall - margin) * 10) / 10,
      upper: Math.round(Math.min(100, overall + margin) * 10) / 10,
    },
    version: LAS_VERSION,
    computed_at: new Date().toISOString(),
    recommendations,
  };
}

export function emptyLearnerForm(
  partial: Pick<LearnerRatingForm, "rater_id" | "rater_role" | "case_id">,
): LearnerRatingForm {
  return {
    ...partial,
    ratings: {
      immersion: 3,
      learning_value: 3,
      confidence_after: 3,
      diagnostic_reasoning: 3,
      interview_confidence: 3,
      perceived_realism: 3,
      educational_usefulness: 3,
    },
    rated_at: new Date().toISOString(),
  };
}
