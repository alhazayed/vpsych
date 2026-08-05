/**
 * Clinical Fidelity Index (CFI) v1.0 — unit & integration suite.
 */
import { describe, expect, it } from "vitest";
import { BUILTIN_DISORDERS, DISORDER_IDS } from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import {
  assertWeightMatrixValid,
  buildCfiDashboard,
  CFI_VERSION,
  CFI_WEIGHT_MATRIX,
  computeClinicalFidelityIndex,
  cfiInputFromSnapshot,
  detectImpossibleTimeline,
  type CfiDimensionId,
} from "@/lib/cfi";

const persona: PersonaRow = {
  id: "p-cfi",
  avatar_id: "a-cfi",
  slug: "maya-chen",
  display_name: "Maya",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

describe("CFI weight matrix", () => {
  it("sums to 1.0 with unique dimension ids", () => {
    expect(() => assertWeightMatrixValid()).not.toThrow();
    const sum = CFI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(CFI_WEIGHT_MATRIX).toHaveLength(20);
    expect(CFI_VERSION).toBe("1.0.0");
  });

  it("covers all required clinical dimensions", () => {
    const ids = new Set(CFI_WEIGHT_MATRIX.map((e) => e.id));
    const required: CfiDimensionId[] = [
      "dsm5_diagnostic_accuracy",
      "icd11_consistency",
      "symptom_fidelity",
      "severity_fidelity",
      "timeline_consistency",
      "comorbidity_consistency",
      "differential_consistency",
      "mse_realism",
      "medication_history",
      "risk_assessment",
      "protective_factors",
      "speech_realism",
      "behavior_realism",
      "emotional_realism",
      "cultural_realism",
      "language_realism",
      "voice_realism",
      "memory_consistency",
      "disclosure_consistency",
      "prompt_consistency",
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });
});

describe("detectImpossibleTimeline", () => {
  it("flags PDD measured in weeks", () => {
    expect(detectImpossibleTimeline("pdd", "2 weeks")).toBe(true);
  });

  it("flags delirium measured in months", () => {
    expect(detectImpossibleTimeline("delirium", "3 months")).toBe(true);
  });

  it("flags bipolar mania lasting years without days", () => {
    expect(detectImpossibleTimeline("bipolar-mania", "2 years")).toBe(true);
  });

  it("accepts plausible MDD onset", () => {
    expect(detectImpossibleTimeline("mdd", "6 weeks")).toBe(false);
  });
});

describe("computeClinicalFidelityIndex", () => {
  it("returns overall 0–100 with CI, evidence, and reasoning", () => {
    const disorder = BUILTIN_DISORDERS.find(
      (d) => d.slug === "mdd-recurrent-moderate",
    )!;
    expect(disorder).toBeTruthy();
    const gen = generateCaseInstance({
      persona,
      avatarId: "a-cfi",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "cfi-mdd-1",
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const cfi = computeClinicalFidelityIndex(
      cfiInputFromSnapshot(gen.snapshot, disorder),
    );
    expect(cfi.overall).toBeGreaterThanOrEqual(0);
    expect(cfi.overall).toBeLessThanOrEqual(100);
    expect(cfi.subscores).toHaveLength(20);
    expect(cfi.confidence_interval.level).toBe(0.95);
    expect(cfi.confidence_interval.lower).toBeLessThanOrEqual(cfi.overall);
    expect(cfi.confidence_interval.upper).toBeGreaterThanOrEqual(cfi.overall);
    expect(cfi.clinical_reasoning.length).toBeGreaterThan(20);
    expect(cfi.versions.cfi_version).toBe(CFI_VERSION);
    expect(cfi.evidence.disorder_slug).toBe("mdd-recurrent-moderate");
    expect(cfi.weight_matrix_version).toBe(CFI_VERSION);

    const weightedSum = cfi.subscores.reduce(
      (a, s) => a + s.score * s.weight,
      0,
    );
    expect(Math.abs(weightedSum - cfi.overall)).toBeLessThan(1.5);
  });

  it("embeds clinical_fidelity on generated CaseInstances", () => {
    const disorder = BUILTIN_DISORDERS[0]!;
    const gen = generateCaseInstance({
      persona,
      avatarId: "a-cfi",
      primaryDisorder: disorder,
      difficulty: "beginner",
      therapyModality: "cbt",
      locale: "ar-JO",
      seed: "cfi-embed-1",
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(gen.snapshot.clinical_fidelity).toBeTruthy();
    expect(
      typeof (gen.snapshot.clinical_fidelity as { overall?: number }).overall,
    ).toBe("number");
    expect(gen.snapshot.clinical_teaching?.insight_expectation).toBeTruthy();
  });

  it("penalizes missing DSM-5 when not optional", () => {
    const cfi = computeClinicalFidelityIndex({
      disorder_slug: "mdd-recurrent-moderate",
      dsm5_code: null,
      icd11_code: "6A70.3",
      symptom_count: 3,
      symptom_domains: ["mood"],
      risk: {},
      differentials_count: 2,
      rule_outs_count: 1,
      teaching_points_count: 2,
      disclosure_rules_count: 2,
      comorbidities: [],
      locale: "en-US",
      memory_scope: "case_instance",
    });
    const dsm = cfi.subscores.find((s) => s.id === "dsm5_diagnostic_accuracy")!;
    expect(dsm.score).toBeLessThan(40);
    expect(cfi.recommendations.length).toBeGreaterThan(0);
  });
});

describe("buildCfiDashboard", () => {
  it("aggregates trend, disorder, and language comparisons", () => {
    const records = BUILTIN_DISORDERS.slice(0, 3).flatMap((disorder, i) => {
      const locales = ["en-US", "ar-JO"] as const;
      return locales.map((locale) => {
        const gen = generateCaseInstance({
          persona: {
            ...persona,
            identity: {
              age: Math.min(
                disorder.max_age ?? 40,
                Math.max(disorder.min_age ?? 18, 28),
              ),
              gender: (disorder.allowed_genders[0] as "female") || "female",
            },
          },
          avatarId: "a-cfi",
          primaryDisorder: disorder,
          difficulty: "intermediate",
          therapyModality: "cbt",
          locale,
          seed: `cfi-dash-${disorder.slug}-${locale}-${i}`,
        });
        if (!gen.ok) {
          throw new Error(gen.issues.map((i) => i.message).join("; "));
        }
        const cfi = computeClinicalFidelityIndex(
          cfiInputFromSnapshot(gen.snapshot, disorder),
        );
        return {
          overall: cfi.overall,
          disorder_slug: disorder.slug,
          locale,
          computed_at: gen.snapshot.generated_at,
          cfi,
        };
      });
    });

    const dash = buildCfiDashboard(records);
    expect(dash.n).toBe(records.length);
    expect(dash.overall_mean).not.toBeNull();
    expect(dash.by_disorder.length).toBeGreaterThanOrEqual(3);
    expect(dash.by_language.map((r) => r.key).sort()).toEqual(["ar", "en"]);
    expect(dash.trend.length).toBeGreaterThanOrEqual(1);
    expect(dash.cfi_version).toBe(CFI_VERSION);
  });
});
