import { describe, expect, it } from "vitest";
import { findDisorderBySlug, getBuiltinCatalog } from "@/lib/case-engine/catalog";
import { validateDsmIcd, validateCaseGeneration } from "@/lib/case-engine/validation";
import type { CaseGenerationRequest } from "@/lib/case-engine/types";

describe("validateDsmIcd — ICD-11-only constructs (W2-H1)", () => {
  it("allows Complex PTSD with ICD-11 and null DSM-5", () => {
    const catalog = getBuiltinCatalog();
    const cptsd = findDisorderBySlug("complex-ptsd", catalog);
    expect(cptsd).toBeTruthy();
    expect(cptsd!.dsm5_code).toBeNull();
    expect(cptsd!.icd11_code).toBe("6B41");
    expect(validateDsmIcd(cptsd!)).toEqual([]);
  });

  it("still requires ICD-11", () => {
    const catalog = getBuiltinCatalog();
    const ptsd = findDisorderBySlug("ptsd", catalog)!;
    const broken = { ...ptsd, icd11_code: null };
    const issues = validateDsmIcd(broken);
    expect(issues.some((i) => i.code === "icd11_missing")).toBe(true);
  });

  it("PTSD with both codes remains valid (regression)", () => {
    const catalog = getBuiltinCatalog();
    const ptsd = findDisorderBySlug("ptsd", catalog)!;
    expect(ptsd.dsm5_code).toBe("309.81");
    expect(validateDsmIcd(ptsd)).toEqual([]);
  });
});

describe("mania / schizophrenia packages (W2-H3 / W2-H4)", () => {
  it("bipolar-mania package includes DSM-5 manic domains in patient language", () => {
    const mania = findDisorderBySlug("bipolar-mania", getBuiltinCatalog())!;
    const ids = (mania.package.symptom_profile ?? []).map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "elevated_mood",
        "increased_energy",
        "decreased_sleep_need",
        "pressured_speech",
        "flight_of_ideas",
        "grandiosity",
        "impulsivity",
      ]),
    );
    const sleep = mania.package.symptom_profile!.find(
      (s) => s.id === "decreased_sleep_need",
    )!;
    expect(sleep.description.toLowerCase()).toContain("not");
    expect(sleep.salience).toBe("presenting");
  });

  it("schizophrenia package emphasizes psychosis over depression", () => {
    const sz = findDisorderBySlug("schizophrenia", getBuiltinCatalog())!;
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
    const del = sz.package.symptom_profile!.find((s) => s.id === "delusions")!;
    expect(del.salience).toBe("presenting");
    expect(del.domain).toBe("psychotic");
    expect(del.description.toLowerCase()).toMatch(/belief|delusion|watched|messages/);
  });

  it("case request with complex-ptsd validates", () => {
    const catalog = getBuiltinCatalog();
    const cptsd = findDisorderBySlug("complex-ptsd", catalog)!;
    const req: CaseGenerationRequest = {
      persona: {
        id: "p1",
        avatar_id: null,
        slug: "test",
        display_name: "Test",
        identity: { age: 30, gender: "female" },
        traits: {},
        baseline_history: {},
        default_disorder_id: null,
        is_active: true,
      },
      avatarId: "a1",
      primaryDisorder: cptsd,
      comorbidities: [],
      difficulty: "intermediate",
      therapyModality: "supportive",
      locale: "en-US",
    };
    const result = validateCaseGeneration(req, catalog);
    expect(result.ok).toBe(true);
  });
});
