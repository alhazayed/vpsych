/**
 * Phase 15 — Final General Availability Authorization evaluation.
 *
 * Composes Phase 14 gates with pilot-completion and certification workstream
 * statuses. Authorizes GA only when every gate is PASS.
 *
 * Ops / governance only — never writes Clinical Core or patient cognition.
 */

import {
  evaluateGaReadiness,
  PHASE14_CERT_ID,
  type GaGateInput,
  type GaReadinessEvaluation,
} from "@/lib/ops/phase14-ga-gates";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

export const PHASE15_CERT_ID = "VPSYCH-1.0-RC1-PHASE15";

/** Phase 15 Board gate checklist (maps onto / extends Phase 14). */
export const PHASE15_BOARD_GATES = [
  "dr_completed",
  "pitr_verified",
  "security_residuals_closed",
  "infrastructure_validated",
  "no_unresolved_critical",
  "pilot_objectives_achieved",
  "clinical_validation_successful",
  "educational_validation_successful",
  "research_package_complete",
  "governance_approved",
  "executive_board_approval",
] as const;

export type Phase15BoardGateId = (typeof PHASE15_BOARD_GATES)[number];

export type Phase15GateStatus = "PASS" | "FAIL" | "OPEN" | "PARTIAL" | "PENDING";

export type Phase15BoardGate = {
  id: Phase15BoardGateId;
  label: string;
  status: Phase15GateStatus;
  evidence: string;
  blocks_ga: boolean;
};

export type Phase15AuthorizationInput = {
  phase14_gates?: GaGateInput;
  /** Override individual Phase 15 board gates after mapping. */
  overrides?: Partial<Record<Phase15BoardGateId, Phase15GateStatus>>;
  pilot_objectives_met?: boolean;
  research_package_complete?: boolean;
  educational_validation_successful?: boolean;
  clinical_validation_successful?: boolean;
  executive_board_approved?: boolean;
};

export type Phase15AuthorizationDecision = {
  cert_id: string;
  package_version: string;
  generated_at: string;
  phase14_cert_id: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  authorized_version: "1.0.0" | null;
  phase14: GaReadinessEvaluation;
  board_gates: Phase15BoardGate[];
  pass_count: number;
  fail_or_open_count: number;
  decision: string;
  motion: string;
  notes: string[];
};

const LABELS: Record<Phase15BoardGateId, string> = {
  dr_completed: "Disaster Recovery completed",
  pitr_verified: "PITR verified",
  security_residuals_closed: "Security residuals closed",
  infrastructure_validated: "Infrastructure validated",
  no_unresolved_critical: "No unresolved Critical findings",
  pilot_objectives_achieved: "Pilot objectives achieved",
  clinical_validation_successful: "Clinical validation successful",
  educational_validation_successful: "Educational validation successful",
  research_package_complete: "Research package complete",
  governance_approved: "Governance approved",
  executive_board_approval: "Executive Board approval received",
};

function mapP14(
  status: string,
): Phase15GateStatus {
  if (status === "PASS") return "PASS";
  if (status === "PARTIAL") return "PARTIAL";
  if (status === "PENDING" || status === "NOT_YET") return "PENDING";
  return "OPEN";
}

