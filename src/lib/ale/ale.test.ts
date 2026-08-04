/**
 * Adaptive Learning Effectiveness (ALE) v1.0 — unit & integration suite.
 */
import { describe, expect, it } from "vitest";
import {
  ALE_VERSION,
  ALE_WEIGHT_MATRIX,
  aleInputFromTrajectory,
  assertWeightMatrixValid,
  buildAleDashboard,
  buildAleOfflineCorpus,
  computeAdaptiveLearningEffectiveness,
  type AleDimensionId,
} from "@/lib/ale";

describe("ALE weight matrix", () => {
  it("sums to 1.0 with unique dimension ids", () => {
    expect(() => assertWeightMatrixValid()).not.toThrow();
    const sum = ALE_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(ALE_WEIGHT_MATRIX).toHaveLength(12);
    expect(ALE_VERSION).toBe("1.0.0");
  });

  it("covers all required adaptive dimensions", () => {
    const ids = new Set(ALE_WEIGHT_MATRIX.map((e) => e.id));
    const required: AleDimensionId[] = [
      "difficulty_progression",
      "case_sequencing",
      "competency_remediation",
      "learning_efficiency",
      "knowledge_retention",
      "reduction_of_repeated_mistakes",
      "improvement_speed",
      "case_diversity",
      "instructor_objective_alignment",
      "adaptive_accuracy",
      "competency_graph_utilization",
      "learning_pathway_quality",
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });
});

describe("computeAdaptiveLearningEffectiveness", () => {
  it("returns overall, CI, learning/difficulty curves, and quality report", () => {
    const ale = computeAdaptiveLearningEffectiveness(
      aleInputFromTrajectory({
        learner_archetype: "average",
        sessions: Array.from({ length: 8 }, (_, i) => ({
          overall: 50 + i * 3,
          difficulty:
            i < 3 ? "beginner" : i < 6 ? "intermediate" : "advanced",
          disorder_slug: i % 2 === 0 ? "mdd-recurrent-moderate" : "ptsd",
          fingerprint: `fp-${i}`,
          focus_competencies: ["diagnostic_interview"],
          weakest_competency: "diagnostic_interview",
          miss_flag_count: Math.max(0, 3 - Math.floor(i / 2)),
          objective_id: "diagnostic_interview",
          focus_matches_objective: true,
          used_graph: i % 2 === 0,
          remediation: true,
        })),
        pathway_steps: 4,
      }),
    );

    expect(ale.overall).toBeGreaterThanOrEqual(0);
    expect(ale.overall).toBeLessThanOrEqual(100);
    expect(ale.subscores).toHaveLength(12);
    expect(ale.confidence_interval.level).toBe(0.95);
    expect(ale.learning_curve).toHaveLength(8);
    expect(ale.difficulty_curve).toHaveLength(8);
    expect(ale.curriculum_quality_report.length).toBeGreaterThan(40);
    expect(ale.versions.ale_version).toBe(ALE_VERSION);
    expect(ale.versions.adaptive_version).toBeTruthy();
    expect(ale.versions.curriculum_version).toBeTruthy();
    expect(ale.versions.competency_graph_version).toBeTruthy();

    const weightedSum = ale.subscores.reduce(
      (a, s) => a + s.score * s.weight,
      0,
    );
    expect(Math.abs(weightedSum - ale.overall)).toBeLessThan(1.5);
  });

  it("penalizes trajectories that never remediates the weakest skill", () => {
    const ale = computeAdaptiveLearningEffectiveness(
      aleInputFromTrajectory({
        learner_archetype: "weak",
        sessions: Array.from({ length: 6 }, (_, i) => ({
          overall: 45 + i,
          difficulty: "advanced",
          disorder_slug: "mdd-recurrent-moderate",
          fingerprint: `same`,
          focus_competencies: ["empathy"],
          weakest_competency: "suicide_assessment",
          miss_flag_count: 2,
          objective_id: "suicide_assessment",
          focus_matches_objective: false,
          used_graph: false,
          remediation: false,
        })),
        pathway_steps: 0,
      }),
    );
    const rem = ale.subscores.find((s) => s.id === "competency_remediation")!;
    const acc = ale.subscores.find((s) => s.id === "adaptive_accuracy")!;
    expect(rem.score).toBeLessThan(50);
    expect(acc.score).toBeLessThan(50);
    expect(ale.recommendations.length).toBeGreaterThan(0);
  });
});

describe("buildAleOfflineCorpus + dashboard", () => {
  it("simulates weak/average/excellent learners with curves", () => {
    const records = buildAleOfflineCorpus();
    expect(records.length).toBe(3);
    expect(records.map((r) => r.learner_archetype).sort()).toEqual([
      "average",
      "excellent",
      "weak",
    ]);
    expect(records.every((r) => r.overall >= 0 && r.overall <= 100)).toBe(true);
    expect(
      records.every((r) => r.ale.learning_curve.length >= 8),
    ).toBe(true);
    expect(
      records.every((r) => r.ale.difficulty_curve.length >= 8),
    ).toBe(true);

    const dash = buildAleDashboard(records);
    expect(dash.n).toBe(3);
    expect(dash.overall_mean).not.toBeNull();
    expect(dash.learning_curves).toHaveLength(3);
    expect(dash.difficulty_curves).toHaveLength(3);
    expect(dash.by_archetype).toHaveLength(3);
    expect(dash.ale_version).toBe(ALE_VERSION);
    expect(dash.curriculum_quality.mean_ale).not.toBeNull();
  });
});
