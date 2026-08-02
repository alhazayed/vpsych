import type {
  CompetencyEdge,
  CompetencyGraph,
  CompetencyNode,
  EdgeKind,
  GraphCompetencyId,
} from "./types";

/** Compact node factory */
function n(
  id: string,
  name: string,
  domain: string,
  difficulty: CompetencyNode["difficulty"],
  importance: number,
  sort: number,
  hours = 2,
  threshold = 70,
  minSamples = 3,
): CompetencyNode {
  return {
    id,
    name,
    description: name,
    domain,
    difficulty,
    clinical_importance: importance,
    learning_objectives: [],
    assessment_methods: [],
    mastery_threshold: threshold,
    mastery_min_samples: minSamples,
    recommended_resources: [],
    estimated_training_hours: hours,
    version: 1,
    enabled: true,
    sort_order: sort,
  };
}

function e(
  from: string,
  to: string,
  kind: EdgeKind = "required",
  weight = 1,
): CompetencyEdge {
  return { from, to, kind, weight };
}

/**
 * Builtin foundation graph (mirrors migration seed).
 * Edge direction: prerequisite → dependent.
 */
export const BUILTIN_GRAPH: CompetencyGraph = {
  version: 1,
  nodes: [
    n("clinical_communication", "Clinical Communication", "alliance", "foundation", 9, 5),
    n("diagnostic_interview", "Diagnostic Interview", "assessment", "foundation", 10, 10, 3),
    n("mental_status_examination", "Mental Status Examination", "assessment", "foundation", 10, 20),
    n("dsm5_reasoning", "DSM-5 Diagnostic Reasoning", "diagnosis", "intermediate", 9, 30, 4),
    n("icd11_reasoning", "ICD-11 Diagnostic Reasoning", "diagnosis", "intermediate", 8, 40, 3),
    n("differential_diagnosis", "Differential Diagnosis", "diagnosis", "advanced", 10, 50, 4, 70, 4),
    n("case_formulation", "Case Formulation", "diagnosis", "advanced", 9, 55, 3),
    n("treatment_planning", "Treatment Planning", "treatment", "advanced", 10, 60, 3),
    n("medication_management", "Medication Management", "treatment", "advanced", 9, 70, 5, 75, 4),
    n("follow_up_planning", "Follow-up Planning", "treatment", "intermediate", 7, 80, 1.5),
    n("risk_screening", "Risk Screening", "safety", "foundation", 10, 90),
    n("risk_assessment", "Risk Assessment", "safety", "intermediate", 10, 100, 3),
    n("suicide_assessment", "Suicide Assessment", "safety", "advanced", 10, 110, 4, 75, 4),
    n("violence_assessment", "Violence Assessment", "safety", "advanced", 9, 120, 3, 75, 3),
    n("safety_planning", "Safety Planning", "safety", "advanced", 10, 130, 2, 75, 3),
    n("emergency_psychiatry", "Emergency Psychiatry", "safety", "expert", 10, 140, 5, 80, 4),
    n("therapeutic_alliance", "Therapeutic Alliance", "alliance", "foundation", 9, 150),
    n("empathy", "Empathy", "alliance", "foundation", 8, 160, 1.5, 70, 2),
    n("cbt_skills", "CBT Skills", "therapy", "intermediate", 8, 170, 4),
    n("dbt_skills", "DBT Skills", "therapy", "advanced", 8, 180, 4),
    n("act_skills", "ACT Skills", "therapy", "advanced", 7, 190, 3),
    n("psychodynamic_interviewing", "Psychodynamic Skills", "therapy", "advanced", 7, 200, 4),
    n("supportive_therapy", "Supportive Therapy", "therapy", "intermediate", 7, 210),
    n("motivational_interviewing", "Motivational Interviewing", "therapy", "intermediate", 8, 220, 3),
    n("documentation", "Clinical Documentation", "professional", "intermediate", 8, 230),
    n("case_summary", "Case Summary", "professional", "intermediate", 7, 240, 1.5, 70, 2),
    n("diagnostic_formulation", "Diagnostic Formulation", "professional", "advanced", 8, 250),
    n("treatment_documentation", "Treatment Documentation", "professional", "advanced", 7, 260, 1.5, 70, 2),
    n("psychoeducation", "Psychoeducation", "treatment", "intermediate", 7, 270, 1.5, 70, 2),
    n("professional_communication", "Professional Communication", "professional", "foundation", 8, 280, 1, 70, 2),
    n("time_management", "Time Management", "professional", "foundation", 7, 290, 1, 70, 2),
    n("ethical_decision_making", "Ethical Decision Making", "professional", "intermediate", 9, 300, 2, 75, 2),
    n("cultural_competence", "Cultural Competence", "professional", "intermediate", 8, 310, 2, 70, 2),
    n("family_interviewing", "Family Interviewing", "assessment", "advanced", 7, 320, 2, 70, 2),
  ],
  edges: [
    e("clinical_communication", "diagnostic_interview"),
    e("diagnostic_interview", "mental_status_examination"),
    e("mental_status_examination", "dsm5_reasoning"),
    e("dsm5_reasoning", "icd11_reasoning", "recommended", 0.7),
    e("mental_status_examination", "differential_diagnosis"),
    e("dsm5_reasoning", "differential_diagnosis"),
    e("differential_diagnosis", "case_formulation"),
    e("dsm5_reasoning", "case_formulation"),
    e("case_formulation", "treatment_planning"),
    e("differential_diagnosis", "treatment_planning"),
    e("risk_assessment", "treatment_planning"),
    e("treatment_planning", "medication_management", "recommended", 0.8),
    e("treatment_planning", "follow_up_planning"),
    e("diagnostic_interview", "risk_screening"),
    e("risk_screening", "risk_assessment"),
    e("risk_assessment", "suicide_assessment"),
    e("risk_assessment", "violence_assessment"),
    e("suicide_assessment", "safety_planning"),
    e("violence_assessment", "safety_planning", "recommended", 0.6),
    e("safety_planning", "emergency_psychiatry"),
    e("risk_assessment", "emergency_psychiatry"),
    e("clinical_communication", "therapeutic_alliance"),
    e("clinical_communication", "empathy"),
    e("therapeutic_alliance", "cbt_skills"),
    e("therapeutic_alliance", "dbt_skills"),
    e("therapeutic_alliance", "act_skills"),
    e("therapeutic_alliance", "psychodynamic_interviewing"),
    e("therapeutic_alliance", "supportive_therapy"),
    e("therapeutic_alliance", "motivational_interviewing", "recommended", 0.7),
    e("empathy", "therapeutic_alliance", "recommended", 0.5),
    e("mental_status_examination", "documentation"),
    e("documentation", "case_summary"),
    e("case_summary", "diagnostic_formulation"),
    e("dsm5_reasoning", "diagnostic_formulation"),
    e("diagnostic_formulation", "treatment_documentation"),
    e("treatment_planning", "treatment_documentation"),
    e("diagnostic_interview", "psychoeducation", "recommended", 0.5),
    e("clinical_communication", "professional_communication", "recommended", 0.5),
    e("diagnostic_interview", "time_management", "optional", 0.3),
    e("clinical_communication", "cultural_competence", "recommended", 0.6),
    e("diagnostic_interview", "family_interviewing", "recommended", 0.5),
    e("ethical_decision_making", "suicide_assessment", "recommended", 0.4),
  ],
};

