/**
 * Production-compatible Wave 2 remediation scenario probes (local engine).
 * Covers W2-H1–H4 across EN/AR and difficulty levels without hitting live prod.
 */
import { describe, expect, it } from "vitest";
import {
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import {
  validateCaseGeneration,
  validateDsmIcd,
} from "@/lib/case-engine/validation";
import type { CaseGenerationRequest, CaseDifficulty } from "@/lib/case-engine/types";
import type { PersonaRow } from "@/lib/case-engine/types";
import { TARGET_LEARNERS } from "@/lib/instructor-presets/types";
import { validateInstructorPreset } from "@/lib/instructor-presets/validation";
import type { InstructorPreset } from "@/lib/instructor-presets/types";
import { stripPersonaCurrentStateBlock } from "@/lib/avatars/resolve";
import maya from "../../../personas/maya-chen.case.json";

const DIFFICULTIES: CaseDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];
const LOCALES = ["en-US", "ar-JO"] as const;

const mayaPersona: PersonaRow = {
  id: "p-maya",
  avatar_id: "a-maya",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: null,
  is_active: true,
};

describe("W2 remediation production-compatible probes", () => {
  it("W2-H1: Complex PTSD instantiates on all locales/difficulties (ICD-11-only)", () => {
    const catalog = getBuiltinCatalog();
    const cptsd = findDisorderBySlug("complex-ptsd", catalog)!;
    const ptsd = findDisorderBySlug("ptsd", catalog)!;

    expect(cptsd.dsm5_code).toBeNull();
    expect(cptsd.icd11_code).toBe("6B41");
    expect(validateDsmIcd(cptsd)).toEqual([]);
    expect(ptsd.dsm5_code).toBe("309.81");
    expect(validateDsmIcd(ptsd)).toEqual([]);

    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        const req: CaseGenerationRequest = {
          persona: mayaPersona,
          avatarId: "a-maya",
          primaryDisorder: cptsd,
          comorbidities: [],
          difficulty,
          therapyModality: "supportive",
          locale,
          seed: `cptsd-${locale}-${difficulty}`,
        };
        expect(validateCaseGeneration(req, catalog).ok).toBe(true);
        const g = generateCaseInstance(req);
        expect(g.ok).toBe(true);
        if (!g.ok) continue;
        expect(g.snapshot.primary_diagnosis.icd11_code).toBe("6B41");
        expect(g.snapshot.primary_diagnosis.dsm5_code).toBeNull();
        expect(g.snapshot.clinical_core.disorder).toMatch(/Complex PTSD/i);
      }
    }
  });

  it("W2-H2: consultant_psychiatrist preset validates with competencies", () => {
    expect(TARGET_LEARNERS).toContain("consultant_psychiatrist");
    const preset: InstructorPreset = {
      id: "p-c",
      slug: "complex-formulation-consultant-en",
      name: "Complex Formulation — Consultant Psychiatrist",
      specialty: "general_adult_psychiatry",
      target_learner: "consultant_psychiatrist",
      learning_level: "fellowship",
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
      preferred_template_slugs: [],
      clinical_constraints: [],
      required_competencies: [
        {
          competency_id: "formulation",
          label: "Formulation",
          required: true,
          weight: 1,
          max_score: 5,
        },
      ],
      optional_competencies: [],
      grading: {
        pass_threshold: 70,
        outstanding_threshold: 90,
        critical_mistakes: [],
        automatic_deductions: {},
        dimensions: ["alliance", "formulation"],
        report_sections: ["narrative", "scores"],
      },
      enabled: true,
      version: 1,
    };
    expect(validateInstructorPreset(preset).filter((i) => i.severity === "error")).toEqual(
      [],
    );
    expect(preset.required_competencies).toHaveLength(1);
    expect(preset.voice_enabled).toBe(true);
    expect(preset.assessment_enabled).toBe(true);
  });

  it("W2-H3: mania packages + Maya current-state strip (EN/AR)", () => {
    const catalog = getBuiltinCatalog();
    const mania = findDisorderBySlug("bipolar-mania", catalog)!;
    const ids = (mania.package.symptom_profile ?? []).map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "elevated_mood",
        "decreased_sleep_need",
        "pressured_speech",
        "flight_of_ideas",
        "grandiosity",
        "impulsivity",
      ]),
    );

    const en = (maya as { personalities: Record<string, { persona_prompt: string }> })
      .personalities["en-US"].persona_prompt;
    const ar = (maya as { personalities: Record<string, { persona_prompt: string }> })
      .personalities["ar-JO"].persona_prompt;
    expect(en).toContain("HOW YOU ARE RIGHT NOW");
    expect(stripPersonaCurrentStateBlock(en)).not.toContain("HOW YOU ARE RIGHT NOW");
    expect(stripPersonaCurrentStateBlock(en)).not.toContain("have not painted since April");
    expect(ar).toContain("كيف حالك هلأ");
    expect(stripPersonaCurrentStateBlock(ar)).not.toContain("كيف حالك هلأ");

    for (const locale of LOCALES) {
      const g = generateCaseInstance({
        persona: mayaPersona,
        avatarId: "a-maya",
        primaryDisorder: mania,
        comorbidities: [],
        difficulty: "intermediate",
        therapyModality: "supportive",
        locale,
        seed: `mania-${locale}`,
      });
      expect(g.ok).toBe(true);
      if (!g.ok) continue;
      const blob = g.snapshot.clinical_core.symptom_profile
        .map((s) => s.description)
        .join(" ")
        .toLowerCase();
      expect(blob).toMatch(/sleep|wired|elevated|irritable|pressured/);
      expect(blob).toMatch(/decreased need|few hours|not tired|energized/);
      expect(g.snapshot.severity).toBeTruthy();
    }
  });

  it("W2-H4: schizophrenia packages emphasize psychosis (EN/AR)", () => {
    const catalog = getBuiltinCatalog();
    const sz = findDisorderBySlug("schizophrenia", catalog)!;
    const ids = (sz.package.symptom_profile ?? []).map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "delusions",
        "hallucinations",
        "disorganization",
        "negative_symptoms",
        "functional_decline",
      ]),
    );

    for (const locale of LOCALES) {
      const g = generateCaseInstance({
        persona: mayaPersona,
        avatarId: "a-maya",
        primaryDisorder: sz,
        comorbidities: [],
        difficulty: "advanced",
        therapyModality: "supportive",
        locale,
        seed: `sz-${locale}`,
      });
      expect(g.ok).toBe(true);
      if (!g.ok) continue;
      const presenting = g.snapshot.clinical_core.symptom_profile.filter(
        (s) => s.salience === "presenting",
      );
      expect(presenting.length).toBeGreaterThan(0);
      const blob = g.snapshot.clinical_core.symptom_profile
        .map((s) => `${s.id} ${s.description}`)
        .join(" ")
        .toLowerCase();
      expect(blob).toMatch(/delusion|hallucin|voices|disorganiz|watched|belief/);
      expect(presenting.some((s) => s.domain === "psychotic" || /delusion|disorganiz/.test(s.id))).toBe(
        true,
      );
    }
  });
});
