import { describe, expect, it } from "vitest";
import {
  BUILTIN_DISORDERS,
  DISORDER_IDS,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { validateCaseGeneration } from "@/lib/case-engine/validation";
import { validateTemplate } from "@/lib/scenario-templates/validation";
import { findTemplateBySlug } from "@/lib/scenario-templates/catalog";
import type { PersonaRow } from "@/lib/case-engine/types";

const persona: PersonaRow = {
  id: "00000000-0000-4000-8000-000000000020",
  avatar_id: "00000000-0000-4000-8000-000000000021",
  slug: "dsm-icd-cert",
  display_name: "DSM/ICD Cert",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: null,
  is_active: true,
};

describe("DSM-5 / ICD-11 certification guards", () => {
  it("packages all 17 DISORDER_IDS in the offline catalog", () => {
    const ids = new Set<string>(Object.values(DISORDER_IDS));
    expect(ids.size).toBe(17);
    expect(BUILTIN_DISORDERS.length).toBe(17);
    for (const d of BUILTIN_DISORDERS) {
      expect(ids.has(d.id)).toBe(true);
      expect(d.icd11_code).toBeTruthy();
    }
  });

  it("locks Critical ICD-11 alignments for BPD, bipolar, PDD, and CPTSD", () => {
    const bySlug = Object.fromEntries(
      getBuiltinCatalog().disorders.map((d) => [d.slug, d]),
    );
    expect(bySlug.bpd?.icd11_code).toBe("6D10.1/6D11.5");
    expect(bySlug["bipolar-mania"]?.icd11_code).toBe("6A60.2");
    expect(bySlug.pdd?.icd11_code).toBe("6A72");
    expect(bySlug["complex-ptsd"]?.dsm5_code).toBeNull();
    expect(bySlug["complex-ptsd"]?.icd10_code).toBeNull();
    expect(bySlug["complex-ptsd"]?.icd11_code).toBe("6B41");
    expect(bySlug["complex-ptsd"]?.package?.dsm5_optional).toBe(true);
  });

  it("allows ICD-11-only Complex PTSD through case validation", () => {
    const catalog = getBuiltinCatalog();
    const cptsd = catalog.disorders.find((d) => d.slug === "complex-ptsd");
    expect(cptsd).toBeTruthy();
    const result = validateCaseGeneration(
      {
        persona,
        avatarId: persona.avatar_id!,
        primaryDisorder: cptsd!,
        comorbidities: [],
        difficulty: "intermediate",
        therapyModality: "supportive",
        locale: "en-US",
      },
      catalog,
    );
    expect(result.ok).toBe(true);
  });

  it("maps MDD and GAD teaching codes used by production personas", () => {
    const bySlug = Object.fromEntries(
      getBuiltinCatalog().disorders.map((d) => [d.slug, d]),
    );
    expect(bySlug["mdd-recurrent-moderate"]).toMatchObject({
      dsm5_code: "296.32",
      icd10_code: "F33.1",
      icd11_code: "6A71.1",
    });
    expect(bySlug["gad-with-panic"]).toMatchObject({
      dsm5_code: "300.02",
      icd10_code: "F41.1",
      icd11_code: "6B00",
    });
  });

  it("keeps enabled builtin scenario templates valid after coding fixes", () => {
    for (const slug of [
      "adult-mdd-initial-en",
      "adult-gad-osce-ar",
      "ptsd-risk-assessment-en",
    ]) {
      const tpl = findTemplateBySlug(slug);
      expect(tpl, slug).toBeTruthy();
      const result = validateTemplate(tpl!);
      expect(result.ok, `${slug}: ${JSON.stringify(result)}`).toBe(true);
    }
  });
});
