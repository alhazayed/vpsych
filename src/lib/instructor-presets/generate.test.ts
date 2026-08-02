import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { DISORDER_IDS, findDisorderBySlug } from "@/lib/case-engine/catalog";
import {
  BUILTIN_PRESETS,
  generateFromPreset,
  generateInstructorReport,
  OBJECTIVE_DISORDER_CANDIDATES,
  timeLimitModifiers,
  validateInstructorPreset,
} from "@/lib/instructor-presets";

const PERSONAS: PersonaRow[] = [
  {
    id: "persona-maya",
    avatar_id: "avatar-maya",
    slug: "maya-chen",
    display_name: "Maya Chen",
    identity: { age: 28, gender: "female" },
    traits: {},
    baseline_history: {},
    default_disorder_id: DISORDER_IDS.mdd,
    is_active: true,
  },
  {
    id: "persona-jordan",
    avatar_id: "avatar-jordan",
    slug: "jordan-hale",
    display_name: "Jordan Hale",
    identity: { age: 34, gender: "male" },
    traits: {},
    baseline_history: {},
    default_disorder_id: DISORDER_IDS.gad,
    is_active: true,
  },
];

describe("Instructor Preset Engine", () => {
  it("validates seeded presets", () => {
    for (const preset of BUILTIN_PRESETS) {
      const issues = validateInstructorPreset(preset).filter(
        (i) => i.severity === "error",
      );
      expect(issues, JSON.stringify(issues)).toHaveLength(0);
    }
  });

  it("rejects diagnosis override without Advanced Mode", () => {
    const preset = BUILTIN_PRESETS[0]!;
    expect(preset.advanced_mode).toBe(false);
    const result = generateFromPreset({
      preset,
      persona: PERSONAS[0]!,
      avatarId: "avatar-maya",
      disorderSlugOverride: "gad-with-panic",
      seed: "adv-reject",
    });
    expect(result.ok).toBe(false);
  });

  it("maps objectives to known disorder candidates", () => {
    for (const [objective, candidates] of Object.entries(
      OBJECTIVE_DISORDER_CANDIDATES,
    )) {
      expect(candidates.length, objective).toBeGreaterThan(0);
      for (const slug of candidates) {
        expect(findDisorderBySlug(slug), `${objective}:${slug}`).toBeTruthy();
      }
    }
  });

  it("applies time-limit pacing modifiers", () => {
    expect(timeLimitModifiers(10).urgency).toBe("critical");
    expect(timeLimitModifiers(20).history_depth).toBe("brief");
    expect(timeLimitModifiers(45).conversation_pacing).toBe("steady");
    expect(timeLimitModifiers(90).disclosure_speed).toBe("slow");
  });

  it("generates instructor reports with required sections", () => {
    const preset = BUILTIN_PRESETS[0]!;
    const report = generateInstructorReport({
      preset,
      transcriptTurns: 16,
      coveredObjectives: [preset.primary_objective, "risk_assessment"],
      riskAddressed: true,
      empathyScore: 0.8,
      diagnosisMentioned: true,
      timeUsedMinutes: 28,
    });
    expect(report.percent).toBeGreaterThan(0);
    expect(report.dimensions.length).toBe(13);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(typeof report.pass).toBe("boolean");
  });

  it("generates 1000 randomized assessments from presets", () => {
    const rng = createRng("vpsych-instructor-preset-1000");
    const assessmentIds = new Set<string>();
    const fingerprints = new Set<string>();
    let generated = 0;
    let attempts = 0;

    while (generated < 1000 && attempts < 4000) {
      attempts += 1;
      const preset =
        BUILTIN_PRESETS[Math.floor(rng() * BUILTIN_PRESETS.length)]!;
      const persona = PERSONAS[Math.floor(rng() * PERSONAS.length)]!;

      const result = generateFromPreset({
        preset,
        persona,
        avatarId: persona.avatar_id!,
        seed: `preset-${generated}-${attempts}-${rng()}`,
      });

      if (!result.ok) continue;

      const { assessment } = result;
      const { snapshot, resolution } = assessment;

      expect(snapshot.assessment_id).toMatch(/^VPSY-ASM-/);
      expect(assessmentIds.has(snapshot.assessment_id)).toBe(false);
      assessmentIds.add(snapshot.assessment_id);

      // Diagnosis selected from objective candidates
      const candidates =
        OBJECTIVE_DISORDER_CANDIDATES[preset.primary_objective] ?? [];
      expect(candidates).toContain(resolution.selectedDisorderSlug);
      expect(snapshot.primary_diagnosis.slug).toBe(
        resolution.selectedDisorderSlug,
      );
      expect(snapshot.primary_diagnosis.dsm5_code).toBeTruthy();
      expect(snapshot.primary_diagnosis.icd11_code).toBeTruthy();

      // Objectives / difficulty / time / language / culture / voice flags
      expect(snapshot.instructor_preset?.primary_objective).toBe(
        preset.primary_objective,
      );
      expect(snapshot.instructor_preset?.secondary_objectives).toEqual(
        preset.secondary_objectives,
      );
      expect(snapshot.difficulty).toBe(preset.difficulty);
      expect(assessment.timeLimitMinutes).toBe(preset.time_limit_minutes);
      expect(assessment.maxDurationSec).toBe(preset.time_limit_minutes * 60);
      expect(snapshot.locale).toBe(preset.language);
      expect(snapshot.instructor_preset?.allow_hints).toBe(preset.allow_hints);
      expect(snapshot.instructor_preset?.grading_mode).toBe(preset.grading_mode);
      expect(snapshot.instructor_preset?.feedback_mode).toBe(
        preset.feedback_mode,
      );
      expect(snapshot.instructor_preset?.voice_enabled).toBe(
        preset.voice_enabled,
      );
      if (preset.culture) {
        expect(snapshot.instructor_preset?.culture).toBe(preset.culture);
      }

      // Template linkage
      expect(snapshot.template?.slug).toBe(resolution.selectedTemplateSlug);
      expect(snapshot.rubric?.length).toBeGreaterThan(0);

      // Safe randomization present without rewriting diagnosis codes
      expect(snapshot.randomized_context).toBeTruthy();
      const disorder = findDisorderBySlug(snapshot.primary_diagnosis.slug)!;
      expect(snapshot.primary_diagnosis.dsm5_code).toBe(disorder.dsm5_code);
      expect(snapshot.primary_diagnosis.icd11_code).toBe(disorder.icd11_code);

      // OSCE / exam invariants
      if (preset.assessment_type === "osce_examination") {
        expect(preset.allow_hints).toBe(false);
        expect(assessment.allowHints).toBe(false);
      }

      // Dedup fingerprint across life-context fields for uniqueness pressure
      const fp = [
        snapshot.assessment_id,
        snapshot.primary_diagnosis.slug,
        snapshot.randomized_context.occupation_variant ?? "",
        snapshot.randomized_context.recent_stressor,
        snapshot.randomized_context.minor_life_event,
        snapshot.locale,
        preset.slug,
      ].join("|");
      expect(fingerprints.has(fp)).toBe(false);
      fingerprints.add(fp);

      // Report shape
      const report = generateInstructorReport({
        preset,
        transcriptTurns: 10 + Math.floor(rng() * 10),
        coveredObjectives: [preset.primary_objective],
        riskAddressed: /risk|suicide|crisis|emergency/i.test(
          preset.primary_objective,
        ),
        timeUsedMinutes: Math.min(
          preset.time_limit_minutes,
          5 + Math.floor(rng() * 40),
        ),
      });
      expect(report.dimensions.length).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);

      generated += 1;
    }

    expect(generated).toBe(1000);
    expect(assessmentIds.size).toBe(1000);
  });
});
