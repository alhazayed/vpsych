import {
  ancestors,
  getBuiltinGraph,
  prerequisiteChain,
  requiredPrerequisites,
} from "./graph";
import { isMastered, stageIndex } from "./mastery";
import type {
  CompetencyGraph,
  GraphCompetencyId,
  LearnerNodeState,
  RootCauseResult,
} from "./types";

function stateOf(
  states: LearnerNodeState[],
  id: GraphCompetencyId,
): LearnerNodeState | undefined {
  return states.find((s) => s.competency_id === id);
}

/**
 * Identify the earliest assessed weak prerequisite for an observed failure.
 * Unassessed nodes are only used when no assessed weakness exists on the chain.
 */
export function runRootCauseAnalysis(
  observedFailure: GraphCompetencyId,
  states: LearnerNodeState[],
  graph: CompetencyGraph = getBuiltinGraph(),
  threshold = 70,
): RootCauseResult {
  const chainForward = prerequisiteChain(graph, observedFailure);
  const anc = [
    ...new Set(
      ancestors(graph, observedFailure, ["required"]).concat(observedFailure),
    ),
  ];

  const weakAssessed = anc
    .map((id) => stateOf(states, id))
    .filter(
      (s): s is LearnerNodeState =>
        !!s && s.samples > 0 && (s.score < threshold || !isMastered(s.stage)),
    )
    .sort((a, b) => {
      const da = ancestors(graph, a.competency_id, ["required"]).length;
      const db = ancestors(graph, b.competency_id, ["required"]).length;
      if (da !== db) return da - db; // earlier in graph = fewer ancestors
      return a.score - b.score;
    });

  let root: GraphCompetencyId;
  if (weakAssessed.length) {
    root = weakAssessed[0]!.competency_id;
  } else {
    // No assessed weakness — pick first unmet required prereq (foundation gap)
    const unmet = requiredPrerequisites(graph, observedFailure).filter((p) => {
      const s = stateOf(states, p);
      return !s || s.samples === 0 || s.score < threshold;
    });
    root = unmet[0] ?? observedFailure;
  }

  const weakest = [...weakAssessed].sort((a, b) => a.score - b.score)[0];
  const weakest_prerequisite =
    weakest?.competency_id ?? root;

  // Build chain observed → … → root
  const idx = chainForward.indexOf(root);
  let rcaChain: string[];
  if (idx >= 0) {
    rcaChain = [...chainForward.slice(idx)].reverse();
  } else {
    rcaChain = [observedFailure, root];
  }
  if (rcaChain[0] !== observedFailure) {
    rcaChain = [
      observedFailure,
      ...rcaChain.filter((c) => c !== observedFailure),
    ];
  }

  return {
    observed_failure: observedFailure,
    root_cause: root,
    chain: rcaChain,
    weakest_prerequisite,
    explanation: `Failure in ${observedFailure.replace(/_/g, " ")} is driven by weak ${root.replace(/_/g, " ")} (earliest assessed unmet prerequisite in the competency graph).`,
  };
}

export function blockedCompetencies(
  states: LearnerNodeState[],
  graph: CompetencyGraph = getBuiltinGraph(),
  threshold = 70,
): GraphCompetencyId[] {
  const blocked: string[] = [];
  for (const node of graph.nodes) {
    if (!node.enabled) continue;
    const prereqs = requiredPrerequisites(graph, node.id);
    if (!prereqs.length) continue;
    const unsatisfied = prereqs.some((p) => {
      const s = stateOf(states, p);
      return (
        !s ||
        s.samples === 0 ||
        s.score < threshold ||
        stageIndex(s.stage) < stageIndex("developing")
      );
    });
    if (unsatisfied) blocked.push(node.id);
  }
  return blocked;
}
