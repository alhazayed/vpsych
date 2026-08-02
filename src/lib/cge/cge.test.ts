import { describe, expect, it } from "vitest";
import {
  analyzeRootCause,
  createEmptyLearnerStates,
  findCycle,
  generateLearningPathFromGraph,
  getBuiltinGraph,
  simulateGraphLearners,
  topologicalOrder,
  updateCompetencyScore,
  validatePrerequisites,
  verifyCgeSuccessCriteria,
  calculateMastery,
  isMastered,
} from "@/lib/cge";

describe("Competency Graph Engine", () => {
  it("is a valid DAG", () => {
    const g = getBuiltinGraph();
    expect(findCycle(g)).toBeNull();
    expect(validatePrerequisites(g)).toEqual([]);
    const order = topologicalOrder(g);
    expect(order.length).toBe(g.nodes.filter((n) => n.enabled).length);
  });

  it("meets success criteria (root cause + remediation + mastery gates)", () => {
    const errors = verifyCgeSuccessCriteria();
    expect(errors, errors.join("; ")).toEqual([]);
  });

  it("identifies MSE as root cause of treatment planning failure", () => {
    let states = createEmptyLearnerStates();
    states = updateCompetencyScore(states, "mental_status_examination", 40);
    states = updateCompetencyScore(states, "dsm5_reasoning", 55);
    states = updateCompetencyScore(states, "differential_diagnosis", 52);
    states = updateCompetencyScore(states, "risk_assessment", 60);
    states = updateCompetencyScore(states, "treatment_planning", 45);

    const rca = analyzeRootCause("treatment_planning", states);
    expect(rca.root_cause).toBe("mental_status_examination");
    expect(rca.observed_failure).toBe("treatment_planning");
    expect(rca.chain[0]).toBe("treatment_planning");

    const plan = generateLearningPathFromGraph(
      "learner-1",
      states,
      "treatment_planning",
    );
    expect(plan.root_cause_id).toBe("mental_status_examination");
    expect(plan.pathway[0]?.competency_id).toBe("mental_status_examination");
  });

  it("never awards competent mastery after a single assessment", () => {
    const stage = calculateMastery({
      competency_id: "suicide_assessment",
      score: 98,
      samples: 1,
      stage: "not_attempted",
      confidence: 50,
    });
    expect(isMastered(stage)).toBe(false);
  });

  it("simulates 20,000 virtual learners on the competency graph", () => {
    const result = simulateGraphLearners(20_000, 5);
    expect(result.learners).toBe(20_000);
    expect(result.failures, result.failures.join("; ")).toEqual([]);
    expect(result.noCycles).toBe(true);
    expect(result.noInvalidPrerequisites).toBe(true);
    expect(result.rootCauseOk).toBe(true);
    expect(result.remediationOk).toBe(true);
    expect(result.masteryProgressionOk).toBe(true);
    expect(result.aceIntegrationOk).toBe(true);
  }, 180_000);
});
