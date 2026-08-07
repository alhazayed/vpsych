/**
 * Difficulty Engine — maps expert learner levels onto CaseDifficulty + teaching biases.
 * Does NOT mutate patient mid-session. Recommendations only for next-case minting.
 */

import type { CaseDifficulty } from "@/lib/case-engine/types";
import type { AceTrainingLevel, LearnerProfile } from "@/lib/ace/types";
import type {
  DifficultyProfile,
  ExpertLearnerLevel,
} from "@/lib/education/types";

export function expertLevelFromAce(
  training: AceTrainingLevel,
  profession?: string | null,
): ExpertLearnerLevel {
  if (profession === "medical_student" || training === "undergraduate") {
    return "medical_student";
  }
  if (training === "postgraduate" || profession === "osce_candidate") {
    return "junior_resident";
  }
  if (training === "residency") return "senior_resident";
  if (training === "fellowship" || training === "certification_track") {
    return "board_candidate";
  }
  if (training === "continuing_education") return "consultant";
  return "senior_resident";
}

export function caseDifficultyForLevel(
  level: ExpertLearnerLevel,
  maxDifficulty?: CaseDifficulty,
): CaseDifficulty {
  const order: CaseDifficulty[] = [
    "beginner",
    "intermediate",
    "advanced",
    "expert",
  ];
  const map: Record<ExpertLearnerLevel, CaseDifficulty> = {
    medical_student: "beginner",
    junior_resident: "intermediate",
    senior_resident: "advanced",
    board_candidate: "advanced",
    consultant: "expert",
    expert_psychiatrist: "expert",
  };
  const target = map[level];
  if (!maxDifficulty) return target;
  return order.indexOf(target) <= order.indexOf(maxDifficulty)
    ? target
    : maxDifficulty;
}

export function buildDifficultyProfile(
  profile: LearnerProfile | null | undefined,
  overrides?: Partial<DifficultyProfile>,
): DifficultyProfile {
  const level =
    overrides?.learner_level ??
    expertLevelFromAce(
      profile?.training_level ?? "residency",
      profile?.profession,
    );
  const case_difficulty =
    overrides?.case_difficulty ??
    caseDifficultyForLevel(level, profile?.max_difficulty);

  const base: DifficultyProfile = {
    learner_level: level,
    case_difficulty,
    insight_bias:
      level === "medical_student"
        ? "high"
        : level === "junior_resident"
          ? "moderate"
          : level === "senior_resident"
            ? "partial"
            : level === "board_candidate"
              ? "low"
              : "very_low",
    comorbidity_weight:
      level === "medical_student"
        ? 0
        : level === "junior_resident"
          ? 0.25
          : level === "senior_resident"
            ? 0.5
            : 0.75,
    diagnostic_ambiguity:
      level === "medical_student"
        ? "low"
        : level === "junior_resident"
          ? "moderate"
          : level === "expert_psychiatrist"
            ? "expert"
            : "high",
    deception_bias:
      level === "medical_student" || level === "junior_resident"
        ? "none"
        : level === "senior_resident"
          ? "mild"
          : "moderate",
    memory_quality:
      level === "medical_student"
        ? "clear"
        : level === "consultant" || level === "expert_psychiatrist"
          ? "vague"
          : "mixed",
    emotion_regulation_challenge:
      level === "medical_student"
        ? "low"
        : level === "junior_resident"
          ? "moderate"
          : "high",
    therapy_response_complexity:
      level === "medical_student"
        ? "simple"
        : level === "junior_resident"
          ? "mixed"
          : "resistant",
    adaptations: [
      `learner_level=${level}`,
      `insight_bias=${level}`,
      `case_difficulty=${case_difficulty}`,
    ],
  };

  return { ...base, ...overrides, learner_level: level, case_difficulty };
}
