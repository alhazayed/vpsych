import { getBuiltinGraph, nodeById } from "./graph";
import { runRootCauseAnalysis } from "./rca";
import { generateRemediationPlan } from "./remediation";
import { applyCompetencyDecay } from "./decay";
import { isMastered, stageIndex } from "./mastery";
import type {
  CompetencyGraph,
  LearnerNodeState,
  SupervisorGraphReport,
} from "./types";

export function generateSupervisorGraphReport(
  learnerId: string,
  states: LearnerNodeState[],
  observedFailure?: string,
  graph: CompetencyGraph = getBuiltinGraph(),
): SupervisorGraphReport {
  const { states: decayed, atRisk } = applyCompetencyDecay(states);
  const assessed = decayed.filter((s) => s.samples > 0);

  const weakest = [...assessed].sort((a, b) => a.score - b.score)[0] ?? null;
  const strongest = [...assessed].sort((a, b) => b.score - a.score)[0] ?? null;
  const fastest = [...assessed]
    .filter((s) => (s.trend ?? 0) > 0)
    .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))[0] ?? null;

  const failure =
    observedFailure ??
    weakest?.competency_id ??
    "diagnostic_interview";

  const rca =
    assessed.length > 0
      ? runRootCauseAnalysis(failure, decayed, graph)
      : null;

  const plan = rca
    ? generateRemediationPlan(learnerId, failure, decayed, graph)
    : null;

  const reading = rca
    ? (nodeById(graph, rca.root_cause)?.recommended_resources ?? []).slice(0, 3)
    : ["Clinical interviewing basics"];

  const modalities =
    rca?.root_cause.includes("cbt")
      ? ["cbt"]
      : rca?.root_cause.includes("dbt")
        ? ["dbt"]
        : rca?.root_cause.includes("suicide") || rca?.root_cause.includes("risk")
          ? ["crisis_intervention", "supportive"]
          : ["supportive", "cbt"];

  const hours = plan?.estimated_hours ?? 4;

  const supervisor_feedback = [
    rca
      ? `Root cause analysis: ${rca.explanation}`
      : "Insufficient assessment history for root cause analysis.",
    strongest
      ? `Strongest competency: ${strongest.competency_id.replace(/_/g, " ")} (${strongest.score}, ${strongest.stage}).`
      : "",
    fastest
      ? `Fastest improving: ${fastest.competency_id.replace(/_/g, " ")} (Δ ${fastest.trend}).`
      : "",
    atRisk.length
      ? `At risk of decay: ${atRisk.slice(0, 4).map((id) => id.replace(/_/g, " ")).join(", ")}.`
      : "No competencies currently at decay risk.",
    plan
      ? `Remediation begins at ${plan.root_cause_id.replace(/_/g, " ")} (${plan.pathway.length} steps, ~${hours}h).`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    root_cause: rca,
    weakest_prerequisite: rca?.weakest_prerequisite ?? weakest?.competency_id ?? null,
    strongest: strongest?.competency_id ?? null,
    fastest_improving: fastest?.competency_id ?? null,
    at_risk_of_decay: atRisk,
    supervisor_feedback,
    learning_plan: plan
      ? plan.pathway.slice(0, 5).map((s) => s.title)
      : ["Complete a foundational diagnostic interview case"],
    recommended_next_cases: plan
      ? plan.recommended_cases.map((c) => c.rationale)
      : [],
    recommended_reading: reading.length
      ? reading
      : ["APA practice guideline module"],
    recommended_modalities: modalities,
    estimated_hours_to_mastery: hours,
  };
}

export function summarizeLearnerGraph(
  states: LearnerNodeState[],
  graph: CompetencyGraph = getBuiltinGraph(),
) {
  const mastered = states
    .filter((s) => isMastered(s.stage))
    .map((s) => s.competency_id);
  const developing = states
    .filter(
      (s) =>
        s.samples > 0 &&
        stageIndex(s.stage) > 0 &&
        stageIndex(s.stage) < stageIndex("competent"),
    )
    .map((s) => s.competency_id);
  return {
    mastered,
    developing,
    nodeCount: graph.nodes.length,
  };
}
