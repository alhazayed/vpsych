import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { DISORDER_IDS } from "@/lib/case-engine/catalog";
import { BUILTIN_TEMPLATES } from "@/lib/scenario-templates/catalog";
import { generateFromTemplate } from "@/lib/scenario-templates/generate";
import { validateTemplate } from "@/lib/scenario-templates/validation";

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

describe("Clinical Scenario Template Engine", () => {
  it("validates seeded templates", () => {
    for (const tpl of BUILTIN_TEMPLATES) {
      const result = validateTemplate(tpl);
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
  });

  it("rejects MDD × bipolar mania comorbidity on template generation", () => {
    const tpl = BUILTIN_TEMPLATES[0]!;
    const result = generateFromTemplate({
      template: tpl,
      persona: PERSONAS[0]!,
      avatarId: "avatar-maya",
      comorbiditySlugs: ["bipolar-mania"],
      seed: "reject-mania",
      autoComorbidity: false,
    });
    expect(result.ok).toBe(false);
  });

  it("generates 500 randomized standardized patients", () => {
    const rng = createRng("vpsych-template-engine-500");
    const assessmentIds = new Set<string>();
    let generated = 0;
    let attempts = 0;

    while (generated < 500 && attempts < 2000) {
      attempts += 1;
      const template =
        BUILTIN_TEMPLATES[Math.floor(rng() * BUILTIN_TEMPLATES.length)]!;
      const persona = PERSONAS[Math.floor(rng() * PERSONAS.length)]!;

      const result = generateFromTemplate({
        template,
        persona,
        avatarId: persona.avatar_id!,
        seed: `tpl-${generated}-${attempts}`,
        autoComorbidity: true,
      });

      if (!result.ok) continue;

      const { snapshot, template: meta } = result.patient;

      expect(snapshot.assessment_id).toMatch(/^VPSY-ASM-/);
      expect(assessmentIds.has(snapshot.assessment_id)).toBe(false);
      assessmentIds.add(snapshot.assessment_id);

      // CPTSD is ICD-11-only (no DSM-5 code); other templates require DSM-5.
      if (snapshot.primary_diagnosis.slug === "complex-ptsd") {
        expect(snapshot.primary_diagnosis.dsm5_code).toBeNull();
        expect(snapshot.primary_diagnosis.icd11_code).toBe("6B41");
      } else {
        expect(snapshot.primary_diagnosis.dsm5_code).toBeTruthy();
        expect(snapshot.primary_diagnosis.icd11_code).toBeTruthy();
      }
      expect(snapshot.primary_diagnosis.slug).toBe(
        template.primary_diagnosis_slug,
      );
      expect(snapshot.locale).toBe(template.language);
      expect(snapshot.difficulty).toBe(template.difficulty);
      expect(snapshot.therapy_modality).toBe(template.therapy_modality);
      expect(snapshot.memory_scope).toBe("case_instance");
      expect(meta.slug).toBe(template.slug);
      expect(meta.grading_rubric.pass_threshold).toBeGreaterThan(0);
      expect(snapshot.rubric?.length).toBeGreaterThan(0);

      // Culture / language never rewrite ICD-11; DSM-5 may be null only for CPTSD
      if (snapshot.primary_diagnosis.slug !== "complex-ptsd") {
        expect(Boolean(snapshot.primary_diagnosis.dsm5_code)).toBe(true);
      }
      expect(Boolean(snapshot.primary_diagnosis.icd11_code)).toBe(true);

      // Excluded diagnoses never appear
      for (const excluded of template.excluded_diagnosis_slugs) {
        expect(
          snapshot.comorbidities.some((c) => c.slug === excluded),
        ).toBe(false);
        expect(snapshot.primary_diagnosis.slug).not.toBe(excluded);
      }

      // Clinical consistency: severity present, symptoms non-empty for packages
      expect(snapshot.clinical_core.symptom_profile.length).toBeGreaterThan(0);
      expect(snapshot.randomized_context.recent_stressor).toBeTruthy();

      generated += 1;
    }

    expect(generated).toBe(500);
    expect(assessmentIds.size).toBe(500);
  });

  it("keeps memory isolation across template generations", () => {
    const a = generateFromTemplate({
      template: BUILTIN_TEMPLATES[0]!,
      persona: PERSONAS[0]!,
      avatarId: "a",
      seed: "iso-a",
      autoComorbidity: false,
    });
    const b = generateFromTemplate({
      template: BUILTIN_TEMPLATES[2]!,
      persona: PERSONAS[0]!,
      avatarId: "a",
      seed: "iso-b",
      autoComorbidity: false,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.patient.snapshot.assessment_id).not.toBe(
      b.patient.snapshot.assessment_id,
    );
    expect(a.patient.snapshot.primary_diagnosis.slug).toBe(
      "mdd-recurrent-moderate",
    );
    expect(b.patient.snapshot.primary_diagnosis.slug).toBe("ptsd");
  });
});
