import { describe, expect, it, beforeEach } from "vitest";
import {
  assessBetaReadiness,
  buildValidationDashboard,
  clearValidationRatings,
  computeLearnerAuthenticityScore,
  computePatientAuthenticityBenchmark,
  computePsychiatristAuthenticityScore,
  emptyLearnerForm,
  emptyPsychiatristForm,
  appendPsychiatristRating,
  reviewConversationQuality,
  runAllTherapyStyleValidations,
  scorePsychiatristForm,
} from "@/lib/validation";

describe("PAS / LAS", () => {
  beforeEach(() => clearValidationRatings());

  it("scores psychiatrist forms to 0–100 with weights", () => {
    const form = emptyPsychiatristForm({
      rater_id: "c1",
      rater_role: "consultant_psychiatrist",
      case_id: "case-1",
    });
    form.ratings = {
      clinical_realism: 5,
      diagnostic_authenticity: 4,
      emotional_authenticity: 4,
      consistency: 5,
      natural_conversation: 4,
      therapeutic_alliance: 4,
      interview_difficulty: 3,
      overall_realism: 4,
    };
    const s = scorePsychiatristForm(form);
    expect(s).toBeGreaterThan(70);
    expect(s).toBeLessThanOrEqual(100);

    appendPsychiatristRating(form);
    const pas = computePsychiatristAuthenticityScore([form]);
    expect(pas.n_ratings).toBe(1);
    expect(pas.version).toBe("1.0.0");
    expect(pas.recommendations.some((r) => /n < 8/i.test(r))).toBe(true);
  });

  it("aggregates learner authenticity", () => {
    const forms = Array.from({ length: 3 }, (_, i) => {
      const f = emptyLearnerForm({
        rater_id: `l${i}`,
        rater_role: "medical_student",
        case_id: "c1",
      });
      f.ratings.learning_value = 4;
      f.ratings.immersion = 4;
      return f;
    });
    const las = computeLearnerAuthenticityScore(forms);
    expect(las.n_ratings).toBe(3);
    expect(las.overall).toBeGreaterThan(50);
  });
});

describe("PAB / therapy / conversation", () => {
  it("benchmarks PME above toxic legacy dialogue", () => {
    const pab = computePatientAuthenticityBenchmark([
      {
        arm: "pme_v1",
        hcfiInput: {
          disorder_slug: "mdd-recurrent-moderate",
          locale: "en-US",
          messages: [
            { role: "user", content: "How are you?" },
            { role: "assistant", content: "Um… tired. Heavy. Work's a lot." },
          ],
          has_speech_profile: true,
          has_alliance_reactivity: true,
          has_cultural_cues: true,
          has_voice_settings: true,
        },
      },
      {
        arm: "legacy_prompt",
        hcfiInput: {
          disorder_slug: "mdd-recurrent-moderate",
          locale: "en-US",
          messages: [
            { role: "user", content: "How are you?" },
            {
              role: "assistant",
              content: "As an AI, I understand you're asking. My diagnosis is MDD.",
            },
          ],
          has_speech_profile: false,
          has_alliance_reactivity: false,
          persona_fallback: true,
        },
      },
    ]);
    const pme = pab.arms.find((a) => a.arm === "pme_v1")!;
    const legacy = pab.arms.find((a) => a.arm === "legacy_prompt")!;
    expect(pme.overall).toBeGreaterThan(legacy.overall);
  });

  it("therapy styles pass gradualism on MDD", () => {
    const result = runAllTherapyStyleValidations("mdd-recurrent-moderate");
    expect(result.observations).toHaveLength(6);
    expect(result.pass_rate).toBeGreaterThanOrEqual(80);
  });

  it("flags AI wording in conversation QC", () => {
    const qc = reviewConversationQuality(
      [
        { role: "user", content: "Hi" },
        {
          role: "assistant",
          content: "As an AI, I understand you're asking about my feelings.",
        },
      ],
      "en",
    );
    expect(qc.findings.some((f) => f.category === "ai_wording")).toBe(true);
    expect(qc.score).toBeLessThan(80);
  });
});

describe("Beta readiness + dashboard", () => {
  beforeEach(() => clearValidationRatings());

  it("returns CONDITIONAL_GO when framework ready but human data absent", () => {
    const beta = assessBetaReadiness({
      vqi: 78,
      cfi: 82,
      hcfi: 76,
      pmfi: 74,
      therapy_response_pass_rate: 100,
      conversation_quality_en: 85,
      conversation_quality_ar: 82,
      regression_suite_green: true,
      migration_applied: true,
      pas_n: 0,
      las_n: 0,
    });
    expect(beta.verdict).toBe("CONDITIONAL_GO");
    expect(beta.success_criteria.length).toBeGreaterThan(3);
    expect(beta.risk_register.length).toBeGreaterThan(0);
  });

  it("builds integrated dashboard with all Mission 22 indices", () => {
    const dash = buildValidationDashboard();
    expect(dash.indices.PAS).toBeTruthy();
    expect(dash.indices.LAS).toBeTruthy();
    expect(dash.indices.PAB.arms.length).toBeGreaterThanOrEqual(2);
    expect(dash.beta.verdict).toMatch(/GO|NO_GO|CONDITIONAL/);
    expect(dash.metrics_registry.some((m) => m.id === "PMFI")).toBe(true);
    expect(dash.metrics_registry.some((m) => m.id === "PAS")).toBe(true);
  });
});
