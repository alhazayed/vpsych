import { describe, expect, it } from "vitest";
import {
  createLearnerProfile,
  generateAdaptiveCase,
  ingestSessionAssessment,
  simulateVirtualLearners,
  verifySuccessCriteria,
  scoreOf,
} from "@/lib/ace";

describe("Adaptive Curriculum Engine", () => {
  it("meets success criteria for remediation patterns", () => {
    const errors = verifySuccessCriteria();
    expect(errors, errors.join("; ")).toEqual([]);
  });

  it("raises suicide competency when safety performance improves", () => {
    let profile = createLearnerProfile({
      id: "t1",
      user_id: "u1",
    });
    profile = {
      ...profile,
      competencies: profile.competencies.map((c) =>
        c.competency_id === "suicide_assessment"
          ? { ...c, score: 40, samples: 1 }
          : c,
      ),
    };

    for (let i = 0; i < 5; i++) {
      const suicideScore = scoreOf(profile.competencies, "suicide_assessment");
      const next = generateAdaptiveCase(profile, {
        seed: `t1-${i}`,
        stepIndex: i,
      });
      if (suicideScore < 70) {
        expect(next.focusCompetencies).toContain("suicide_assessment");
      }
      const result = ingestSessionAssessment(profile, {
        overall: 60 + i * 7,
        items: [
          {
            id: "safety",
            label: "Safety",
            score: 2 + Math.min(3, i),
            max: 5,
            weight: 20,
            feedback: "",
          },
          {
            id: "assessment",
            label: "Assessment",
            score: 3,
            max: 5,
            weight: 25,
            feedback: "",
          },
          {
            id: "alliance",
            label: "Alliance",
            score: 4,
            max: 5,
            weight: 25,
            feedback: "",
          },
          {
            id: "interventions",
            label: "Interventions",
            score: 3,
            max: 5,
            weight: 20,
            feedback: "",
          },
          {
            id: "structure",
            label: "Structure",
            score: 3,
            max: 5,
            weight: 10,
            feedback: "",
          },
        ],
        diagnosisSlug: next.disorderSlug,
        correctDiagnosis: true,
      });
      profile = result.profile;
      expect(result.coach.supervisor_feedback.length).toBeGreaterThan(20);
      expect(result.nextCase.fingerprint).toBeTruthy();
    }

    expect(scoreOf(profile.competencies, "suicide_assessment")).toBeGreaterThan(
      40,
    );
  });

  it("simulates 10,000 virtual learners with adaptive invariants", () => {
    const result = simulateVirtualLearners(10_000, 6);
    expect(result.learners).toBe(10_000);
    expect(result.sessions).toBe(60_000);
    expect(result.failures, result.failures.join("; ")).toEqual([]);
    expect(result.noImpossibleDiagnoses).toBe(true);
    expect(result.noInfiniteLoops).toBe(true);
    expect(result.remediationOk).toBe(true);
    expect(result.graduationOk).toBe(true);
    expect(result.competencyTrackingOk).toBe(true);
    expect(result.progressionOk).toBe(true);
    expect(result.noRepetitiveCases).toBe(true);
  }, 120_000);
});
