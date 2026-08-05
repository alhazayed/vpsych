import { describe, expect, it } from "vitest";
import {
  findPresetBySlug,
  mapDbRowToPreset,
} from "@/lib/instructor-presets/catalog";
import { TARGET_LEARNERS } from "@/lib/instructor-presets/types";
import { validateInstructorPreset } from "@/lib/instructor-presets/validation";
import type { InstructorPreset } from "@/lib/instructor-presets/types";
import { generateFromPreset } from "@/lib/instructor-presets/engine";
import type { PersonaRow } from "@/lib/case-engine/types";

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

  it("builtin catalog includes consultant preset with competencies", () => {
    const preset = findPresetBySlug("complex-formulation-consultant-en");
    expect(preset).toBeTruthy();
    expect(preset!.target_learner).toBe("consultant_psychiatrist");
    expect(preset!.assessment_type).toBe("initial_assessment");
    expect(preset!.required_competencies.length).toBeGreaterThan(0);
    expect(
      validateInstructorPreset(preset!).filter((i) => i.severity === "error"),
    ).toEqual([]);
  });

  it("mapDbRowToPreset never leaves target_learner undefined", () => {
    const mapped = mapDbRowToPreset({
      id: "f1000000-0000-4000-8000-000000000007",
      slug: "complex-formulation-consultant-en",
      name: "Complex Formulation — Consultant Psychiatrist",
      specialty: "general_adult_psychiatry",
      target_learner: "consultant_psychiatrist",
      learning_level: "fellowship",
      assessment_type: "initial_assessment",
      primary_objective: "differential_diagnosis",
      difficulty: "expert",
      time_limit_minutes: 45,
      language: "en-US",
      therapy_modality: "psychodynamic",
      grading_mode: "supervisor_review",
      feedback_mode: "supervisor_only",
      enabled: true,
      version: 1,
    });
    expect(mapped.target_learner).toBe("consultant_psychiatrist");
    expect(mapped.assessment_type).toBe("initial_assessment");
    expect(
      validateInstructorPreset(mapped).filter((i) => i.severity === "error"),
    ).toEqual([]);
  });

  it("generateFromPreset loads consultant builtin", () => {
    const preset = findPresetBySlug("complex-formulation-consultant-en")!;
    const persona: PersonaRow = {
      id: "p1",
      avatar_id: "a1",
      slug: "maya-chen",
      display_name: "Maya",
      identity: { age: 28, gender: "female" },
      traits: {},
      baseline_history: {},
      default_disorder_id: null,
      is_active: true,
    };
    const result = generateFromPreset({
      preset,
      persona,
      avatarId: "a1",
      seed: "consultant-w2-h2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assessment.snapshot.instructor_preset?.slug).toBe(
        "complex-formulation-consultant-en",
      );
    }
  });
});
