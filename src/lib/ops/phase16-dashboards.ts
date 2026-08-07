/**
 * Phase 16 — Domain evidence dashboards.
 * Metrics without observations are Evidence Pending — never zero-filled fiction.
 */

import {
  EVIDENCE_PENDING,
  observedNumberOrPending,
  type EvidenceValue,
} from "@/lib/ops/phase16-evidence-state";

export type DomainDashboardId =
  | "executive"
  | "clinical"
  | "education"
  | "research"
  | "security"
  | "operations"
  | "pilot"
  | "ga_readiness";

export type DomainDashboard = {
  id: DomainDashboardId;
  title: string;
  generated_at: string;
  metrics: EvidenceValue[];
  overall_state: "OBSERVED" | "MIXED" | "EVIDENCE_PENDING";
  notes: string[];
};

export type Phase16DashboardInput = {
  /** Platform counts that were actually queried (optional). */
  institutions_count?: number;
  sessions_completed?: number;
  sessions_started?: number;
  sessions_active?: number;
  feedback_open_critical?: number;
  audit_events?: number;
  auth_failures?: number;
  api_latency_p95_ms?: number;
  uptime_ratio?: number;
  error_rate?: number;
  npm_audit_high_vulns?: number;
  /** Explicitly observed research/clinical indices — omit ⇒ pending */
  clinical_realism?: number;
  dsm_consistency?: number;
  icd_consistency?: number;
  supervisor_agreement?: number;
  inter_rater_reliability?: number;
  educational_progression?: number;
  competency_improvement?: number;
  faculty_engagement?: number;
  resident_engagement?: number;
  learning_completion?: number;
  certification_completion?: number;
  learning_satisfaction?: number;
  knowledge_retention?: number;
  skill_progression?: number;
  /** Evidence log row counts (0 means pending for drill evidence) */
  dr_drill_rows?: number;
  pitr_rows?: number;
  pen_test_rows?: number;
  secret_rotation_rows?: number;
  backup_status_observed?: boolean;
  restore_readiness_observed?: boolean;
};

function overall(metrics: EvidenceValue[]): DomainDashboard["overall_state"] {
  const observed = metrics.filter((m) => m.state === "OBSERVED").length;
  if (observed === 0) return "EVIDENCE_PENDING";
  if (observed === metrics.length) return "OBSERVED";
  return "MIXED";
}

function panel(
  id: DomainDashboardId,
  title: string,
  metrics: EvidenceValue[],
  notes: string[],
): DomainDashboard {
  return {
    id,
    title,
    generated_at: new Date().toISOString(),
    metrics,
    overall_state: overall(metrics),
    notes: [...notes, "No PHI. Never fabricate missing observations."],
  };
}

export function buildClinicalEvidenceDashboard(
  input: Phase16DashboardInput = {},
): DomainDashboard {
  return panel(
    "clinical",
    "Clinical Evidence",
    [
      observedNumberOrPending("Clinical realism", input.clinical_realism, {
        unit: "%",
      }),
      observedNumberOrPending("DSM consistency", input.dsm_consistency, {
        unit: "%",
      }),
      observedNumberOrPending("ICD consistency", input.icd_consistency, {
        unit: "%",
      }),
      observedNumberOrPending(
        "Supervisor agreement",
        input.supervisor_agreement,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Inter-rater reliability",
        input.inter_rater_reliability,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Educational progression",
        input.educational_progression,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Competency improvement",
        input.competency_improvement,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Simulations completed (lifecycle)",
        input.sessions_completed,
        { source: "sessions.status=completed" },
      ),
    ],
    [
      "Clinical safety / simulation stability require observed pilot instrumentation.",
      "Competency improvement is formative — not a validated instrument.",
    ],
  );
}

export function buildEducationEvidenceDashboard(
  input: Phase16DashboardInput = {},
): DomainDashboard {
  return panel(
    "education",
    "Educational Evidence",
    [
      observedNumberOrPending("Faculty engagement", input.faculty_engagement, {
        unit: "%",
      }),
      observedNumberOrPending(
        "Resident engagement",
        input.resident_engagement,
        { unit: "%" },
      ),
      observedNumberOrPending("Learning completion", input.learning_completion, {
        unit: "%",
      }),
      observedNumberOrPending(
        "Certification completion",
        input.certification_completion,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Competency growth",
        input.competency_improvement,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Session frequency (completed)",
        input.sessions_completed,
      ),
      observedNumberOrPending(
        "Learning satisfaction",
        input.learning_satisfaction,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Knowledge retention",
        input.knowledge_retention,
        { unit: "%" },
      ),
      observedNumberOrPending("Skill progression", input.skill_progression, {
        unit: "%",
      }),
    ],
    ["Survey and progression metrics remain Evidence Pending until collected."],
  );
}

