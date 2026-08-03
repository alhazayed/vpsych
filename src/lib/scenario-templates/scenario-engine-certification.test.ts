import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateFromTemplate } from "@/lib/scenario-templates/generate";
import { findTemplateBySlug } from "@/lib/scenario-templates/catalog";
import type { PersonaRow } from "@/lib/case-engine/types";

const root = join(process.cwd(), "src");

const persona: PersonaRow = {
  id: "00000000-0000-4000-8000-000000000010",
  avatar_id: "00000000-0000-4000-8000-000000000011",
  slug: "cert-persona",
  display_name: "Cert Persona",
  identity: { age: 30, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: null,
  is_active: true,
};

describe("Scenario Engine certification guards", () => {
  it("loads excluded diagnoses from template_diagnoses on the session persist path", () => {
    const persist = readFileSync(
      join(root, "lib/case-engine/persist.ts"),
      "utf8",
    );
    expect(persist).toMatch(/from\("template_diagnoses"\)/);
    expect(persist).toMatch(/role === "excluded"/);
    expect(persist).not.toMatch(
      /excluded_diagnosis_slugs:\s*\[\s*\],/,
    );
  });

  it("copies template child rows when cloning in admin API", () => {
    const route = readFileSync(
      join(root, "app/api/admin/templates/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/template_objectives/);
    expect(route).toMatch(/template_competencies/);
    expect(route).toMatch(/template_diagnoses/);
    expect(route).toMatch(/template_comorbidities/);
    expect(route).toMatch(/srcObjectives\.map/);
  });

  it("rejects excluded bipolar comorbidity on MDD template generation", () => {
    const tpl = findTemplateBySlug("adult-mdd-initial-en");
    expect(tpl).toBeTruthy();
    const result = generateFromTemplate({
      template: tpl!,
      persona,
      avatarId: persona.avatar_id!,
      comorbiditySlugs: ["bipolar-mania"],
      seed: "scenario-cert-exclusion",
      autoComorbidity: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) =>
            i.code.includes("exclud") ||
            i.message.toLowerCase().includes("exclud") ||
            i.message.toLowerCase().includes("bipolar") ||
            i.code.includes("comorbid"),
        ),
      ).toBe(true);
    }
  });
});
