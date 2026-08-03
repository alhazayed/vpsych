import { descendants, getBuiltinGraph, nodeById, topologicalOrder } from "./graph";
import type {
  CompetencyGraph,
  GraphCompetencyId,
  LearnerNodeState,
  MasteryStage,
} from "./types";

const STAGE_ORDER: MasteryStage[] = [
  "not_attempted",
  "novice",
  "developing",
  "competent",
  "proficient",
  "expert",
];

export function stageIndex(stage: MasteryStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function stageFromScore(
  score: number,
  samples: number,
  threshold: number,
  minSamples: number,
): MasteryStage {
  if (samples <= 0) return "not_attempted";
  if (samples < minSamples) {
    if (score < threshold - 20) return "novice";
    if (score < threshold) return "developing";
    return "developing"; // never jump to competent on < minSamples
  }
  if (score < threshold - 25) return "novice";
  if (score < threshold) return "developing";
  if (score < threshold + 10) return "competent";
  if (score < threshold + 20) return "proficient";
  return "expert";
}

/** Reject impossible mastery: cannot be competent if required prereq is below developing. */
export function enforcePrerequisiteGate(
  graph: CompetencyGraph,
  states: Map<GraphCompetencyId, LearnerNodeState>,
  id: GraphCompetencyId,
  proposed: MasteryStage,
): MasteryStage {
  if (stageIndex(proposed) < stageIndex("competent")) return proposed;
  const rev = graph.edges.filter(
    (e) => e.to === id && e.kind === "required",
  );
  for (const edge of rev) {
    const pre = states.get(edge.from);
    const preStage = pre?.stage ?? "not_attempted";
    if (stageIndex(preStage) < stageIndex("developing")) {
      return "developing";
    }
    if (
      stageIndex(proposed) >= stageIndex("proficient") &&
      stageIndex(preStage) < stageIndex("competent")
    ) {
      return "competent";
    }
  }
  return proposed;
}

export function calculateMastery(
  state: LearnerNodeState,
  graph: CompetencyGraph = getBuiltinGraph(),
  all?: Map<GraphCompetencyId, LearnerNodeState>,
): MasteryStage {
  const node = nodeById(graph, state.competency_id);
  const threshold = node?.mastery_threshold ?? 70;
  const minSamples = node?.mastery_min_samples ?? 3;
  let stage = stageFromScore(
    state.score,
    state.samples,
    threshold,
    minSamples,
  );
  if (state.instructor_approved && stageIndex(stage) < stageIndex("competent")) {
    stage = "competent";
  }
  if (all) {
    stage = enforcePrerequisiteGate(graph, all, state.competency_id, stage);
  }
  return stage;
}

/**
 * Recalculate mastery stages in topological order so prerequisite gates
 * see updated prerequisite stages (not stale not_attempted defaults).
 */
export function recalculateAllMasteryStages(
  states: LearnerNodeState[],
  graph: CompetencyGraph = getBuiltinGraph(),
): LearnerNodeState[] {
  const order = topologicalOrder(graph);
  const map = new Map(states.map((s) => [s.competency_id, { ...s }]));
  for (const id of order) {
    const cur = map.get(id);
    if (!cur) continue;
    cur.stage = calculateMastery(cur, graph, map);
    map.set(id, cur);
  }
  return [...map.values()];
}

/**
 * Propagate confidence downward through dependents when a prerequisite is weak.
 * Strong communication does NOT inflate diagnostic formulation.
 */
export function propagatePerformance(
  graph: CompetencyGraph,
  states: LearnerNodeState[],
  updatedId: GraphCompetencyId,
  newScore: number,
): LearnerNodeState[] {
  const map = new Map(states.map((s) => [s.competency_id, { ...s }]));
  const current = map.get(updatedId);
  if (!current) return states;

  // Instructor lock blocks score mutation (practice still visible as blocked).
  if (current.locked) {
    return states;
  }

  const prevScore = current.score;
  current.score = newScore;
  current.samples += 1;
  current.trend = newScore - prevScore;
  current.last_practiced_at = new Date().toISOString();
  current.confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(current.confidence * 0.6 + newScore * 0.4),
    ),
  );
  current.stage = calculateMastery(current, graph, map);
  map.set(updatedId, current);

  // Only downward confidence penalty for weak scores
  if (newScore < 60) {
    const deps = descendants(graph, updatedId);
    const penalty = Math.round((60 - newScore) * 0.25);
    for (const depId of deps) {
      const dep = map.get(depId);
      if (!dep || dep.samples === 0) continue;
      dep.confidence = Math.max(0, dep.confidence - penalty);
      // Soft score pull — does not invent attempts
      dep.score = Math.max(0, Math.round(dep.score * 0.97));
      dep.stage = calculateMastery(dep, graph, map);
      map.set(depId, dep);
    }
  }

  return recalculateAllMasteryStages([...map.values()], graph);
}

export function isMastered(stage: MasteryStage): boolean {
  return stageIndex(stage) >= stageIndex("competent");
}
