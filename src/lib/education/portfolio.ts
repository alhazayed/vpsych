/**
 * Portfolio Engine — permanent trainee portfolio assembled from ACE state.
 * Observational only. Never writes patient clinical stores.
 */

import { evaluateCertifications } from "@/lib/ace/certifications";
import type { LearnerProfile } from "@/lib/ace/types";
import type { TherapyModality } from "@/lib/case-engine/types";
import { evaluateCertificationMilestone } from "@/lib/education/certification";
import { scoreEducationCompetencies } from "@/lib/education/competency-framework";
import { expertLevelFromAce } from "@/lib/education/difficulty";
import type {
  EducationCompetencyDomainId,
  TraineePortfolio,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

export function buildTraineePortfolio(input: {
  profile: LearnerProfile;
  diagnosesPracticed?: string[];
  therapyModalities?: TherapyModality[];
  recommendations?: string[];
}): TraineePortfolio {
  const scores = scoreEducationCompetencies(input.profile.competencies);
  const milestone = evaluateCertificationMilestone(input.profile);
  const badges = evaluateCertifications(input.profile);
  const weaknesses = scores
    .filter((s) => s.score < input.profile.min_competency_threshold)
    .sort((a, b) => a.score - b.score)
    .map((s) => s.id);

  const achievements = [
    ...badges
      .filter((b) => b.status === "certified" || b.status === "eligible")
      .map((b) => `${b.title} (${b.status})`),
    milestone.milestone !== "beginner"
      ? `Milestone: ${milestone.milestone.replace(/_/g, " ")}`
      : "",
  ].filter(Boolean);

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    learner_id: input.profile.id,
    user_id: input.profile.user_id,
    profession: input.profile.profession,
    training_level: input.profile.training_level,
    expert_level: expertLevelFromAce(
      input.profile.training_level,
      input.profile.profession,
    ),
    milestone: milestone.milestone,
    cases_completed: input.profile.completed_case_count,
    diagnoses_practiced: input.diagnosesPracticed ?? [],
    therapy_modalities: input.therapyModalities ?? [],
    competencies: scores,
    achievements,
    weaknesses: weaknesses as EducationCompetencyDomainId[],
    learning_recommendations:
      input.recommendations ??
      weaknesses.slice(0, 5).map((w) => `Practice ${String(w).replace(/_/g, " ")}`),
    session_count: input.profile.completed_case_count,
    certifications: badges.map((b) => ({
      badge_slug: b.badge_slug,
      title: b.title,
      status: b.status,
    })),
    updated_at: new Date().toISOString(),
  };
}
