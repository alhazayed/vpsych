/**
 * Production operational dashboards (GA).
 * Composes telemetry + enterprise/realtime/feedback façades.
 */

import { validateProductionEnv } from "@/lib/env";
import { hasUpstashRedis } from "@/lib/rate-limit";
import {
  buildObservabilitySnapshot,
  buildSecurityDashboard,
  defaultAuthPolicy,
} from "@/lib/enterprise";
import { buildRealtimeDashboard, realtimeMetrics } from "@/lib/realtime";
import { feedbackSummary } from "@/lib/feedback";
import { buildProductionOpsSnapshot } from "./metrics";
import { telemetrySummary } from "./telemetry";
import { GA_PROGRAM_ID, PACKAGE_VERSION, STAGE12_CERT_ID } from "./versions";

export type DashboardName =
  | "platform_health"
  | "deployment_health"
  | "institution_health"
  | "research"
  | "education"
  | "supervisor"
  | "realtime"
  | "security"
  | "performance"
  | "audit";

export function buildGaDashboards() {
  const env = validateProductionEnv();
  const tele = telemetrySummary();
  const ops = buildProductionOpsSnapshot();
  const fb = feedbackSummary();
  const enterprise = buildObservabilitySnapshot({
    latencies_ms: [
      tele.api_latency_avg_ms ?? 100,
      tele.api_latency_p95_ms ?? 200,
    ].filter((n): n is number => n != null),
    failures: tele.error_count,
    requests: Math.max(1, tele.samples),
    active_sessions: Math.max(0, tele.session_starts - tele.session_ends),
    queue_depth: tele.queue_length,
  });

  const platform_health = {
    name: "platform_health" as const,
    status: env.ok && tele.error_rate < 0.05 ? "ok" : "degraded",
    version: PACKAGE_VERSION,
    cert_id: STAGE12_CERT_ID,
    program_id: GA_PROGRAM_ID,
    liveness: ops.health,
    enterprise_health: enterprise.health,
    upstash: hasUpstashRedis(),
  };

  const deployment_health = {
    name: "deployment_health" as const,
    package_version: PACKAGE_VERSION,
    env_ok: env.ok,
    missing_required: env.missingRequired,
    missing_recommended: env.missingRecommended,
    rate_limit_backend: hasUpstashRedis() ? "upstash" : "memory",
  };

  const institution_health = {
    name: "institution_health" as const,
    tenant_count: tele.tenant_count,
    active_sessions_estimate: Math.max(
      0,
      tele.session_starts - tele.session_ends,
    ),
    completion_rate: tele.completion_rate,
    drop_rate: tele.drop_rate,
    feedback: fb,
  };

  const research = {
    name: "research" as const,
    note: "Observational only — scores unvalidated; criterion validity deferred",
    inter_rater: "store_ready",
    dsm_icd_consistency: "catalog_present",
    expert_agreement: "collect_via_feedback",
    case_realism_feedback: fb.byCategory.clinical_realism ?? 0,
    outcome_stability: "monitor_via_quality_ledger",
  };

  const education = {
    name: "education" as const,
    note: "Education never writes patient mind",
    feedback_educational: fb.byCategory.educational_value ?? 0,
    curriculum_completion: "ace_tables",
    certification_success: "enterprise_certs",
  };

  const supervisor = {
    name: "supervisor" as const,
    note: "Therapist-only supervision; never patient cognition",
    feedback_supervisor_tools: fb.byCategory.supervisor_tools ?? 0,
    agreement_collection: "validation_inter_rater + faculty feedback",
  };

  const realtime = {
    name: "realtime" as const,
    adapter_only: true,
    metrics: realtimeMetrics.summary(),
    dashboard: buildRealtimeDashboard({}),
    latency_avg_ms: tele.realtime_avg_ms,
    avatar_avg_ms: tele.avatar_avg_ms,
    reconnects: tele.reconnects,
  };

  const security = {
    name: "security" as const,
    dashboard: buildSecurityDashboard({
      organization_id: "platform",
      policy: defaultAuthPolicy("platform"),
      audits: [],
      isolation_ok: true,
    }),
    feedback_security: fb.byCategory.security_privacy ?? 0,
    critical_feedback: fb.critical,
    high_feedback: fb.high,
  };

  const performance = {
    name: "performance" as const,
    telemetry: tele,
    budgets: ops.latency_budgets,
  };

  const audit = {
    name: "audit" as const,
    note: "security_audit_events + enterprise_audit_events + institutional_feedback",
    feedback_total: fb.total,
    failure_reasons: tele.failure_reasons,
  };

  return {
    generated_at: new Date().toISOString(),
    program_id: GA_PROGRAM_ID,
    dashboards: {
      platform_health,
      deployment_health,
      institution_health,
      research,
      education,
      supervisor,
      realtime,
      security,
      performance,
      audit,
    },
  };
}
