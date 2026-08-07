/**
 * Progress Analytics — competency radar and learning metrics façade.
 */

import { buildAnalytics } from "@/lib/ace/analytics";
import type { LearnerProfile } from "@/lib/ace/types";
import {
  scoreEducationCompetencies,
  weightedEducationOverall,
} from "@/lib/education/competency-framework";
import type {
  EducationAnalyticsDashboard,
  SessionEvaluationReport,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

export function buildEducationAnalytics(input: {
  profile: LearnerProfile;
  evaluation?: SessionEvaluationReport | null;
  diagnosesCompleted?: string[];
  diagnosesMissed?: string[];
}): EducationAnalyticsDashboard {
  const scores = scoreEducationCompetencies(input.profile.competencies);
  const ace = buildAnalytics(
    input.profile,
    [],
    input.diagnosesCompleted ?? [],
    input.diagnosesMissed ?? [],
  );

  const risk = scores.find((s) => s.id === "risk_assessment")?.score ?? 50;
  const dsm = scores.find((s) => s.id === "dsm_reasoning")?.score ?? 50;
  const icd = scores.find((s) => s.id === "icd_reasoning")?.score ?? 50;
  const therapy =
    scores.find((s) => s.id === "psychotherapy_skills")?.score ?? 50;
  const alliance =
    ((scores.find((s) => s.id === "rapport")?.score ?? 50) +
      (scores.find((s) => s.id === "empathy")?.score ?? 50)) /
    2;

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    competency_radar: scores.map((s) => ({
      id: s.id,
      score: s.score,
      weight: s.weight,
    })),
    learning_velocity: input.profile.learning_velocity,
    risk_recognition_rate: input.evaluation?.coverage.risk ?? risk,
    diagnostic_accuracy_proxy: Math.round((dsm + icd) / 2),
    therapy_performance: therapy,
    alliance_quality: Math.round(
      input.evaluation?.coverage.alliance ?? alliance,
    ),
    interview_completeness: Math.round(
      input.evaluation?.coverage.information_gathering ??
        scores.find((s) => s.id === "diagnostic_interviewing")?.score ??
        50,
    ),
    mse_completeness: Math.round(
      input.evaluation?.coverage.mse ??
        scores.find((s) => s.id === "mental_state_examination")?.score ??
        50,
    ),
    progress_trend: Math.round(
      scores.reduce((a, s) => a + s.trend, 0) / Math.max(1, scores.length),
    ),
    ace_analytics: ace,
  };
}

export function educationOverallFromProfile(profile: LearnerProfile): number {
  return weightedEducationOverall(
    scoreEducationCompetencies(profile.competencies),
  );
}
