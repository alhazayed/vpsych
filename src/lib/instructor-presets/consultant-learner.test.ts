import { describe, expect, it } from "vitest";
import { TARGET_LEARNERS } from "@/lib/instructor-presets/types";
import { validateInstructorPreset } from "@/lib/instructor-presets/validation";
import type { InstructorPreset } from "@/lib/instructor-presets/types";

describe("TARGET_LEARNERS — consultant psychiatrist (W2-H2)", () => {
  it("includes consultant_psychiatrist", () => {
    expect(TARGET_LEARNERS).toContain("consultant_psychiatrist");
  });

  it("accepts complex-formulation-consultant-en shaped preset", () => {
    const preset: InstructorPreset = {
      id: "p-consultant",
      slug: "complex-formulation-consultant-en",
      name: "Complex Formulation — Consultant Psychiatrist",
      description: "Expert formulation",
      specialty: "general_adult_psychiatry",
      target_learner: "consultant_psychiatrist",
      learning_level: "fellowship",
      clinical_rotation: null,
      assessment_type: "initial_assessment",
      primary_objective: "differential_diagnosis",
      secondary_objectives: ["diagnostic_interview", "risk_assessment"],
      difficulty: "expert",
      time_limit_minutes: 45,
      language: "en-US",
      culture: "general",
      therapy_modality: "psychodynamic",
      randomization_level: "moderate",
      grading_mode: "supervisor_review",
      feedback_mode: "end_of_session",
      voice_enabled: true,
      assessment_enabled: true,
      record_session: true,
      allow_hints: false,
      allow_pause: true,
      allow_restart: false,
      advanced_mode: true,
      scenario_template_id: null,
      clinical_constraints: [],
      required_competencies: [],
      optional_competencies: [],
      preferred_template_slugs: [],
      grading: {
        pass_threshold: 70,
        outstanding_threshold: 90,
        critical_mistakes: [],
        automatic_deductions: {},
        dimensions: ["alliance", "assessment", "formulation"],
        report_sections: ["narrative", "scores"],
      },
      enabled: true,
      version: 1,
    };
    const issues = validateInstructorPreset(preset);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});
