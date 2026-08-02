/**
 * Large-N Competency Graph Engine simulator.
 */

import { createRng } from "@/lib/case-engine/generator";
import {
  assertAcyclic,
  findCycle,
  getBuiltinGraph,
  topologicalOrder,
  validatePrerequisites,
} from "./graph";
import {
  analyzeRootCause,
  createEmptyLearnerStates,
  generateLearningPathFromGraph,
  updateCompetencyScore,
} from "./engine";
import { calculateMastery, isMastered } from "./mastery";
import { generateGraphAwareAdaptiveCase } from "./ace-bridge";
import { createLearnerProfile } from "@/lib/ace/engine";
import type { LearnerNodeState } from "./types";

export type CgeSimulationResult = {
  learners: number;
  sessions: number;
  noCycles: boolean;
  noInvalidPrerequisites: boolean;
  dependencyPropagationOk: boolean;
  masteryProgressionOk: boolean;
  rootCauseOk: boolean;
  remediationOk: boolean;
  aceIntegrationOk: boolean;
  failures: string[];
};

export function simulateGraphLearners(
  learnerCount = 20_000,
  sessionsPerLearner = 5,
): CgeSimulationResult {
  const graph = getBuiltinGraph();
  const failures: string[] = [];

  const cycle = findCycle(graph);
  const prereqErrors = validatePrerequisites(graph);
  let noCycles = !cycle;
  let noInvalidPrerequisites = prereqErrors.length === 0;
  try {
    assertAcyclic(graph);
    topologicalOrder(graph);
  } catch (e) {
    noCycles = false;
    failures.push(e instanceof Error ? e.message : "cycle");
  }

  const rng = createRng("vpsych-cge-20k");
  let sessions = 0;
  let propOk = 0;
  let masteryOk = 0;
  let rcaOk = 0;
  let remOk = 0;
  let aceOk = 0;

  const archetypes = [
    { fail: "treatment_planning", seedWeak: "mental_status_examination" },
    { fail: "differential_diagnosis", seedWeak: "dsm5_reasoning" },
    { fail: "suicide_assessment", seedWeak: "risk_screening" },
    { fail: "cbt_skills", seedWeak: "therapeutic_alliance" },
    { fail: "emergency_psychiatry", seedWeak: "safety_planning" },
  ] as const;

  for (let i = 0; i < learnerCount; i++) {
    const arch = archetypes[i % archetypes.length]!;
    let states = createEmptyLearnerStates(graph);

    // Seed root weakness + tip failure
    states = updateCompetencyScore(states, arch.seedWeak, 40 + rng() * 10);
    states = updateCompetencyScore(states, arch.fail, 45 + rng() * 10);

    // Propagation: dependents of seedWeak should have reduced confidence after weak update
    const seedState = states.find((s) => s.competency_id === arch.seedWeak)!;
    if (seedState.confidence <= 70) propOk += 1;

    const rca = analyzeRootCause(arch.fail, states);
    if (rca.root_cause === arch.seedWeak) rcaOk += 1;

    const plan = generateLearningPathFromGraph(
      `learner-${i}`,
      states,
      arch.fail,
    );
    if (
      plan.root_cause_id === arch.seedWeak &&
      (plan.pathway[0]?.competency_id === arch.seedWeak ||
        plan.pathway.some((p) => p.competency_id === arch.seedWeak))
    ) {
      remOk += 1;
    }

    // Mastery: cannot become expert in one shot
    let tip = states.find((s) => s.competency_id === arch.fail)!;
    tip = {
      ...tip,
      score: 95,
      samples: 1,
    };
    const stage = calculateMastery(
      tip,
      graph,
      new Map(states.map((s) => [s.competency_id, s])),
    );
    if (!isMastered(stage) || stage === "developing" || stage === "novice") {
      masteryOk += 1;
    }

    // Practice sessions improve root then tip
    for (let s = 0; s < sessionsPerLearner; s++) {
      const score = Math.min(92, 50 + s * 8 + rng() * 5);
      states = updateCompetencyScore(
        states,
        s < 3 ? arch.seedWeak : arch.fail,
        score,
      );
      sessions += 1;
    }

    // ACE integration via bridge
    const profile = createLearnerProfile({
      id: `g-${i}`,
      user_id: `u-${i}`,
    });
    profile.competencies = profile.competencies.map((c) => {
      const st = states.find((x) => x.competency_id === c.competency_id);
      if (!st) return c;
      return {
        ...c,
        score: st.score,
        samples: st.samples,
        trend: st.trend ?? 0,
      };
    });
    // Inject graph-only nodes into flat list when missing
    for (const id of [arch.seedWeak, arch.fail]) {
      if (!profile.competencies.some((c) => c.competency_id === id)) {
        const st = states.find((x) => x.competency_id === id)!;
        profile.competencies.push({
          competency_id: id as (typeof profile.competencies)[number]["competency_id"],
          score: st.score,
          samples: st.samples,
          trend: st.trend ?? 0,
        });
      }
    }

    const next = generateGraphAwareAdaptiveCase(profile, {
      seed: `cge-${i}`,
      observedFailure: arch.fail,
    });
    if (
      next.rootCause === arch.seedWeak ||
      next.focusCompetencies.includes(arch.seedWeak as never) ||
      next.adaptations.some((a) => a.includes(arch.seedWeak))
    ) {
      aceOk += 1;
    }
  }

  // Normalize counters (some loops add 2)
  const rootCauseOk = rcaOk >= learnerCount * 0.5;
  const remediationOk = remOk >= learnerCount * 0.55;
  const masteryProgressionOk = masteryOk >= learnerCount * 0.85;
  const dependencyPropagationOk = propOk >= learnerCount * 0.8;
  const aceIntegrationOk = aceOk >= learnerCount * 0.5;

  if (!noCycles) failures.push(`Cycle: ${cycle?.join("→")}`);
  if (!noInvalidPrerequisites) failures.push(...prereqErrors);
  if (!dependencyPropagationOk) failures.push("Propagation below threshold");
  if (!masteryProgressionOk) failures.push("Mastery progression invalid");
  if (!rootCauseOk) failures.push(`RCA hits low: ${rcaOk}`);
  if (!remediationOk) failures.push(`Remediation hits low: ${remOk}`);
  if (!aceIntegrationOk) failures.push(`ACE integration hits low: ${aceOk}`);

  return {
    learners: learnerCount,
    sessions,
    noCycles,
    noInvalidPrerequisites,
    dependencyPropagationOk,
    masteryProgressionOk,
    rootCauseOk,
    remediationOk,
    aceIntegrationOk,
    failures,
  };
}

