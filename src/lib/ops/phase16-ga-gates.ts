/**
 * Phase 16 — GA gate evaluation for pilot execution.
 * Unmet gates show Evidence Pending / OPEN — never auto-pass without rows.
 */

import { EVIDENCE_PENDING } from "@/lib/ops/phase16-evidence-state";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

export const PHASE16_CERT_ID = "VPSYCH-1.0-RC1-PHASE16";

export const PHASE16_GA_GATES = [
  "dr_drill_completed",
  "pitr_verified",
  "penetration_test_completed",
  "security_residuals_closed",
  "pilot_objectives_achieved",
  "critical_issues_zero",
  "clinical_validation_complete",
  "educational_validation_complete",
  "research_validation_complete",
  "release_board_approval_signed",
] as const;

export type Phase16GaGateId = (typeof PHASE16_GA_GATES)[number];

export type Phase16GaGateStatus =
  | "PASS"
  | "OPEN"
  | "EVIDENCE_PENDING"
  | "FAIL";

export type Phase16GaGate = {
  id: Phase16GaGateId;
  label: string;
  status: Phase16GaGateStatus;
  evidence: string;
  detail: string;
  blocks_ga: boolean;
};

export type Phase16GaGateInput = {
  dr_drill_rows?: number;
  pitr_rows?: number;
  pen_test_rows?: number;
  security_residuals_closed?: boolean;
  pilot_objectives_achieved?: boolean;
  open_critical_feedback?: number;
  open_critical_risks?: number;
  clinical_validation_complete?: boolean;
  educational_validation_complete?: boolean;
  research_validation_complete?: boolean;
  release_board_approval_signed?: boolean;
};

export type Phase16GaEvaluation = {
  cert_id: string;
  package_version: string;
  generated_at: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  authorized_version: "1.0.0" | null;
  gates: Phase16GaGate[];
  pass_count: number;
  unmet: Phase16GaGate[];
  decision: string;
  release_package: null | {
    version: "1.0.0";
    tag: "v1.0.0";
    actions: string[];
  };
  notes: string[];
};

const LABELS: Record<Phase16GaGateId, string> = {
  dr_drill_completed: "DR Drill Completed",
  pitr_verified: "PITR Verified",
  penetration_test_completed: "Penetration Test Completed",
  security_residuals_closed: "Security Residuals Closed",
  pilot_objectives_achieved: "Pilot Objectives Achieved",
  critical_issues_zero: "Critical Issues = 0",
  clinical_validation_complete: "Clinical Validation Complete",
  educational_validation_complete: "Educational Validation Complete",
  research_validation_complete: "Research Validation Complete",
  release_board_approval_signed: "Release Board Approval Signed",
};

