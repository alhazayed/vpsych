/**
 * Clinical reasoning graph — educational, grounded in case teaching + assessment.
 * Never hallucinates diagnoses. Never writes patient state.
 */

import type {
  ClinicalReasoningEdge,
  ClinicalReasoningGraph,
  ClinicalReasoningNode,
  DiagnosticReasoningReport,
  EducationRunInput,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

function node(
  id: string,
  kind: ClinicalReasoningNode["kind"],
  label: string,
  source: ClinicalReasoningNode["source"],
  confidence?: number,
): ClinicalReasoningNode {
  return { id, kind, label, source, confidence };
}

export function buildClinicalReasoningGraph(
  input: Pick<EducationRunInput, "clinicalSnapshot" | "items" | "overall" | "narrative">,
): ClinicalReasoningGraph {
  const nodes: ClinicalReasoningNode[] = [];
  const edges: ClinicalReasoningEdge[] = [];
  const narrative: string[] = [];
  const snap = input.clinicalSnapshot;
  const core = snap?.clinical_core;
  const teaching = snap?.clinical_teaching;

  if (snap?.primary_diagnosis) {
    nodes.push(
      node(
        "dx-primary",
        "diagnosis",
        `${snap.primary_diagnosis.name} (${snap.primary_diagnosis.slug})`,
        "case_snapshot",
        90,
      ),
    );
    narrative.push(
      `Case teaching key primary presentation: ${snap.primary_diagnosis.name}. Trainee must reason toward it — engine does not invent a new diagnosis.`,
    );
  }

  for (const c of snap?.comorbidities ?? []) {
    const id = `dx-comorbid-${c.slug}`;
    nodes.push(node(id, "differential", c.name, "case_snapshot", 70));
    edges.push({ from: id, to: "dx-primary", relation: "suggests" });
  }

  for (const s of core?.symptom_profile ?? []) {
    const id = `sx-${s.id}`;
    nodes.push(
      node(id, "symptom", s.description, "case_snapshot", s.salience === "presenting" ? 85 : 60),
    );
    if (snap?.primary_diagnosis) {
      edges.push({
        from: id,
        to: "dx-primary",
        relation: s.salience === "hidden" ? "missing_for" : "supports",
      });
    }
  }

  const risk = core?.risk_profile as Record<string, unknown> | undefined;
  if (risk) {
    const si = String(risk.suicidal_ideation ?? "none");
    nodes.push(
      node("risk-si", "risk", `Suicidal ideation flag: ${si}`, "case_snapshot", 80),
    );
    edges.push({ from: "risk-si", to: "dx-primary", relation: "raises" });
  }

  for (const p of core?.protective_factors ?? []) {
    const id = `pf-${p.id}`;
    nodes.push(node(id, "protective", p.label, "case_snapshot", 70));
    edges.push({ from: id, to: "risk-si", relation: "protects_against" });
  }

  for (const d of teaching?.differentials ?? []) {
    const id = `diff-${d.toLowerCase().replace(/\W+/g, "-").slice(0, 40)}`;
    nodes.push(node(id, "differential", d, "package_seed", 55));
    edges.push({ from: id, to: "dx-primary", relation: "suggests" });
  }

  for (const r of teaching?.rule_outs ?? []) {
    const id = `ro-${r.toLowerCase().replace(/\W+/g, "-").slice(0, 40)}`;
    nodes.push(node(id, "evidence_gap", `Rule out: ${r}`, "package_seed", 50));
    edges.push({ from: id, to: "dx-primary", relation: "missing_for" });
  }

  // Assessment rubric signals (trainee performance — not patient truth)
  for (const item of input.items) {
    const pct = item.max > 0 ? (item.score / item.max) * 100 : input.overall;
    if (item.id === "differential_diagnosis" && pct < 60) {
      nodes.push(
        node(
          "gap-diff",
          "evidence_gap",
          "Differential reasoning scored low this session",
          "assessment",
          pct,
        ),
      );
      narrative.push(
        "Assessment suggests incomplete differential exploration — review case differentials teaching list.",
      );
    }
    if (item.id === "risk_formulation" && pct < 60) {
      nodes.push(
        node(
          "gap-risk",
          "evidence_gap",
          "Risk formulation scored low this session",
          "assessment",
          pct,
        ),
      );
    }
  }

  if (core?.mse) {
    nodes.push(
      node("mse-snapshot", "function", "Runtime MSE teaching cues present on case", "case_snapshot", 75),
    );
  }

  if (!nodes.length) {
    narrative.push(
      "No case teaching graph available for this session — reasoning limited to assessment scores.",
    );
  }

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    nodes,
    edges,
    narrative,
  };
}

