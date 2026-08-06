import { describe, expect, it } from "vitest";
import { findPresetBySlug } from "@/lib/instructor-presets/catalog";
import { generateFromPreset } from "@/lib/instructor-presets/engine";
import type { PersonaRow } from "@/lib/case-engine/types";

const W3_PRESET_SLUGS = [
  "foundation-interview-medstudent-en",
  "mi-counselor-en",
  "cbt-psychologist-en",
  "cbt-skills-gp-en",
  "complex-formulation-consultant-en",
] as const;

const testPersona: PersonaRow = {
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

describe("W3 educational presets — builtin catalog", () => {
  it.each(W3_PRESET_SLUGS)("findPresetBySlug resolves %s", (slug) => {
    const preset = findPresetBySlug(slug);
    expect(preset).toBeTruthy();
    expect(preset!.slug).toBe(slug);
    expect(preset!.enabled).toBe(true);
  });

  it("GP preset forbids alcohol-use-disorder comorbidity", () => {
    const gp = findPresetBySlug("cbt-skills-gp-en")!;
    const forbidden = gp.clinical_constraints.filter(
      (c) => c.constraint_type === "forbidden_comorbidity",
    );
    expect(
      forbidden.some((c) => c.value === "alcohol-use-disorder"),
    ).toBe(true);
  });

  it("generateFromPreset succeeds for GP preset", () => {
    const preset = findPresetBySlug("cbt-skills-gp-en")!;
    const result = generateFromPreset({
      preset,
      persona: testPersona,
      avatarId: "a1",
      seed: "w3-gp-preset",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assessment.snapshot.instructor_preset?.slug).toBe(
        "cbt-skills-gp-en",
      );
    }
  });

  it("generateFromPreset succeeds for psychologist and counselor presets", () => {
    for (const slug of ["cbt-psychologist-en", "mi-counselor-en"] as const) {
      const preset = findPresetBySlug(slug)!;
      const result = generateFromPreset({
        preset,
        persona: testPersona,
        avatarId: "a1",
        seed: `w3-${slug}`,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.assessment.snapshot.instructor_preset?.slug).toBe(slug);
      }
    }
  });

  it("GP generation never selects alcohol-use-disorder as comorbidity", () => {
    const preset = findPresetBySlug("cbt-skills-gp-en")!;
    for (let i = 0; i < 8; i++) {
      const result = generateFromPreset({
        preset,
        persona: testPersona,
        avatarId: "a1",
        seed: `w3-gp-comorbid-${i}`,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const comorbidSlugs =
          result.assessment.snapshot.comorbidities?.map((c) => c.slug) ?? [];
        expect(comorbidSlugs).not.toContain("alcohol-use-disorder");
      }
    }
  });
});