export function evaluatePhase16GaGates(
  input: Phase16GaGateInput = {},
): Phase16GaEvaluation {
  const feedbackObserved = input.open_critical_feedback !== undefined;
  const risksObserved = input.open_critical_risks !== undefined;
  const critical =
    (input.open_critical_feedback ?? 0) + (input.open_critical_risks ?? 0);
  const criticalStatus: Phase16GaGateStatus =
    !feedbackObserved && !risksObserved
      ? "EVIDENCE_PENDING"
      : critical === 0
        ? "PASS"
        : "OPEN";

  const gates: Phase16GaGate[] = [
    gate(
      "dr_drill_completed",
      (input.dr_drill_rows ?? 0) > 0 ? "PASS" : "EVIDENCE_PENDING",
      "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md",
      (input.dr_drill_rows ?? 0) > 0
        ? `${input.dr_drill_rows} signed drill row(s)`
        : EVIDENCE_PENDING,
    ),
    gate(
      "pitr_verified",
      (input.pitr_rows ?? 0) > 0 ? "PASS" : "EVIDENCE_PENDING",
      "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md",
      (input.pitr_rows ?? 0) > 0
        ? `${input.pitr_rows} PITR row(s)`
        : EVIDENCE_PENDING,
    ),
    gate(
      "penetration_test_completed",
      (input.pen_test_rows ?? 0) > 0 ? "PASS" : "EVIDENCE_PENDING",
      "docs/cidp/evidence/security/",
      (input.pen_test_rows ?? 0) > 0
        ? `${input.pen_test_rows} pen-test evidence row(s)`
        : EVIDENCE_PENDING,
    ),
    gate(
      "security_residuals_closed",
      input.security_residuals_closed === true ? "PASS" : "EVIDENCE_PENDING",
      "docs/stage15/SECURITY_CERTIFICATION_REPORT.md",
      input.security_residuals_closed === true
        ? "Residuals closed"
        : EVIDENCE_PENDING,
    ),
    gate(
      "pilot_objectives_achieved",
      input.pilot_objectives_achieved === true ? "PASS" : "EVIDENCE_PENDING",
      "Institutional pilot registry / Phase 16 dashboard",
      input.pilot_objectives_achieved === true
        ? "Objectives met from observed pilots"
        : EVIDENCE_PENDING,
    ),
    gate(
      "critical_issues_zero",
      criticalStatus,
      "institutional_feedback + risk register",
      criticalStatus === "EVIDENCE_PENDING"
        ? EVIDENCE_PENDING
        : critical === 0
          ? "Zero open critical feedback/risks (observed)"
          : `${critical} critical item(s) open`,
    ),
    gate(
      "clinical_validation_complete",
      input.clinical_validation_complete === true
        ? "PASS"
        : "EVIDENCE_PENDING",
      "docs/stage15/CLINICAL_VALIDATION_REPORT.md",
      input.clinical_validation_complete === true
        ? "Board-closed clinical validation"
        : EVIDENCE_PENDING,
    ),
    gate(
      "educational_validation_complete",
      input.educational_validation_complete === true
        ? "PASS"
        : "EVIDENCE_PENDING",
      "docs/stage15/EDUCATIONAL_VALIDATION_REPORT.md",
      input.educational_validation_complete === true
        ? "Board-closed educational validation"
        : EVIDENCE_PENDING,
    ),
    gate(
      "research_validation_complete",
      input.research_validation_complete === true
        ? "PASS"
        : "EVIDENCE_PENDING",
      "docs/stage15/RESEARCH_VALIDATION_REPORT.md",
      input.research_validation_complete === true
        ? "Board-closed research validation"
        : EVIDENCE_PENDING,
    ),
    gate(
      "release_board_approval_signed",
      input.release_board_approval_signed === true
        ? "PASS"
        : "EVIDENCE_PENDING",
      "docs/RELEASE_DECISION_LOG.md",
      input.release_board_approval_signed === true
        ? "Signed GA RDL present"
        : EVIDENCE_PENDING,
    ),
  ];

  const pass_count = gates.filter((g) => g.status === "PASS").length;
  const unmet = gates.filter((g) => g.status !== "PASS");
  const allPass = unmet.length === 0;
  const ga_status = allPass ? "GO" : "NO-GO";

  return {
    cert_id: PHASE16_CERT_ID,
    package_version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    cidp_status: "GO",
    ga_status,
    authorized_version: allPass ? "1.0.0" : null,
    gates,
    pass_count,
    unmet,
    decision: allPass
      ? "GO FOR GENERAL AVAILABILITY"
      : "Remain Controlled Institutional Deployment (1.0.0-rc.1). Never recommend GA without verified operational evidence.",
    release_package: allPass
      ? {
          version: "1.0.0",
          tag: "v1.0.0",
          actions: [
            "Generate Version 1.0.0 Release Package",
            "Executive Authorization",
            "Release Board Approval",
            "GA Release Notes",
            "Production Announcement",
            "Tag v1.0.0",
          ],
        }
      : null,
    notes: [
      "Phase 16 does not modify Clinical Core, patient cognition, Supervisor AI, or scientific validation.",
      "Missing evidence is reported as Evidence Pending — never simulated.",
      ...unmet.map((g) => `Unmet: ${g.label} — ${g.detail}`),
    ],
  };
}

function gate(
  id: Phase16GaGateId,
  status: Phase16GaGateStatus,
  evidence: string,
  detail: string,
): Phase16GaGate {
  return {
    id,
    label: LABELS[id],
    status,
    evidence,
    detail,
    blocks_ga: status !== "PASS",
  };
}
