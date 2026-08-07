/**
 * Phase 14 — General Availability Decision Framework.
 *
 * Evaluates the binding GA gates. Platform remains CIDP GO / GA NO-GO
 * until every gate is PASS and Release Board authorizes v1.0.0.
 *
 * Ops / governance only — never writes patient cognition or Clinical Core.
 */

import { PACKAGE_VERSION } from "@/lib/ops/versions";

export const PHASE14_CERT_ID = "VPSYCH-1.0-RC1-PHASE14";

export const GA_GATE_IDS = [
  "dr_drill_completed",
  "pitr_validated",
  "production_infrastructure_verified",
  "security_residuals_closed",
  "no_unresolved_critical_findings",
  "stable_pilot_metrics",
  "acceptable_educational_outcomes",
  "clinical_validation_completed",
  "governance_package_approved",
  "executive_release_board_authorization",
] as const;

export type GaGateId = (typeof GA_GATE_IDS)[number];

export type GaGateStatus = "PASS" | "OPEN" | "PARTIAL" | "PENDING" | "NOT_YET";

export type GaGate = {
  id: GaGateId;
  label: string;
  status: GaGateStatus;
  evidence: string;
  blocks_ga: boolean;
};

export type GaGateInput = Partial<Record<GaGateId, GaGateStatus>> & {
  open_critical_feedback?: number;
  open_critical_risks?: number;
  dr_drill_rows?: number;
  pitr_rows?: number;
};

export type GaReadinessEvaluation = {
  cert_id: string;
  package_version: string;
  generated_at: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  gates: GaGate[];
  pass_count: number;
  open_count: number;
  recommendation: string;
  notes: string[];
};

const GATE_META: Record<
  GaGateId,
  { label: string; defaultStatus: GaGateStatus; evidence: string }
> = {
  dr_drill_completed: {
    label: "Disaster Recovery drill completed",
    defaultStatus: "OPEN",
    evidence: "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md",
  },
  pitr_validated: {
    label: "Point-in-Time Recovery validated",
    defaultStatus: "OPEN",
    evidence: "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md",
  },
  production_infrastructure_verified: {
    label: "Production infrastructure verified",
    defaultStatus: "PARTIAL",
    evidence: "docs/cidp/monitoring/ · Stage 12 PRODUCTION_READINESS",
  },
  security_residuals_closed: {
    label: "Security residuals closed",
    defaultStatus: "PARTIAL",
    evidence: "docs/cidp/evidence/security/SECURITY_EVIDENCE_LOG.md",
  },
  no_unresolved_critical_findings: {
    label: "No unresolved Critical findings",
    defaultStatus: "PENDING",
    evidence: "institutional_feedback + risk register",
  },
  stable_pilot_metrics: {
    label: "Stable pilot metrics",
    defaultStatus: "PENDING",
    evidence: "CIDP success metrics + pilot portfolio",
  },
  acceptable_educational_outcomes: {
    label: "Acceptable educational outcomes",
    defaultStatus: "PENDING",
    evidence: "docs/cidp/evidence/education/",
  },
  clinical_validation_completed: {
    label: "Clinical validation completed",
    defaultStatus: "PENDING",
    evidence: "docs/cidp/evidence/clinical/ · Stage 8 observational",
  },
  governance_package_approved: {
    label: "Governance package approved",
    defaultStatus: "PASS",
    evidence: "docs/cidp/evidence/governance/GOVERNANCE_ATTESTATIONS.md",
  },
  executive_release_board_authorization: {
    label: "Executive Release Board authorization",
    defaultStatus: "NOT_YET",
    evidence: "docs/RELEASE_DECISION_LOG.md (future GA row)",
  },
};

export function evaluateGaReadiness(
  input: GaGateInput = {},
): GaReadinessEvaluation {
  const gates: GaGate[] = GA_GATE_IDS.map((id) => {
    let status = input[id] ?? GATE_META[id].defaultStatus;

    if (id === "dr_drill_completed" && (input.dr_drill_rows ?? 0) > 0) {
      status = "PASS";
    }
    if (id === "pitr_validated" && (input.pitr_rows ?? 0) > 0) {
      status = "PASS";
    }
    if (id === "no_unresolved_critical_findings") {
      const critical =
        (input.open_critical_feedback ?? 0) + (input.open_critical_risks ?? 0);
      status = critical === 0 ? "PASS" : "OPEN";
    }

    return {
      id,
      label: GATE_META[id].label,
      status,
      evidence: GATE_META[id].evidence,
      blocks_ga: status !== "PASS",
    };
  });

  const pass_count = gates.filter((g) => g.status === "PASS").length;
  const open_count = gates.length - pass_count;
  const allPass = open_count === 0;
  const ga_status = allPass ? "GO" : "NO-GO";

  return {
    cert_id: PHASE14_CERT_ID,
    package_version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    cidp_status: "GO",
    ga_status,
    gates,
    pass_count,
    open_count,
    recommendation: allPass
      ? "All GA gates PASS — Release Board may authorize v1.0.0 via RDL."
      : "Remain on Controlled Institutional Deployment (1.0.0-rc.1). GO for CIDP. NO-GO for GA.",
    notes: [
      "Competency scores remain unvalidated — never claim scientific validation at GA without separate Board unlock.",
      "PHI-free evidence only; fictional standardized patients.",
      "Phase 14 does not modify Clinical Core, patient cognition, or ownership boundaries.",
    ],
  };
}
