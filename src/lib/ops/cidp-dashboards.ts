/**
 * Controlled Institutional Deployment (CIDP) operational dashboards.
 *
 * Aggregates observational KPIs for System · Clinical · Institution ·
 * Research · Security · Executive views. Never includes patient-identifiable
 * content or session_reports narrative.
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
  /** Clinical (simulation lifecycle — not patient PHI) */
  simulations_completed?: number;
  simulations_abandoned?: number;
  assessments_completed?: number;
  supervisor_completed?: number;
  validation_completed?: number;
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
  /** Security */
  auth_failures?: number;
  rbac_violations?: number;
  rate_limit_hits?: number;
  audit_events?: number;
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
  const started = completed + abandoned;
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
    ],
  };

  const clinical: CidpDashboardPanel = {
    id: "clinical",
    title: "Clinical simulation (counts only)",
    metrics: [
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
    panels: [system, clinical, institution, research, security],
    executive,
  };
}
