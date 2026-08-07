/**
 * Certification milestones — explainable, never inflate.
 * Builds on ACE evaluateCertifications without replacing badges.
 */

import { evaluateCertifications } from "@/lib/ace/certifications";
import type { LearnerProfile } from "@/lib/ace/types";
import {
  scoreEducationCompetencies,
  weightedEducationOverall,
} from "@/lib/education/competency-framework";
import { expertLevelFromAce } from "@/lib/education/difficulty";
import type {
  CertificationMilestone,
  EducationCompetencyScore,
} from "@/lib/education/types";

export type MilestoneEvaluation = {
  milestone: CertificationMilestone;
  overall: number;
  cases: number;
  mastered_domains: number;
  ace_certified_badges: number;
  rationale: string[];
};

function countMastered(scores: EducationCompetencyScore[]): number {
  return scores.filter((s) => s.score >= 80 && s.samples >= 3).length;
}

/**
 * Deterministic milestone from cases + domain mastery + ACE badges.
 * Thresholds are conservative — never inflate.
 */
export function evaluateCertificationMilestone(
  profile: LearnerProfile,
): MilestoneEvaluation {
  const scores = scoreEducationCompetencies(profile.competencies);
  const overall = weightedEducationOverall(scores);
  const cases = profile.completed_case_count;
  const mastered = countMastered(scores);
  const badges = evaluateCertifications(profile).filter(
    (b) => b.status === "certified",
  ).length;
  const rationale: string[] = [];

  let milestone: CertificationMilestone = "beginner";

  if (cases >= 2 && overall >= 45) {
    milestone = "intermediate";
    rationale.push("≥2 cases and education overall ≥45");
  }
  if (cases >= 8 && overall >= 60 && mastered >= 3) {
    milestone = "advanced";
    rationale.push("≥8 cases, overall ≥60, ≥3 mastered domains");
  }
  if (cases >= 15 && overall >= 70 && mastered >= 6 && badges >= 1) {
    milestone = "resident_ready";
    rationale.push("≥15 cases, overall ≥70, ≥6 mastered, ≥1 ACE badge");
  }
  if (cases >= 30 && overall >= 78 && mastered >= 10 && badges >= 2) {
    milestone = "board_ready";
    rationale.push("≥30 cases, overall ≥78, ≥10 mastered, ≥2 ACE badges");
  }
  if (cases >= 50 && overall >= 85 && mastered >= 14 && badges >= 3) {
    milestone = "consultant_level";
    rationale.push("≥50 cases, overall ≥85, ≥14 mastered, ≥3 ACE badges");
  }

  if (!rationale.length) {
    rationale.push("Below intermediate thresholds — continue structured practice");
  }

  // Cap by expert level expectation (students cannot jump to consultant on thin samples)
  const level = expertLevelFromAce(profile.training_level, profile.profession);
  if (level === "medical_student" && milestone === "consultant_level") {
    milestone = "advanced";
    rationale.push("Capped at advanced for medical_student track");
  }

  return {
    milestone,
    overall,
    cases,
    mastered_domains: mastered,
    ace_certified_badges: badges,
    rationale,
  };
}
