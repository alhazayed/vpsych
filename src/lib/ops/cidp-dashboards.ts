/**
 * Controlled Institutional Deployment (CIDP) operational dashboards.
 *
 * Aggregates observational KPIs for System · Clinical · Educational ·
 * Institution · Research · Security · Feedback · Pilot · Executive views.
 * Never includes patient-identifiable content or session_reports narrative.
 */

import { PACKAGE_VERSION, STAGE12_CERT_ID } from "@/lib/ops/versions";

export const CIDP_CERT_ID = "VPSYCH-1.0-RC1-CIDP";

export type CidpMetric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  note?: string;
};

export type CidpDashboardPanel = {
  id: string;
  title: string;
  metrics: CidpMetric[];
};

export type CidpDashboardInput = {
  /** System */
  uptime_ratio?: number;
  api_latency_p50_ms?: number;
  api_latency_p95_ms?: number;
  sse_p95_ms?: number;
  voice_e2e_p95_ms?: number;
  queue_depth?: number;
  error_rate?: number;
  /** Clinical (simulation lifecycle — not patient PHI) */
  simulations_started?: number;
  simulations_completed?: number;
  simulations_abandoned?: number;
  assessments_completed?: number;
  supervisor_completed?: number;
  validation_completed?: number;
  /** Educational */
  curriculum_completion_rate?: number;
  certification_progress?: number;
  competency_growth?: number;
  resident_engagement?: number;
  /** Institution */
  active_residents?: number;
  active_faculty?: number;
  institutions?: number;
  departments?: number;
  campuses?: number;
  /** Research */
  datasets?: number;
  validation_runs?: number;
  inter_rater_agreement?: number;
  realism_score_mean?: number;
  publication_datasets?: number;
  /** Security */
  auth_failures?: number;
  rbac_violations?: number;
  rate_limit_hits?: number;
  audit_events?: number;
  security_alerts?: number;
  /** Feedback */
  feedback_total?: number;
  feedback_open_critical?: number;
  feedback_open_high?: number;
  feedback_resolved?: number;
  /** Pilot */
  pilots_active?: number;
  pilots_planned?: number;
  support_requests?: number;
  /** Executive */
  dau?: number;
  wau?: number;
  avg_session_duration_sec?: number;
  certification_rate?: number;
  supervisor_agreement?: number;
  learning_progress_mean?: number;
};

export type CidpDashboardBundle = {
  cert_id: string;
  package_version: string;
  stage12_cert_id: string;
  generated_at: string;
  phi_policy: string;
  panels: CidpDashboardPanel[];
  executive: CidpMetric[];
};

function pct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 1000) / 10;
}

