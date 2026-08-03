/**
 * Competency Graph Engine — orchestration.
 */

import {
  assertAcyclic,
  getBuiltinGraph,
  topologicalOrder,
  validatePrerequisites,
} from "./graph";
import {
  calculateMastery,
  propagatePerformance,
  recalculateAllMasteryStages,
} from "./mastery";
import { blockedCompetencies, runRootCauseAnalysis } from "./rca";
import {
  generateRemediationPlan,
  recommendNextFromPlan,
} from "./remediation";
import { applyCompetencyDecay } from "./decay";
import {
  generateSupervisorGraphReport,
  summarizeLearnerGraph,
} from "./supervisor";
import type {
  CompetencyGraph,
  GraphCompetencyId,
  LearnerGraph,
  LearnerNodeState,
  MasteryStage,
  RemediationPlan,
  RootCauseResult,
  SupervisorGraphReport,
} from "./types";

export function createEmptyLearnerStates(
  graph: CompetencyGraph = getBuiltinGraph(),
): LearnerNodeState[] {
  return graph.nodes.map((n) => ({
    competency_id: n.id,
    score: 70,
    samples: 0,
    stage: "not_attempted" as MasteryStage,
    confidence: 50,
    last_practiced_at: null,
    locked: false,
    instructor_approved: false,
    trend: 0,
  }));
}

export function getCompetencyGraph(): CompetencyGraph {
  const g = getBuiltinGraph();
  assertAcyclic(g);
  return g;
}

export function getLearnerGraph(
  learnerId: string,
  states: LearnerNodeState[],
  graph: CompetencyGraph = getBuiltinGraph(),
): LearnerGraph {
  const { states: decayed, atRisk } = applyCompetencyDecay(states);
  const withStages = recalculateAllMasteryStages(decayed, graph);
  const summary = summarizeLearnerGraph(withStages, graph);
  return {
    learner_id: learnerId,
    graph_version: graph.version,
    nodes: withStages,
    blocked: blockedCompetencies(withStages, graph),
    mastered: summary.mastered,
    developing: summary.developing,
    at_risk_of_decay: atRisk,
  };
}

export function updateCompetencyScore(
  states: LearnerNodeState[],
  competencyId: GraphCompetencyId,
  score: number,
  graph: CompetencyGraph = getBuiltinGraph(),
): LearnerNodeState[] {
  return propagatePerformance(graph, states, competencyId, score);
}

export function generateLearningPathFromGraph(
  learnerId: string,
  states: LearnerNodeState[],
  focus?: GraphCompetencyId,
): RemediationPlan {
  const assessed = states.filter((s) => s.samples > 0);
  const weakest =
    focus ??
    [...assessed].sort((a, b) => a.score - b.score)[0]?.competency_id ??
    "diagnostic_interview";
  return generateRemediationPlan(learnerId, weakest, states);
}

export function recommendNextCases(
  learnerId: string,
  states: LearnerNodeState[],
  observedFailure?: GraphCompetencyId,
): ReturnType<typeof recommendNextFromPlan> {
  const plan = generateLearningPathFromGraph(
    learnerId,
    states,
    observedFailure,
  );
  return recommendNextFromPlan(plan);
}

export function analyzeRootCause(
  observedFailure: GraphCompetencyId,
  states: LearnerNodeState[],
): RootCauseResult {
  return runRootCauseAnalysis(observedFailure, states);
}

export function buildSupervisorReport(
  learnerId: string,
  states: LearnerNodeState[],
  observedFailure?: string,
): SupervisorGraphReport {
  return generateSupervisorGraphReport(learnerId, states, observedFailure);
}

/** Map flat ACE competency scores into graph learner states. */
export function statesFromAceCompetencies(
  competencies: Array<{
    competency_id: string;
    score: number;
    samples: number;
    trend?: number;
    last_assessed_at?: string | null;
    locked?: boolean;
    instructor_approved?: boolean;
    confidence?: number;
    mastery_stage?: string | null;
  }>,
  graph: CompetencyGraph = getBuiltinGraph(),
): LearnerNodeState[] {
  const byId = new Map(competencies.map((c) => [c.competency_id, c]));
  const base = createEmptyLearnerStates(graph);
  const mapped = base.map((s) => {
    const src = byId.get(s.competency_id);
    if (!src) return s;
    return {
      ...s,
      score: src.score,
      samples: src.samples,
      trend: src.trend ?? 0,
      last_practiced_at: src.last_assessed_at ?? null,
      confidence:
        typeof src.confidence === "number"
          ? src.confidence
          : Math.round(src.score * 0.7 + 15),
      locked: Boolean(src.locked),
      instructor_approved: Boolean(src.instructor_approved),
    };
  });
  return recalculateAllMasteryStages(mapped, graph);
}

export {
  getBuiltinGraph,
  topologicalOrder,
  validatePrerequisites,
  assertAcyclic,
  runRootCauseAnalysis,
  generateRemediationPlan,
  calculateMastery,
  recalculateAllMasteryStages,
  applyCompetencyDecay,
  blockedCompetencies,
};