export function buildResearchEvidenceDashboard(
  input: Phase16DashboardInput = {},
): DomainDashboard {
  return panel(
    "research",
    "Research Evidence",
    [
      observedNumberOrPending(
        "Participating institutions",
        input.institutions_count,
      ),
      observedNumberOrPending("Clinical realism statistics", input.clinical_realism, {
        unit: "%",
      }),
      observedNumberOrPending(
        "Supervisor agreement",
        input.supervisor_agreement,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Inter-rater reliability",
        input.inter_rater_reliability,
        { unit: "%" },
      ),
      observedNumberOrPending(
        "Simulation utilization (completed)",
        input.sessions_completed,
      ),
      observedNumberOrPending(
        "Educational outcomes index",
        input.educational_progression,
        { unit: "%" },
      ),
    ],
    [
      "Publication-quality packs require de-identified exports — not fabricated N.",
      EVIDENCE_PENDING + " for psychometric summaries until Stage 8 runs are sealed.",
    ],
  );
}

export function buildSecurityEvidenceDashboard(
  input: Phase16DashboardInput = {},
): DomainDashboard {
  const npm =
    input.npm_audit_high_vulns === undefined
      ? observedNumberOrPending("Dependency high+ vulnerabilities", undefined)
      : observedNumberOrPending(
          "Dependency high+ vulnerabilities",
          input.npm_audit_high_vulns,
          { source: "npm audit" },
        );

  return panel(
    "security",
    "Security Evidence",
    [
      npm,
      observedNumberOrPending("Audit log events", input.audit_events),
      observedNumberOrPending("Authentication failures", input.auth_failures),
      observedNumberOrPending(
        "Open critical feedback",
        input.feedback_open_critical,
      ),
      input.pen_test_rows && input.pen_test_rows > 0
        ? observedNumberOrPending("Penetration test evidence rows", input.pen_test_rows)
        : observedNumberOrPending("Penetration test evidence rows", undefined, {
            note: EVIDENCE_PENDING,
          }),
      input.secret_rotation_rows && input.secret_rotation_rows > 0
        ? observedNumberOrPending(
            "Secret rotation evidence rows",
            input.secret_rotation_rows,
          )
        : observedNumberOrPending("Secret rotation evidence rows", undefined, {
            note: EVIDENCE_PENDING,
          }),
    ],
    ["Security incidents / suspicious activity: append-only evidence logs only."],
  );
}

export function buildOperationsEvidenceDashboard(
  input: Phase16DashboardInput = {},
): DomainDashboard {
  return panel(
    "operations",
    "Operations Evidence",
    [
      observedNumberOrPending("Uptime ratio", input.uptime_ratio, {
        unit: "",
        note: input.uptime_ratio === undefined ? EVIDENCE_PENDING : "proxy from health",
      }),
      observedNumberOrPending("API latency p95", input.api_latency_p95_ms, {
        unit: "ms",
      }),
      observedNumberOrPending("Error rate", input.error_rate),
      observedNumberOrPending("Active sessions", input.sessions_active),
      input.dr_drill_rows && input.dr_drill_rows > 0
        ? observedNumberOrPending("DR drill evidence rows", input.dr_drill_rows)
        : observedNumberOrPending("DR drill evidence rows", undefined),
      input.pitr_rows && input.pitr_rows > 0
        ? observedNumberOrPending("PITR evidence rows", input.pitr_rows)
        : observedNumberOrPending("PITR evidence rows", undefined),
      input.backup_status_observed
        ? observedNumberOrPending("Backup status observed", 1)
        : observedNumberOrPending("Backup status", undefined, {
            note: EVIDENCE_PENDING,
          }),
      input.restore_readiness_observed
        ? observedNumberOrPending("Restore readiness observed", 1)
        : observedNumberOrPending("Restore readiness", undefined, {
            note: EVIDENCE_PENDING,
          }),
    ],
    [
      "Voice/avatar/streaming latency require observed telemetry — Evidence Pending if unset.",
      "No automatic remediation — monitoring and reporting only.",
    ],
  );
}

export function buildExecutiveEvidenceDashboard(
  input: Phase16DashboardInput = {},
): DomainDashboard {
  return panel(
    "executive",
    "Executive Dashboard",
    [
      observedNumberOrPending("Institutions", input.institutions_count),
      observedNumberOrPending("Simulations completed", input.sessions_completed),
      observedNumberOrPending("Simulations started", input.sessions_started),
      observedNumberOrPending(
        "Open critical issues (feedback)",
        input.feedback_open_critical,
      ),
      observedNumberOrPending("API latency p95", input.api_latency_p95_ms, {
        unit: "ms",
      }),
    ],
    ["Executive view mixes only observed platform counts; surveys stay pending."],
  );
}

export type Phase16DashboardBundle = {
  generated_at: string;
  phi_policy: string;
  fabrication_policy: string;
  dashboards: DomainDashboard[];
};

export function buildPhase16Dashboards(
  input: Phase16DashboardInput = {},
): Phase16DashboardBundle {
  return {
    generated_at: new Date().toISOString(),
    phi_policy: "PHI-free aggregates only. Fictional standardized patients.",
    fabrication_policy:
      "Never fabricate pilot, clinical, DR, PITR, pen-test, feedback, or outcome evidence. Missing ⇒ Evidence Pending.",
    dashboards: [
      buildExecutiveEvidenceDashboard(input),
      buildClinicalEvidenceDashboard(input),
      buildEducationEvidenceDashboard(input),
      buildResearchEvidenceDashboard(input),
      buildSecurityEvidenceDashboard(input),
      buildOperationsEvidenceDashboard(input),
    ],
  };
}