/**
 * DSM/ICD educational reasoning report.
 * Produces supported / alternative / missing / contradictory evidence from the CASE KEY,
 * not a free-form diagnostic invention.
 */
export function buildDiagnosticReasoningReport(
  input: Pick<EducationRunInput, "clinicalSnapshot" | "items" | "overall">,
): DiagnosticReasoningReport {
  const snap = input.clinicalSnapshot;
  const primary = snap?.primary_diagnosis ?? null;
  const teaching = snap?.clinical_teaching;
  const dsmItem = input.items.find((i) => i.id === "dsm_reasoning");
  const icdItem = input.items.find((i) => i.id === "icd_reasoning");
  const diffItem = input.items.find((i) => i.id === "differential_diagnosis");

  const dsmPct =
    dsmItem && dsmItem.max > 0 ? (dsmItem.score / dsmItem.max) * 100 : input.overall;
  const icdPct =
    icdItem && icdItem.max > 0 ? (icdItem.score / icdItem.max) * 100 : input.overall;
  const diffPct =
    diffItem && diffItem.max > 0
      ? (diffItem.score / diffItem.max) * 100
      : input.overall;

  const supporting: string[] = [];
  for (const s of snap?.clinical_core?.symptom_profile ?? []) {
    if (s.salience === "presenting") supporting.push(s.description);
  }
  if (primary?.dsm5_code) supporting.push(`DSM-5 code on case: ${primary.dsm5_code}`);
  if (primary?.icd11_code) supporting.push(`ICD-11 code on case: ${primary.icd11_code}`);

  const supported_diagnoses = primary
    ? [
        {
          slug: primary.slug,
          name: primary.name,
          confidence: Math.round(Math.min(95, 55 + (dsmPct + icdPct) / 8)),
          supporting_evidence: supporting.slice(0, 8),
        },
      ]
    : [];

  const alternative_diagnoses = (teaching?.differentials ?? [])
    .slice(0, 5)
    .map((d) => ({
      slug: d.toLowerCase().replace(/\s+/g, "-").slice(0, 48),
      name: d,
      confidence: Math.round(Math.max(20, 70 - diffPct / 3)),
      why: "Listed on case teaching differentials — explore before closing.",
    }));

  const missing_evidence = [
    ...(teaching?.rule_outs ?? []).map((r) => `Rule-out still needs evidence: ${r}`),
    ...((snap?.clinical_core?.symptom_profile ?? [])
      .filter((s) => s.salience === "hidden" || s.salience === "elicited")
      .slice(0, 4)
      .map((s) => `Elicit: ${s.description}`)),
  ];

  const contradictory_evidence: string[] = [];
  if (dsmPct < 50 && primary) {
    contradictory_evidence.push(
      "Low DSM reasoning score relative to case key — criteria may have been under-explored or misapplied.",
    );
  }
  if ((teaching?.common_mistakes ?? []).length) {
    for (const m of teaching!.common_mistakes!.slice(0, 3)) {
      contradictory_evidence.push(`Common trap: ${m}`);
    }
  }

  const next_interview_questions = [
    "What symptoms began first, and over what timeline?",
    "Have you had periods of unusually high energy or needing much less sleep?",
    "When things are at their worst, do you have thoughts of ending your life?",
    ...(teaching?.teaching_points ?? [])
      .slice(0, 2)
      .map((t) => `Explore teaching point: ${t}`),
  ].slice(0, 6);

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    supported_diagnoses,
    alternative_diagnoses,
    missing_evidence,
    contradictory_evidence,
    next_interview_questions,
    case_primary_slug: primary?.slug ?? null,
  };
}
