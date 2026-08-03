/**
 * Educational Reliability Index (ERI) v1.0 — unit & integration suite.
 */
import { describe, expect, it } from "vitest";
import {
  assertWeightMatrixValid,
  buildEriDashboard,
  buildEriOfflineCorpus,
  computeEducationalReliabilityIndex,
  eriInputFromAssessment,
  ERI_VERSION,
  ERI_WEIGHT_MATRIX,
  simulateInterRaterAgreement,
  type EriDimensionId,
} from "@/lib/eri";
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

describe("ERI weight matrix", () => {
  it("sums to 1.0 with unique dimension ids", () => {
    expect(() => assertWeightMatrixValid()).not.toThrow();
    const sum = ERI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(ERI_WEIGHT_MATRIX).toHaveLength(15);
    expect(ERI_VERSION).toBe("1.0.0");
  });

  it("covers all required educational dimensions", () => {
    const ids = new Set(ERI_WEIGHT_MATRIX.map((e) => e.id));
    const required: EriDimensionId[] = [
      "competency_scoring_consistency",
      "feedback_usefulness",
      "feedback_specificity",
      "actionability",
      "supervisor_comments",
      "reflection_quality",
      "learning_objective_alignment",
      "clinical_reasoning_quality",
      "remediation_quality",
      "difficulty_calibration",
      "inter_session_consistency",
      "inter_rater_agreement",
      "longitudinal_stability",
      "assessment_fairness",
      "language_parity",
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });
});

describe("simulateInterRaterAgreement", () => {
  it("returns Pearson r and agreement percentage", () => {
    const result = simulateInterRaterAgreement([4, 3, 3, 2, 4], 0.3, 7);
    expect(result.pct_agree).toBeGreaterThanOrEqual(0);
    expect(result.pct_agree).toBeLessThanOrEqual(100);
    if (result.r != null) {
      expect(result.r).toBeGreaterThan(0.3);
    }
  });
});

describe("computeEducationalReliabilityIndex", () => {
  it("returns overall 0–100 with CI, evidence, and reasoning", () => {
    const eri = computeEducationalReliabilityIndex(
      eriInputFromAssessment({
        overall: 72,
        items: sampleItems,
        narrative:
          "Clinical reasoning: the learner elicited mood, sleep, and SI but missed a structured protective-factor inquiry. Formulation linked anhedonia to MDD criteria.",
        excerpts: [
          "Therapist: Have you had thoughts of ending your life?",
          "Patient: Sometimes, but I would not act on them.",
        ],
        locale: "en-US",
        difficulty: "intermediate",
        assessment_mode: "llm_examiner",
        coach: {
          supervisor_feedback:
            "Overall session score: 72/100. Strengths: alliance. Priority growth: risk assessment.",
          reflective_questions: [
            "What cue did you miss on protective factors?",
            "How would you structure the first 5 minutes differently?",
            "How did alliance affect disclosure?",
          ],
          missed_opportunities: ["Incomplete protective-factor inquiry"],
          suggested_reading: ["SAFE-T", "C-SSRS"],
          suggested_next_cases: ["mdd @ intermediate", "risk-focused OSCE"],
          learning_goals: ["Raise risk assessment to ≥ 70"],
          improvement_plan:
            "1. Complete 2 focused risk cases.\n2. Use a structured checklist.\n3. Review SAFE-T.",
        },
        learning_objectives_count: 3,
        difficulty_matches_learner: true,
        inter_session_r: 0.72,
        test_retest_r: 0.68,
        cronbach_alpha: 0.81,
        fairness_pass: true,
        language_parity_within_tolerance: true,
        language_parity_abs_diff: 2.1,
        session_id: "sess-eri-1",
        model_version: "test",
      }),
    );

    expect(eri.overall).toBeGreaterThanOrEqual(0);
    expect(eri.overall).toBeLessThanOrEqual(100);
    expect(eri.subscores).toHaveLength(15);
    expect(eri.confidence_interval.level).toBe(0.95);
    expect(eri.confidence_interval.lower).toBeLessThanOrEqual(eri.overall);
    expect(eri.confidence_interval.upper).toBeGreaterThanOrEqual(eri.overall);
    expect(eri.educational_reasoning.length).toBeGreaterThan(20);
    expect(eri.versions.eri_version).toBe(ERI_VERSION);
    expect(eri.versions.assessment_version).toBeTruthy();
    expect(eri.versions.rubric_version).toBeTruthy();
    expect(eri.versions.competency_graph_version).toBeTruthy();
    expect(eri.versions.adaptive_curriculum_version).toBeTruthy();
    expect(eri.weight_matrix_version).toBe(ERI_VERSION);

    const weightedSum = eri.subscores.reduce(
      (a, s) => a + s.score * s.weight,
      0,
    );
    expect(Math.abs(weightedSum - eri.overall)).toBeLessThan(1.5);
  });

  it("penalizes heuristic fallback on competency consistency", () => {
    const eri = computeEducationalReliabilityIndex(
      eriInputFromAssessment({
        overall: 60,
        items: sampleItems.map((i) => ({ ...i, feedback: "ok" })),
        narrative: "Short.",
        excerpts: [],
        locale: "en-US",
        assessment_mode: "heuristic_fallback",
      }),
    );
    const comp = eri.subscores.find(
      (s) => s.id === "competency_scoring_consistency",
    )!;
    expect(comp.score).toBeLessThanOrEqual(55);
  });
});

describe("buildEriOfflineCorpus + dashboard", () => {
  it("builds corpus and aggregates learner trend + instructor report", () => {
    const records = buildEriOfflineCorpus();
    expect(records.length).toBe(36);
    expect(records.every((r) => r.overall >= 0 && r.overall <= 100)).toBe(true);

    const dash = buildEriDashboard(records);
    expect(dash.n).toBe(36);
    expect(dash.overall_mean).not.toBeNull();
    expect(dash.learner_trend.length).toBeGreaterThanOrEqual(1);
    expect(dash.instructor_report.mean_eri).not.toBeNull();
    expect(dash.by_language.map((r) => r.key).sort()).toEqual(["ar", "en"]);
    expect(dash.by_difficulty.length).toBeGreaterThanOrEqual(2);
    expect(dash.eri_version).toBe(ERI_VERSION);
  });
});

describe("assessSession embeds ERI", () => {
  it("attaches educational_reliability on heuristic assessment", async () => {
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
    expect(result.scores.educational_reliability).toBeTruthy();
    expect(result.scores.educational_reliability!.overall).toBeGreaterThanOrEqual(
      0,
    );
    expect(result.scores.educational_reliability!.eri_version).toBe(ERI_VERSION);
  });
});