function num(v: number | undefined, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function buildCidpDashboards(
  input: CidpDashboardInput = {},
): CidpDashboardBundle {
  const completed = num(input.simulations_completed);
  const abandoned = num(input.simulations_abandoned);
  const started = Math.max(
    num(input.simulations_started),
    completed + abandoned,
  );
  const completion_rate = started === 0 ? 0 : completed / started;

  const system: CidpDashboardPanel = {
    id: "system",
    title: "System",
    metrics: [
      {
        id: "uptime",
        label: "Uptime",
        value: pct(num(input.uptime_ratio, 1)),
        unit: "%",
      },
      {
        id: "api_p50",
        label: "API latency p50",
        value: num(input.api_latency_p50_ms),
        unit: "ms",
      },
      {
        id: "api_p95",
        label: "API latency p95",
        value: num(input.api_latency_p95_ms),
        unit: "ms",
      },
      {
        id: "sse_p95",
        label: "SSE p95",
        value: num(input.sse_p95_ms),
        unit: "ms",
      },
      {
        id: "voice_p95",
        label: "Voice E2E p95",
        value: num(input.voice_e2e_p95_ms),
        unit: "ms",
      },
      {
        id: "queue_depth",
        label: "Queue depth",
        value: num(input.queue_depth),
      },
      {
        id: "error_rate",
        label: "Error rate",
        value: pct(num(input.error_rate)),
        unit: "%",
      },
    ],
  };

  const clinical: CidpDashboardPanel = {
    id: "clinical",
    title: "Clinical simulation (counts only)",
    metrics: [
      {
        id: "sim_started",
        label: "Simulations started",
        value: started,
      },
      {
        id: "sim_completed",
        label: "Completed simulations",
        value: completed,
      },
      {
        id: "sim_abandoned",
        label: "Abandoned simulations",
        value: abandoned,
      },
      {
        id: "assessment_done",
        label: "Assessment completion",
        value: num(input.assessments_completed),
      },
      {
        id: "supervisor_done",
        label: "Supervisor completion",
        value: num(input.supervisor_completed),
      },
      {
        id: "validation_done",
        label: "Validation completion",
        value: num(input.validation_completed),
      },
      {
        id: "completion_rate",
        label: "Simulation completion rate",
        value: pct(completion_rate),
        unit: "%",
      },
    ],
  };

  const educational: CidpDashboardPanel = {
    id: "educational",
    title: "Educational",
    metrics: [
      {
        id: "curriculum_completion",
        label: "Curriculum completion",
        value: pct(num(input.curriculum_completion_rate)),
        unit: "%",
        note: "Formative",
      },
      {
        id: "certification_progress",
        label: "Certification progress",
        value: pct(num(input.certification_progress)),
        unit: "%",
      },
      {
        id: "competency_growth",
        label: "Competency growth",
        value: pct(num(input.competency_growth)),
        unit: "%",
        note: "Not a validated instrument",
      },
      {
        id: "resident_engagement",
        label: "Resident engagement",
        value: pct(num(input.resident_engagement)),
        unit: "%",
      },
    ],
  };

  const institution: CidpDashboardPanel = {
    id: "institution",
    title: "Institution",
    metrics: [
      {
        id: "active_residents",
        label: "Active residents",
        value: num(input.active_residents),
      },
      {
        id: "active_faculty",
        label: "Active faculty",
        value: num(input.active_faculty),
      },
      {
        id: "institutions",
        label: "Institutions",
        value: num(input.institutions),
      },
      {
        id: "departments",
        label: "Departments",
        value: num(input.departments),
      },
      { id: "campuses", label: "Campuses", value: num(input.campuses) },
    ],
  };

  const research: CidpDashboardPanel = {
    id: "research",
    title: "Research",
    metrics: [
      { id: "datasets", label: "Datasets", value: num(input.datasets) },
      {
        id: "validation_runs",
        label: "Validation runs",
        value: num(input.validation_runs),
      },
      {
        id: "ira",
        label: "Inter-rater agreement",
        value: pct(num(input.inter_rater_agreement)),
        unit: "%",
        note: "Observational — not a published reliability coefficient",
      },
      {
        id: "realism",
        label: "Mean realism score",
        value: Math.round(num(input.realism_score_mean) * 10) / 10,
        note: "Formative observational index",
      },
      {
        id: "publication_datasets",
        label: "Publication datasets",
        value: num(input.publication_datasets),
      },
    ],
  };

  const security: CidpDashboardPanel = {
    id: "security",
    title: "Security",
    metrics: [
      {
        id: "auth_failures",
        label: "Authentication failures",
        value: num(input.auth_failures),
      },
      {
        id: "rbac_violations",
        label: "RBAC violations",
        value: num(input.rbac_violations),
      },
      {
        id: "rate_limits",
        label: "Rate-limit hits",
        value: num(input.rate_limit_hits),
      },
      {
        id: "audit_events",
        label: "Audit events",
        value: num(input.audit_events),
      },
      {
        id: "security_alerts",
        label: "Security alerts",
        value: num(input.security_alerts),
      },
    ],
  };

  const feedback: CidpDashboardPanel = {
    id: "feedback",
    title: "Feedback",
    metrics: [
      {
        id: "feedback_total",
        label: "Total feedback",
        value: num(input.feedback_total),
      },
      {
        id: "open_critical",
        label: "Open critical",
        value: num(input.feedback_open_critical),
      },
      {
        id: "open_high",
        label: "Open high",
        value: num(input.feedback_open_high),
      },
      {
        id: "resolved",
        label: "Resolved",
        value: num(input.feedback_resolved),
      },
    ],
  };

  const pilot: CidpDashboardPanel = {
    id: "pilot",
    title: "Pilot status",
    metrics: [
      {
        id: "pilots_active",
        label: "Active pilots",
        value: num(input.pilots_active),
      },
      {
        id: "pilots_planned",
        label: "Planned pilots",
        value: num(input.pilots_planned),
      },
      {
        id: "support_requests",
        label: "Support requests",
        value: num(input.support_requests),
      },
    ],
  };

  const executive: CidpMetric[] = [
    { id: "dau", label: "Daily active users", value: num(input.dau) },
    { id: "wau", label: "Weekly active users", value: num(input.wau) },
    {
      id: "completion_rate",
      label: "Simulation completion rate",
      value: pct(completion_rate),
      unit: "%",
    },
    {
      id: "avg_duration",
      label: "Average session duration",
      value: Math.round(num(input.avg_session_duration_sec)),
      unit: "s",
    },
    {
      id: "learning_progress",
      label: "Learning progress (mean formative)",
      value: Math.round(num(input.learning_progress_mean) * 10) / 10,
      note: "Not a validated clinical instrument",
    },
    {
      id: "cert_rate",
      label: "Certification rate",
      value: pct(num(input.certification_rate)),
      unit: "%",
    },
    {
      id: "supervisor_agreement",
      label: "Supervisor agreement",
      value: pct(num(input.supervisor_agreement)),
      unit: "%",
      note: "Educational observation only",
    },
    {
      id: "system_health",
      label: "System uptime",
      value: pct(num(input.uptime_ratio, 1)),
      unit: "%",
    },
  ];

  return {
    cert_id: CIDP_CERT_ID,
    package_version: PACKAGE_VERSION,
    stage12_cert_id: STAGE12_CERT_ID,
    generated_at: new Date().toISOString(),
    phi_policy:
      "No patient-identifiable information. Counts and formative aggregates only.",
    panels: [
      system,
      clinical,
      educational,
      institution,
      research,
      security,
      feedback,
      pilot,
    ],
    executive,
  };
}