export function getBuiltinGraph(): CompetencyGraph {
  return BUILTIN_GRAPH;
}

export function nodeById(
  graph: CompetencyGraph,
  id: GraphCompetencyId,
): CompetencyNode | undefined {
  return graph.nodes.find((n) => n.id === id && n.enabled);
}

/** Adjacency: prerequisite → dependents */
export function buildForwardAdj(
  graph: CompetencyGraph,
): Map<GraphCompetencyId, CompetencyEdge[]> {
  const m = new Map<GraphCompetencyId, CompetencyEdge[]>();
  for (const edge of graph.edges) {
    const list = m.get(edge.from) ?? [];
    list.push(edge);
    m.set(edge.from, list);
  }
  return m;
}

/** Adjacency: dependent → prerequisites */
export function buildReverseAdj(
  graph: CompetencyGraph,
  kinds: EdgeKind[] = ["required", "recommended", "optional"],
): Map<GraphCompetencyId, CompetencyEdge[]> {
  const allow = new Set(kinds);
  const m = new Map<GraphCompetencyId, CompetencyEdge[]>();
  for (const edge of graph.edges) {
    if (!allow.has(edge.kind)) continue;
    const list = m.get(edge.to) ?? [];
    list.push(edge);
    m.set(edge.to, list);
  }
  return m;
}

export function requiredPrerequisites(
  graph: CompetencyGraph,
  id: GraphCompetencyId,
): GraphCompetencyId[] {
  return (buildReverseAdj(graph, ["required"]).get(id) ?? []).map((e) => e.from);
}

/** Detect directed cycles. Returns cycle path or null. */
export function findCycle(
  graph: CompetencyGraph,
): GraphCompetencyId[] | null {
  const fwd = buildForwardAdj(graph);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      return stack.slice(idx).concat(node);
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const edge of fwd.get(node) ?? []) {
      const c = dfs(edge.to);
      if (c) return c;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of graph.nodes) {
    const c = dfs(node.id);
    if (c) return c;
  }
  return null;
}

