import type { AssessmentType } from "@/lib/scenario-templates/types";
import type {
  InstructorPreset,
  LearningObjectiveKey,
  TargetLearner,
} from "./types";
import { LEARNING_OBJECTIVES, PRESET_TIME_LIMITS, TARGET_LEARNERS } from "./types";

export type PresetValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

const VALID_ASSESSMENT: AssessmentType[] = [
  "initial_assessment",
  "follow_up",
  "risk_assessment",
  "medication_review",
  "cbt_session",
  "dbt_session",
  "psychodynamic_session",
  "crisis_intervention",
  "family_session",
  "termination_session",
  "osce_examination",
];

export function validateInstructorPreset(
  preset: InstructorPreset,
): PresetValidationIssue[] {
  const issues: PresetValidationIssue[] = [];

  if (!preset.name?.trim()) {
    issues.push({
      code: "name_required",
      message: "Preset name is required",
      severity: "error",
    });
  }
  if (!preset.slug?.trim()) {
    issues.push({
      code: "slug_required",
      message: "Preset slug is required",
      severity: "error",
    });
  }
  if (!preset.primary_objective) {
    issues.push({
      code: "primary_objective_required",
      message: "Primary learning objective is required",
      severity: "error",
    });
  } else if (!LEARNING_OBJECTIVES.includes(preset.primary_objective)) {
    issues.push({
      code: "unknown_objective",
      message: `Unknown primary objective: ${preset.primary_objective}`,
      severity: "error",
    });
  }

  for (const o of preset.secondary_objectives ?? []) {
    if (!LEARNING_OBJECTIVES.includes(o as LearningObjectiveKey)) {
      issues.push({
        code: "unknown_secondary_objective",
        message: `Unknown secondary objective: ${o}`,
        severity: "error",
      });
    }
  }

  if (!TARGET_LEARNERS.includes(preset.target_learner as TargetLearner)) {
    issues.push({
      code: "unknown_learner",
      message: `Unknown target learner: ${preset.target_learner}`,
      severity: "error",
    });
  }

  if (!VALID_ASSESSMENT.includes(preset.assessment_type)) {
    issues.push({
      code: "unknown_assessment_type",
      message: `Unknown assessment type: ${preset.assessment_type}`,
      severity: "error",
    });
  }

  if (
    !(PRESET_TIME_LIMITS as readonly number[]).includes(
      preset.time_limit_minutes,
    )
  ) {
    issues.push({
      code: "invalid_time_limit",
      message: `Time limit must be one of ${PRESET_TIME_LIMITS.join(", ")}`,
      severity: "error",
    });
  }

  if (preset.assessment_type === "osce_examination" && preset.allow_hints) {
    issues.push({
      code: "osce_hints",
      message: "OSCE mode should not allow hints",
      severity: "warning",
    });
  }

  if (
    (preset.grading_mode === "exam" || preset.grading_mode === "osce") &&
    preset.feedback_mode === "realtime_coaching"
  ) {
    issues.push({
      code: "exam_coaching",
      message: "Exam/OSCE grading should not use realtime coaching",
      severity: "warning",
    });
  }

  if (
    preset.language.startsWith("ar") &&
    preset.culture &&
    !/arab|levant|jordan|gulf/i.test(preset.culture)
  ) {
    issues.push({
      code: "language_culture",
      message: "Arabic language typically pairs with Levantine/Arab culture",
      severity: "warning",
    });
  }

  return issues;
}

export function assertPresetValid(preset: InstructorPreset): void {
  const errors = validateInstructorPreset(preset).filter(
    (i) => i.severity === "error",
  );
  if (errors.length) {
    throw new Error(
      `Invalid instructor preset: ${errors.map((e) => e.message).join("; ")}`,
    );
  }
}
