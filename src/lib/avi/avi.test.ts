/**
 * Assessment Validity Index (AVI) v1.0 — unit & integration suite.
 */
import { describe, expect, it } from "vitest";
import {
  assertWeightMatrixValid,
  AVI_VERSION,
  AVI_WEIGHT_MATRIX,
  aviInputFromAssessment,
  buildAviDashboard,
  buildAviOfflineCorpus,
  computeAssessmentValidityIndex,
  computeRepeatVariance,
  type AviDimensionId,
} from "@/lib/avi";
import type { ScoreEntry } from "@/lib/types";
import { assessSession } from "@/lib/ai/assessment";

const sampleItems: ScoreEntry[] = [
  {
    id: "alliance",
    label: "Alliance",
    score: 4,
    max: 5,
    weight: 25,
    feedback: "Warmth and collaboration were evident; deepen affect reflection.",
  },
  {
    id: "assessment",
    label: "Assessment",
    score: 3,
    max: 5,
    weight: 25,
    feedback: "Cover onset, course, and core criteria more systematically.",
  },
  {
    id: "interventions",
    label: "Interventions",
    score: 3,
    max: 5,
    weight: 20,
    feedback: "Link technique choice to formulation and session goals.",
  },
  {
    id: "safety",
    label: "Safety",
    score: 2,
    max: 5,
    weight: 20,
    feedback: "Complete structured risk inquiry including protective factors.",
  },
  {
    id: "structure",
    label: "Structure",
    score: 4,
    max: 5,
    weight: 10,
    feedback: "Agenda was clear; close with collaborative summary.",
  },
];

describe("AVI weight matrix", () => {
  it("sums to 1.0 with unique dimension ids", () => {
    expect(() => assertWeightMatrixValid()).not.toThrow();
    const sum = AVI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(AVI_WEIGHT_MATRIX).toHaveLength(14);
    expect(AVI_VERSION).toBe("1.0.0");
  });

  it("covers all required validity dimensions", () => {
    const ids = new Set(AVI_WEIGHT_MATRIX.map((e) => e.id));
    const required: AviDimensionId[] = [
      "content_validity",
      "construct_validity",
      "face_validity",
      "criterion_validity",
      "internal_consistency",
      "reliability",
      "competency_alignment",
      "clinical_relevance",
      "educational_relevance",
      "bias",
      "difficulty_discrimination",
      "competency_discrimination",
      "repeatability",
      "explainability",
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });
});

describe("computeRepeatVariance", () => {
  it("returns null for fewer than 2 scores", () => {
    expect(computeRepeatVariance([70])).toBeNull();
  });

  it("returns positive variance for dispersed repeats", () => {
    const v = computeRepeatVariance([70, 72, 68, 74, 66]);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(0);
  });
});

describe("computeAssessmentValidityIndex", () => {
  it("returns overall, variance, CI, and validity report", () => {
    const repeats = [70, 71, 69, 72, 70];
    const avi = computeAssessmentValidityIndex(
      aviInputFromAssessment({
        items: sampleItems,
        narrative:
          "Clinical reasoning: the learner elicited mood and SI but missed a structured protective-factor inquiry.",
        excerpts: [
          "Therapist: Have you had thoughts of ending your life?",
          "Patient: Sometimes, but I would not act.",
        ],
        locale: "en-US",
        assessment_mode: "llm_examiner",
        learning_objectives_count: 3,
        has_scientific_provenance: true,
        has_external_criterion: false,
        cronbach_alpha: 0.82,
        test_retest_r: 0.74,
        discrimination_index: 0.35,
        difficulty_separation: 8,
        fairness_pass: true,
        language_parity_within_tolerance: true,
        language_parity_abs_diff: 2,
        repeated_overalls: repeats,
        model_version: "test",
      }),
    );

    expect(avi.overall).toBeGreaterThanOrEqual(0);
    expect(avi.overall).toBeLessThanOrEqual(100);
    expect(avi.subscores).toHaveLength(14);
    expect(avi.variance).not.toBeNull();
    expect(avi.confidence_interval.level).toBe(0.95);
    expect(avi.validity_report.length).toBeGreaterThan(40);
    expect(avi.versions.avi_version).toBe(AVI_VERSION);
    expect(avi.versions.assessment_schema_version).toBeTruthy();
    expect(avi.versions.prompt_version).toBeTruthy();
    expect(avi.recommendations.length).toBeGreaterThan(0);

    const criterion = avi.subscores.find((s) => s.id === "criterion_validity")!;
    expect(criterion.score).toBeLessThan(60); // disclosed absence, not invented

    const weightedSum = avi.subscores.reduce(
      (a, s) => a + s.score * s.weight,
      0,
    );
    expect(Math.abs(weightedSum - avi.overall)).toBeLessThan(1.5);
  });

  it("penalizes heuristic mode on construct validity", () => {
    const avi = computeAssessmentValidityIndex(
      aviInputFromAssessment({
        items: sampleItems,
        narrative: "Short narrative.",
        excerpts: [],
        locale: "en-US",
        assessment_mode: "heuristic_fallback",
        has_scientific_provenance: true,
        repeated_overalls: [55, 60, 50, 58, 52],
      }),
    );
    const construct = avi.subscores.find((s) => s.id === "construct_validity")!;
    expect(construct.score).toBeLessThanOrEqual(50);
  });
});

describe("buildAviOfflineCorpus + dashboard", () => {
  it("runs repeated assessments and aggregates stability", () => {
    const records = buildAviOfflineCorpus();
    expect(records.length).toBe(8);
    expect(records.every((r) => r.overall >= 0 && r.overall <= 100)).toBe(true);
    expect(records.every((r) => r.variance != null)).toBe(true);
    expect(records.every((r) => (r.avi.evidence.repeat_n ?? 0) >= 5)).toBe(
      true,
    );

    const dash = buildAviDashboard(records);
    expect(dash.n).toBe(8);
    expect(dash.overall_mean).not.toBeNull();
    expect(dash.mean_variance).not.toBeNull();
    expect(dash.stability_trend.length).toBeGreaterThanOrEqual(1);
    expect(dash.validity_summary.external_criterion_disclosed).toBe(true);
    expect(dash.by_language.map((r) => r.key).sort()).toEqual(["ar", "en"]);
    expect(dash.by_mode.length).toBeGreaterThanOrEqual(2);
    expect(dash.avi_version).toBe(AVI_VERSION);
  });
});

describe("assessSession embeds AVI", () => {
  it("attaches assessment_validity on heuristic assessment", async () => {
    const result = await assessSession({
      avatar: {
        name: "Maya",
        disorder: "MDD",
        ideal_guidelines: {
          session_goals: ["Assess mood"],
          ideal_approach: "Collaborative CBT stance",
        },
        rubric: [],
      },
      messages: [
        { role: "user", content: "How have you been feeling?", created_at: "" },
        {
          role: "assistant",
          content: "Tired and sad most days.",
          created_at: "",
        },
        {
          role: "user",
          content: "Any thoughts of suicide or harm?",
          created_at: "",
        },
      ],
      durationSec: 600,
      language: "en",
    });
    expect(result.scores.assessment_validity).toBeTruthy();
    expect(result.scores.assessment_validity!.overall).toBeGreaterThanOrEqual(
      0,
    );
    expect(result.scores.assessment_validity!.avi_version).toBe(AVI_VERSION);
    expect(result.scores.assessment_validity!.validity_report.length).toBeGreaterThan(
      20,
    );
  });
});
