/**
 * Audit Engine — produces the six scientific audit reports per simulation.
 */

import {
  buildValidationVersionLock,
} from "@/lib/validation/versions";
import type {
  DimensionScore,
  SessionObservables,
  ValidationAuditReport,
  ValidationAuditReportKind,
} from "@/lib/validation/types";

function report(
  kind: ValidationAuditReportKind,
  sessionId: string | null,
  scores: DimensionScore[],
  overall: number | null,
  findings: string[],
  limitations: string[],
): ValidationAuditReport {
  return {
    kind,
    session_id: sessionId,
    generated_at: new Date().toISOString(),
    scores,
    overall,
    findings,
    limitations,
    versions: buildValidationVersionLock(),
  };
}

export function buildAuditReports(input: {
  session: SessionObservables;
  realism: { overall: number; dimensions: DimensionScore[] };
  dsm: { overall: number; dimensions: DimensionScore[] };
  consistency: { overall: number; dimensions: DimensionScore[] };
  metrics: Record<string, number>;
}): ValidationAuditReport[] {
  const sid = input.session.clinical.session_id;
  const c = input.session.clinical;

  const validation = report(
    "validation",
    sid,
    [...input.realism.dimensions.slice(0, 8), ...input.dsm.dimensions.slice(0, 4)],
    input.realism.overall,
    [
      `realism_index=${input.metrics.realism_index ?? input.realism.overall}`,
      `consistency_index=${input.metrics.consistency_index ?? input.consistency.overall}`,
      "observational_only",
    ],
    [
      "Scores are platform fidelity measures — not validated clinical outcomes",
      "No patient state was modified",
    ],
  );

  const clinical = report(
    "clinical",
    sid,
    input.dsm.dimensions,
    input.dsm.overall,
    [
      `disorder_slug=${c.disorder_slug ?? "none"}`,
      `mse=${c.has_mse}`,
      `protective_factors=${c.has_protective_factors}`,
      "never_assigns_diagnoses",
    ],
    ["DSM/ICD checks measure coherence only"],
  );

  const consistency = report(
    "consistency",
    sid,
    input.consistency.dimensions,
    input.consistency.overall,
    [`dialogue_turns=${input.session.turn_count}`],
    ["Within-session consistency — not multi-site reliability"],
  );

  const decisionDims = input.realism.dimensions.filter((d) =>
    [
      "insight",
      "defensiveness",
      "avoidance",
      "motivation",
      "therapy_realism",
    ].includes(d.id),
  );
  const decision = report(
    "decision",
    sid,
    decisionDims,
    decisionDims.length
      ? Math.round(
          decisionDims.reduce((a, d) => a + d.score, 0) / decisionDims.length,
        )
      : null,
    ["DecisionPlan not modified — observational proxies only"],
    ["Does not re-run Clinical Intelligence DecisionPlan"],
  );

  const riskDims = input.realism.dimensions.filter((d) =>
    ["risk_behaviour", "protective_factors", "hopelessness"].includes(d.id),
  );
  const risk = report(
    "risk",
    sid,
    riskDims,
    riskDims.length
      ? Math.round(riskDims.reduce((a, d) => a + d.score, 0) / riskDims.length)
      : null,
    [
      `suicidal_ideation_flag=${Boolean(c.risk.suicidal_ideation)}`,
      "presence_observables_only",
    ],
    ["Not a clinical risk instrument"],
  );

  const realism = report(
    "realism",
    sid,
    input.realism.dimensions,
    input.realism.overall,
    [`dimensions=${input.realism.dimensions.length}`],
    ["Heuristic transcript + snapshot observables"],
  );

  return [validation, clinical, consistency, decision, risk, realism];
}
