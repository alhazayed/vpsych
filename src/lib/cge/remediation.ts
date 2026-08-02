import { getBuiltinGraph, nodeById, prerequisiteChain } from "./graph";
import { runRootCauseAnalysis } from "./rca";
import type {
  CompetencyGraph,
  GraphCompetencyId,
  LearnerNodeState,
  RemediationPlan,
  RemediationStep,
} from "./types";

const SUICIDE_CASES = [
  { title: "Passive suicidal ideation", diagnosis: "mdd-recurrent-moderate", difficulty: "beginner", focus: "passive_si" },
  { title: "Hidden suicidal ideation", diagnosis: "mdd-recurrent-moderate", difficulty: "intermediate", focus: "hidden_si" },
  { title: "Complex risk formulation", diagnosis: "bpd", difficulty: "intermediate", focus: "complex_risk" },
  { title: "Psychotic depression risk", diagnosis: "mdd-recurrent-moderate", difficulty: "advanced", focus: "psychotic_depression" },
  { title: "Emergency psychiatry", diagnosis: "ptsd", difficulty: "advanced", focus: "emergency" },
];

const GENERIC_STAGES = [
  { title: "Foundational practice", difficulty: "beginner" },
  { title: "Guided application", difficulty: "intermediate" },
  { title: "Ambiguous presentation", difficulty: "intermediate" },
  { title: "Complex comorbidity", difficulty: "advanced" },
  { title: "Mastery demonstration", difficulty: "advanced" },
];

function diagnosisFor(competency: GraphCompetencyId): string {
  if (competency.includes("suicide") || competency.includes("risk") || competency.includes("safety") || competency.includes("emergency")) {
    return "mdd-recurrent-moderate";
  }
  if (competency.includes("cbt") || competency.includes("alliance")) {
    return "gad-with-panic";
  }
  if (competency.includes("dbt")) return "bpd";
  return "mdd-recurrent-moderate";
}

/**
 * Build remediation starting at root cause, not at the observed failure tip.
 */
export function generateRemediationPlan(
  learnerId: string,
  observedFailure: GraphCompetencyId,
  states: LearnerNodeState[],
  graph: CompetencyGraph = getBuiltinGraph(),
): RemediationPlan {
  const rca = runRootCauseAnalysis(observedFailure, states, graph);
  const root = rca.root_cause;
  const chain = prerequisiteChain(graph, observedFailure);
  const startIdx = Math.max(0, chain.indexOf(root));
  const ascent = chain.slice(startIdx); // root → … → observed

  const pathway: RemediationStep[] = [];

  if (
    root === "suicide_assessment" ||
    root === "risk_screening" ||
    root === "risk_assessment" ||
    root === "safety_planning" ||
    observedFailure === "suicide_assessment" ||
    observedFailure === "emergency_psychiatry"
  ) {
    for (let i = 0; i < SUICIDE_CASES.length; i++) {
      const c = SUICIDE_CASES[i]!;
      pathway.push({
        index: i,
        competency_id: root,
        title: c.title,
        case_focus: c.focus,
        diagnosis_slug: c.diagnosis,
        difficulty: c.difficulty,
        completed: false,
      });
    }
  } else {
    // One step per ascent competency + generic deepening on root
    let idx = 0;
    for (const comp of ascent) {
      const stage = GENERIC_STAGES[Math.min(idx, GENERIC_STAGES.length - 1)]!;
      pathway.push({
        index: idx,
        competency_id: comp,
        title: `${stage.title}: ${comp.replace(/_/g, " ")}`,
        case_focus: comp,
        diagnosis_slug: diagnosisFor(comp),
        difficulty: stage.difficulty,
        completed: false,
      });
      idx += 1;
    }
    while (pathway.length < 3) {
      const stage = GENERIC_STAGES[pathway.length]!;
      pathway.push({
        index: pathway.length,
        competency_id: root,
        title: `${stage.title}: ${root.replace(/_/g, " ")}`,
        case_focus: root,
        diagnosis_slug: diagnosisFor(root),
        difficulty: stage.difficulty,
        completed: false,
      });
    }
  }

  const recommended_cases = pathway.slice(0, 5).map((step) => ({
    disorderSlug: step.diagnosis_slug,
    focusCompetencies: [step.competency_id],
    difficulty: step.difficulty,
    rationale: `Remediate root cause ${root} (observed ${observedFailure}) — ${step.title}`,
  }));

  const hours = ascent.reduce((sum, id) => {
    const node = nodeById(graph, id);
    return sum + (node?.estimated_training_hours ?? 2);
  }, 0);

  return {
    id: `rem-${learnerId}-${root}-${Date.now().toString(36)}`,
    learner_id: learnerId,
    observed_failure: observedFailure,
    root_cause_id: root,
    pathway,
    recommended_cases,
    estimated_hours: Math.round(hours * 10) / 10,
    status: "active",
  };
}

export function recommendNextFromPlan(
  plan: RemediationPlan,
): RemediationPlan["recommended_cases"][number] | null {
  const next = plan.pathway.find((s) => !s.completed);
  if (!next) return null;
  return {
    disorderSlug: next.diagnosis_slug,
    focusCompetencies: [next.competency_id],
    difficulty: next.difficulty,
    rationale: `Next remediation step: ${next.title}`,
  };
}