export function evaluatePhase15Authorization(
  input: Phase15AuthorizationInput = {},
): Phase15AuthorizationDecision {
  const phase14 = evaluateGaReadiness(input.phase14_gates ?? {});
  const byId = Object.fromEntries(phase14.gates.map((g) => [g.id, g]));

  const mapped: Record<Phase15BoardGateId, Phase15GateStatus> = {
    dr_completed: mapP14(byId.dr_drill_completed?.status ?? "OPEN"),
    pitr_verified: mapP14(byId.pitr_validated?.status ?? "OPEN"),
    security_residuals_closed: mapP14(
      byId.security_residuals_closed?.status ?? "OPEN",
    ),
    infrastructure_validated: mapP14(
      byId.production_infrastructure_verified?.status ?? "OPEN",
    ),
    no_unresolved_critical: mapP14(
      byId.no_unresolved_critical_findings?.status ?? "OPEN",
    ),
    pilot_objectives_achieved: input.pilot_objectives_met
      ? "PASS"
      : mapP14(byId.stable_pilot_metrics?.status ?? "PENDING"),
    clinical_validation_successful: input.clinical_validation_successful
      ? "PASS"
      : mapP14(byId.clinical_validation_completed?.status ?? "PENDING"),
    educational_validation_successful: input.educational_validation_successful
      ? "PASS"
      : mapP14(byId.acceptable_educational_outcomes?.status ?? "PENDING"),
    research_package_complete: input.research_package_complete
      ? "PASS"
      : "PENDING",
    governance_approved: mapP14(
      byId.governance_package_approved?.status ?? "OPEN",
    ),
    executive_board_approval: input.executive_board_approved
      ? "PASS"
      : mapP14(
          byId.executive_release_board_authorization?.status ?? "NOT_YET",
        ),
  };

  for (const [id, status] of Object.entries(input.overrides ?? {}) as Array<
    [Phase15BoardGateId, Phase15GateStatus]
  >) {
    mapped[id] = status;
  }

  const evidenceFor: Record<Phase15BoardGateId, string> = {
    dr_completed: "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md",
    pitr_verified: "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md",
    security_residuals_closed:
      "docs/stage15/SECURITY_CERTIFICATION_REPORT.md",
    infrastructure_validated:
      "docs/stage15/INFRASTRUCTURE_CERTIFICATION.md",
    no_unresolved_critical:
      "institutional_feedback + docs/cidp/evidence/risk/RISK_REGISTER.md",
    pilot_objectives_achieved: "docs/stage15/PILOT_COMPLETION_REPORT.md",
    clinical_validation_successful:
      "docs/stage15/CLINICAL_VALIDATION_REPORT.md",
    educational_validation_successful:
      "docs/stage15/EDUCATIONAL_VALIDATION_REPORT.md",
    research_package_complete: "docs/stage15/RESEARCH_VALIDATION_REPORT.md",
    governance_approved: "docs/stage15/EXECUTIVE_BOARD_PACKAGE.md",
    executive_board_approval: "docs/RELEASE_DECISION_LOG.md",
  };

  const board_gates: Phase15BoardGate[] = PHASE15_BOARD_GATES.map((id) => {
    const status = mapped[id];
    return {
      id,
      label: LABELS[id],
      status,
      evidence: evidenceFor[id],
      blocks_ga: status !== "PASS",
    };
  });

  const pass_count = board_gates.filter((g) => g.status === "PASS").length;
  const fail_or_open_count = board_gates.length - pass_count;
  const allPass = fail_or_open_count === 0;
  const ga_status = allPass ? "GO" : "NO-GO";

  return {
    cert_id: PHASE15_CERT_ID,
    package_version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    phase14_cert_id: PHASE14_CERT_ID,
    cidp_status: "GO",
    ga_status,
    authorized_version: allPass ? "1.0.0" : null,
    phase14,
    board_gates,
    pass_count,
    fail_or_open_count,
    decision: allPass
      ? "AUTHORIZE VPsych Version 1.0.0 General Availability."
      : "NO-GO for General Availability. Remain on Controlled Institutional Deployment (1.0.0-rc.1).",
    motion: allPass
      ? "Motion: Tag v1.0.0, bump package.json to 1.0.0, publish Final Release Notes, append authorizing RDL."
      : "Motion: Refuse GA; continue CIDP pilots; close open Phase 15 gates with signed evidence; re-convene Board.",
    notes: [
      "Phase 15 does not modify Clinical Core, patient cognition, or ownership architecture.",
      "Competency scores remain unvalidated unless a separate Board unlock exists.",
      "Fabricating DR/PITR/pilot evidence is prohibited — empty logs keep gates OPEN.",
      ...phase14.notes,
    ],
  };
}