export function assertAcyclic(graph: CompetencyGraph): void {
  const cycle = findCycle(graph);
  if (cycle) {
    throw new Error(`Competency graph contains a cycle: ${cycle.join(" → ")}`);
  }
}

/** Kahn topological order; throws if cyclic. */
export function topologicalOrder(graph: CompetencyGraph): GraphCompetencyId[] {
  const ids = graph.nodes.filter((n) => n.enabled).map((n) => n.id);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const fwd = buildForwardAdj(graph);
  for (const id of ids) {
    for (const edge of fwd.get(id) ?? []) {
      if (indeg.has(edge.to)) {
        indeg.set(edge.to, (indeg.get(edge.to) ?? 0) + 1);
      }
    }
  }
  const q = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  const out: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    out.push(u);
    for (const edge of fwd.get(u) ?? []) {
      if (!indeg.has(edge.to)) continue;
      const d = (indeg.get(edge.to) ?? 0) - 1;
      indeg.set(edge.to, d);
      if (d === 0) q.push(edge.to);
    }
  }
  if (out.length !== ids.length) {
    throw new Error("Competency graph is not a DAG (cycle detected)");
  }
  return out;
}

/** Ancestors (all prerequisites recursively) of a competency. */
export function ancestors(
  graph: CompetencyGraph,
  id: GraphCompetencyId,
  kinds: EdgeKind[] = ["required"],
): GraphCompetencyId[] {
  const rev = buildReverseAdj(graph, kinds);
  const seen = new Set<string>();
  const stack = [...(rev.get(id) ?? []).map((e) => e.from)];
  while (stack.length) {
    const u = stack.pop()!;
    if (seen.has(u)) continue;
    seen.add(u);
    for (const edge of rev.get(u) ?? []) stack.push(edge.from);
  }
  return [...seen];
}

/** Descendants (dependents) of a competency. */
export function descendants(
  graph: CompetencyGraph,
  id: GraphCompetencyId,
): GraphCompetencyId[] {
  const fwd = buildForwardAdj(graph);
  const seen = new Set<string>();
  const stack = [...(fwd.get(id) ?? []).map((e) => e.to)];
  while (stack.length) {
    const u = stack.pop()!;
    if (seen.has(u)) continue;
    seen.add(u);
    for (const edge of fwd.get(u) ?? []) stack.push(edge.to);
  }
  return [...seen];
}

/** Shortest prerequisite chain from root foundation to target (required edges). */
export function prerequisiteChain(
  graph: CompetencyGraph,
  target: GraphCompetencyId,
): GraphCompetencyId[] {
  const rev = buildReverseAdj(graph, ["required"]);
  // BFS backward to a node with no required prereqs
  const prev = new Map<string, string | null>();
  const q = [target];
  prev.set(target, null);
  let root = target;
  while (q.length) {
    const u = q.shift()!;
    const prereqs = rev.get(u) ?? [];
    if (prereqs.length === 0) {
      root = u;
      break;
    }
    for (const edge of prereqs) {
      if (!prev.has(edge.from)) {
        prev.set(edge.from, u);
        q.push(edge.from);
      }
    }
  }
  // Reconstruct path root → target
  // prev maps child←parent incorrectly; rebuild via walking from root using BFS forward constrained to ancestors
  const anc = new Set(ancestors(graph, target, ["required"]).concat(target));
  const fwd = buildForwardAdj(graph);
  const parent = new Map<string, string | null>();
  const qq = [root];
  parent.set(root, null);
  while (qq.length) {
    const u = qq.shift()!;
    if (u === target) break;
    for (const edge of fwd.get(u) ?? []) {
      if (edge.kind !== "required") continue;
      if (!anc.has(edge.to)) continue;
      if (!parent.has(edge.to)) {
        parent.set(edge.to, u);
        qq.push(edge.to);
      }
    }
  }
  const path: string[] = [];
  let cur: string | null = target;
  while (cur) {
    path.push(cur);
    cur = parent.get(cur) ?? null;
    if (cur === null && path[path.length - 1] !== root && path.length === 1) {
      break;
    }
  }
  path.reverse();
  if (!path.includes(target)) return [target];
  return path;
}

export function validatePrerequisites(
  graph: CompetencyGraph,
): string[] {
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) {
      errors.push(`Edge from unknown node ${edge.from}`);
    }
    if (!ids.has(edge.to)) {
      errors.push(`Edge to unknown node ${edge.to}`);
    }
    if (edge.from === edge.to) {
      errors.push(`Self-loop on ${edge.from}`);
    }
  }
  const cycle = findCycle(graph);
  if (cycle) errors.push(`Cycle: ${cycle.join(" → ")}`);
  return errors;
}