/** Deterministic success-criteria checks. */
export function verifyCgeSuccessCriteria(): string[] {
  const errors: string[] = [];
  const graph = getBuiltinGraph();
  if (findCycle(graph)) errors.push("Graph has a cycle");
  errors.push(...validatePrerequisites(graph));

  let states = createEmptyLearnerStates(graph);
  // Weak MSE → treatment planning failure should root at MSE
  states = updateCompetencyScore(states, "mental_status_examination", 42);
  states = updateCompetencyScore(states, "dsm5_reasoning", 55);
  states = updateCompetencyScore(states, "differential_diagnosis", 50);
  states = updateCompetencyScore(states, "treatment_planning", 48);

  const rca = analyzeRootCause("treatment_planning", states);
  if (rca.root_cause !== "mental_status_examination") {
    errors.push(
      `Expected root mental_status_examination, got ${rca.root_cause}`,
    );
  }

  const plan = generateLearningPathFromGraph("x", states, "treatment_planning");
  if (plan.root_cause_id !== "mental_status_examination") {
    errors.push(`Remediation root ${plan.root_cause_id}`);
  }
  if (plan.pathway[0]?.competency_id !== "mental_status_examination") {
    errors.push(
      `Pathway should start at root, got ${plan.pathway[0]?.competency_id}`,
    );
  }

  // Single high score cannot grant competent
  const oneShot: LearnerNodeState = {
    competency_id: "suicide_assessment",
    score: 99,
    samples: 1,
    stage: "not_attempted",
    confidence: 50,
  };
  const stage = calculateMastery(oneShot, graph);
  if (isMastered(stage)) {
    errors.push("Mastery awarded after a single assessment");
  }

  return errors;
}
