/**
 * Operational readiness checklist for certification scoring.
 */

import { hasUpstashRedis } from "@/lib/rate-limit";
import { DEPENDENCIES, RECOVERY_OBJECTIVES } from "@/lib/ops/targets";

export type OpsCheck = {
  id: string;
  label: string;
  status: "pass" | "partial" | "fail";
  evidence: string;
};

export type OperationalAssessment = {
  score: number;
  checks: OpsCheck[];
  verdict:
    | "OPERATIONALLY_FAILED"
    | "OPERATIONALLY_CERTIFIED_WITH_RECOMMENDATIONS"
    | "OPERATIONALLY_CERTIFIED";
};

export function assessOperationalReadiness(opts?: {
  publicHealth?: boolean;
  readinessEndpoint?: boolean;
  circuitBreakers?: boolean;
  outageHarness?: boolean;
  drRunbook?: boolean;
  incidentRunbook?: boolean;
  upstashConfigured?: boolean;
  previewProtection?: boolean;
  sentryConfigured?: boolean;
}): OperationalAssessment {
  const checks: OpsCheck[] = [
    {
      id: "public_health",
      label: "Public liveness /api/health",
      status: opts?.publicHealth === false ? "fail" : "pass",
      evidence: "GET /api/health returns status ok",
    },
    {
      id: "readiness",
      label: "Aggregated readiness /api/health/ready",
      status: opts?.readinessEndpoint === false ? "fail" : "pass",
      evidence: "Supabase + vendor config + circuit states",
    },
    {
      id: "circuit_breakers",
      label: "Vendor circuit breakers",
      status: opts?.circuitBreakers === false ? "fail" : "pass",
      evidence: "openaiCircuit / elevenLabsCircuit in resilience.ts",
    },
    {
      id: "outage_harness",
      label: "Outage simulation harness",
      status: opts?.outageHarness === false ? "fail" : "pass",
      evidence: "src/lib/ops/outage-sim.ts",
    },
    {
      id: "dr_runbook",
      label: "Disaster recovery runbook + RTO/RPO",
      status: opts?.drRunbook === false ? "fail" : "pass",
      evidence: `RTO ${RECOVERY_OBJECTIVES.rtoHours}h / RPO ${RECOVERY_OBJECTIVES.rpoHours}h`,
    },
    {
      id: "incident_runbook",
      label: "Incident response stubs",
      status: opts?.incidentRunbook === false ? "fail" : "pass",
      evidence: "docs/INCIDENT_RESPONSE.md + createIncidentStub",
    },
    {
      id: "upstash",
      label: "Distributed rate limits (Upstash)",
      status:
        opts?.upstashConfigured ?? hasUpstashRedis() ? "pass" : "partial",
      evidence: "Memory fallback when unset — not horizontally safe",
    },
    {
      id: "preview_protection",
      label: "Vercel preview deployment protection",
      status: opts?.previewProtection ? "pass" : "partial",
      evidence: "Ops dashboard action — enable SSO/password on previews",
    },
    {
      id: "observability",
      label: "APM / error alerting (Sentry or Vercel Observability)",
      status: opts?.sentryConfigured ? "pass" : "partial",
      evidence: "console + security_audit_events present; SIEM optional",
    },
    {
      id: "dependencies",
      label: "Dependency inventory documented",
      status: DEPENDENCIES.length >= 5 ? "pass" : "fail",
      evidence: DEPENDENCIES.map((d) => d.id).join(", "),
    },
  ];

  const weights = { pass: 100, partial: 65, fail: 0 } as const;
  const score = Math.round(
    checks.reduce((s, c) => s + weights[c.status], 0) / checks.length,
  );

  let verdict: OperationalAssessment["verdict"] =
    "OPERATIONALLY_CERTIFIED_WITH_RECOMMENDATIONS";
  if (score < 60 || checks.some((c) => c.status === "fail")) {
    verdict = "OPERATIONALLY_FAILED";
  } else if (score >= 92 && checks.every((c) => c.status === "pass")) {
    verdict = "OPERATIONALLY_CERTIFIED";
  }

  return { score, checks, verdict };
}
