import { describe, expect, it } from "vitest";
import {
  applySessionPerformance,
  buildAnalytics,
  inferDiagnosisCorrectness,
  mapRubricToCompetencies,
} from "@/lib/ace/analytics";
import { createLearnerProfile, ingestSessionAssessment } from "@/lib/ace/engine";
import {
  buildCohortAnalytics,
  classifyRiskLearner,
  cohortToCsv,
  cohortToExcelCsv,
  cohortToPdf,
  cohortToResearchDataset,
  meanMerge,
  trendSlope,
  type LearnerRow,
} from "@/lib/learning-analytics";

describe("Learning Analytics Certification", () => {
  it("meanMerge uses true arithmetic mean (not pairwise drift)", () => {
    expect(meanMerge([100, 0, 100])).toBe(67);
    expect(meanMerge([])).toBe(0);
  });

  it("mapRubricToCompetencies averages multi-hit rubric mappings", () => {
    const scores = mapRubricToCompetencies(
      [
        { id: "assessment", label: "A", score: 5, max: 5, weight: 25, feedback: "" },
        { id: "assessment", label: "A2", score: 0, max: 5, weight: 25, feedback: "" },
      ],
      50,
    );
    // assessment maps to several comps; diagnostic_interview always present
    expect(scores.diagnostic_interview).toBeDefined();
  });

  it("does not fabricate diagnosis correctness from overall score alone", () => {
    expect(inferDiagnosisCorrectness(undefined, 90)).toBeUndefined();
    expect(inferDiagnosisCorrectness("", 20)).toBeUndefined();
    expect(
      inferDiagnosisCorrectness("Learner arrived at the correct diagnosis.", 40),
    ).toBe(true);
    expect(
      inferDiagnosisCorrectness("Incorrect diagnosis of bipolar disorder.", 80),
    ).toBe(false);
  });

  it("confidence and strengths ignore unassessed baseline rows", () => {
    let profile = createLearnerProfile({ user_id: "u-la-1", id: "l-la-1" });
    // Only one assessed competency
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === "suicide_assessment"
          ? { ...c, score: 90, samples: 3, trend: 5 }
          : c,
      ),
      confidence_score: 50,
    };
    const next = applySessionPerformance(profile, {
      overallScore: 88,
      competencyScores: { suicide_assessment: 92 },
    });
    const assessed = next.competencies.filter((c) => c.samples > 0);
    expect(assessed.every((c) => c.competency_id === "suicide_assessment" || c.samples > 0)).toBe(
      true,
    );
    // Confidence should track assessed (~90), not diluted by dozens of 70/0 baselines
    expect(next.confidence_score).toBeGreaterThan(70);

    const analytics = buildAnalytics(next, [70, 80, 88]);
    expect(analytics.strengths).toContain("suicide_assessment");
    expect(analytics.learning_curve).toHaveLength(3);
    // Unassessed comps at 70 must not appear as strengths
    const unassessedStrength = analytics.strengths.find((id) => {
      const row = next.competencies.find((c) => c.competency_id === id);
      return row && row.samples === 0;
    });
    expect(unassessedStrength).toBeUndefined();
  });

  it("persists assessment history and completed diagnoses without overall fabrication", () => {
    const profile = createLearnerProfile({ user_id: "u-la-2", id: "l-la-2" });
    const result = ingestSessionAssessment(profile, {
      overall: 72,
      items: [
        { id: "safety", label: "S", score: 4, max: 5, weight: 20, feedback: "" },
        { id: "assessment", label: "A", score: 3, max: 5, weight: 25, feedback: "" },
        { id: "alliance", label: "Al", score: 4, max: 5, weight: 25, feedback: "" },
        { id: "interventions", label: "I", score: 3, max: 5, weight: 20, feedback: "" },
        { id: "structure", label: "St", score: 3, max: 5, weight: 10, feedback: "" },
      ],
      diagnosisSlug: "mdd-recurrent-moderate",
      // omit correctDiagnosis — unknown
    });
    expect(result.profile.metadata?.history_overall).toEqual([72]);
    expect(result.analytics.completed_diagnoses).toEqual([]);
    expect(result.analytics.missed_diagnoses).toEqual([]);
    expect(
      (result.profile.metadata?.last_session_competency_ids as string[])?.length,
    ).toBeGreaterThan(0);
  });

  it("classifies risk learners and builds cohort benchmarks", () => {
    const rows: LearnerRow[] = [
      {
        id: "a",
        user_id: "ua",
        profession: "psychiatry_resident",
        training_level: "residency",
        institution: "Hospital A",
        completed_case_count: 6,
        confidence_score: 35,
        learning_velocity: -0.4,
        certification_status: "not_started",
        competencies: [
          { competency_id: "suicide_assessment", score: 40, samples: 3 },
          { competency_id: "risk_assessment", score: 42, samples: 3 },
          { competency_id: "dsm5_reasoning", score: 38, samples: 2 },
        ],
        metadata: { history_overall: [70, 60, 50, 45] },
        instructor_id: "inst-1",
      },
      {
        id: "b",
        user_id: "ub",
        profession: "nurse",
        training_level: "nursing",
        institution: "Hospital B",
        completed_case_count: 4,
        confidence_score: 82,
        learning_velocity: 0.5,
        certification_status: "in_progress",
        competencies: [
          { competency_id: "suicide_assessment", score: 85, samples: 4 },
          { competency_id: "risk_assessment", score: 80, samples: 3 },
          { competency_id: "dsm5_reasoning", score: 78, samples: 3 },
          { competency_id: "diagnostic_interview", score: 88, samples: 5 },
          { competency_id: "differential_diagnosis", score: 75, samples: 3 },
        ],
        metadata: { history_overall: [60, 70, 78, 85] },
        instructor_id: "inst-1",
      },
    ];

    const risk = classifyRiskLearner(rows[0]!);
    expect(risk).not.toBeNull();
    expect(risk!.risk_score).toBeGreaterThanOrEqual(30);

    const cohort = buildCohortAnalytics(rows);
    expect(cohort.learner_count).toBe(2);
    expect(cohort.institutions.length).toBe(2);
    expect(cohort.instructors[0]?.instructor_id).toBe("inst-1");
    expect(cohort.risk_learners.length).toBeGreaterThanOrEqual(1);
    expect(cohort.mastery_ready_count).toBeGreaterThanOrEqual(1);
    expect(cohort.longitudinal[0]?.trend_slope).toBe(trendSlope([70, 60, 50, 45]));

    const csv = cohortToCsv(cohort);
    expect(csv).toContain("summary,learner_count,2");
    expect(cohortToExcelCsv(cohort).charCodeAt(0)).toBe(0xfeff);

    const research = cohortToResearchDataset(cohort);
    expect(research.schema_version).toBe("vpsych-learning-analytics-1.0");
    expect(
      (research.cohort.risk_learners[0] as { user_id?: string }).user_id,
    ).toBeUndefined();

    const pdf = cohortToPdf(cohort);
    expect(pdf[0]).toBe(0x25); // %
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toContain("%PDF");
  });
});
