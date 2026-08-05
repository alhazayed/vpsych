/**
 * Psychiatrist Authenticity Score (PAS) — Workstream A.
 * Aggregates blinded clinician Likert ratings into a 0–100 score.
 */

import {
  PAS_VERSION,
  type AuthenticityScoreResult,
  type PsychiatristRatingForm,
} from "@/lib/validation/types";

const WEIGHTS: Record<keyof PsychiatristRatingForm["ratings"], number> = {
  clinical_realism: 0.16,
  diagnostic_authenticity: 0.14,
  emotional_authenticity: 0.14,
  consistency: 0.12,
  natural_conversation: 0.14,
  therapeutic_alliance: 0.1,
  interview_difficulty: 0.06,
  overall_realism: 0.14,
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

/** Convert one form to 0–100 weighted PAS contribution. */
export function scorePsychiatristForm(form: PsychiatristRatingForm): number {
  let total = 0;
  for (const [k, w] of Object.entries(WEIGHTS) as Array<
    [keyof PsychiatristRatingForm["ratings"], number]
  >) {
    total += likertTo100(form.ratings[k]) * w;
  }
  return Math.round(total * 10) / 10;
}

export function computePsychiatristAuthenticityScore(
  forms: PsychiatristRatingForm[],
): AuthenticityScoreResult {
  const keys = Object.keys(WEIGHTS) as Array<
    keyof PsychiatristRatingForm["ratings"]
  >;
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

  const perForm = forms.map(scorePsychiatristForm);
  const overall = Math.round(mean(perForm) * 10) / 10;
  const s = sd(perForm);
  const se = forms.length ? s / Math.sqrt(forms.length) : 0;
  const margin = 1.96 * se;

  const suspectedAiRate =
    forms.length === 0
      ? null
      : forms.filter((f) => f.suspected_ai === true).length / forms.length;

  const recommendations: string[] = [];
  if (forms.length < 8) {
    recommendations.push(
      "PAS n < 8 — recruit more blinded consultant/resident raters before publication claims.",
    );
  }
  if (overall < 70) {
    recommendations.push(
      "PAS < 70 — prioritize emotional authenticity and natural conversation remediations.",
    );
  }
  if (suspectedAiRate != null && suspectedAiRate > 0.4) {
    recommendations.push(
      "High AI-suspicion rate — strengthen PME expression constraints and dialect naturalness.",
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
    version: PAS_VERSION,
    computed_at: new Date().toISOString(),
    recommendations,
  };
}

/** Protocol-ready blank form for IRB / study packs. */
export function emptyPsychiatristForm(
  partial: Pick<PsychiatristRatingForm, "rater_id" | "rater_role" | "case_id">,
): PsychiatristRatingForm {
  return {
    ...partial,
    blinded: true,
    arm_unknown_to_rater: true,
    ratings: {
      clinical_realism: 3,
      diagnostic_authenticity: 3,
      emotional_authenticity: 3,
      consistency: 3,
      natural_conversation: 3,
      therapeutic_alliance: 3,
      interview_difficulty: 3,
      overall_realism: 3,
    },
    suspected_ai: null,
    rated_at: new Date().toISOString(),
  };
}
