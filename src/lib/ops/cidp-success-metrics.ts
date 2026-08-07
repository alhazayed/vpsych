/**
 * CIDP success metrics — aggregated, PHI-free.
 */

export type CidpSuccessMetricsInput = {
  pilots_total?: number;
  pilots_deployed_ok?: number;
  uptime_ratio?: number;
  api_latency_p95_ms?: number;
  simulations_started?: number;
  simulations_completed?: number;
  resident_satisfaction?: number;
  faculty_satisfaction?: number;
  supervisor_agreement?: number;
  assessment_consistency?: number;
  validation_consistency?: number;
  error_rate?: number;
  research_exports?: number;
  institutions?: number;
};

export type CidpSuccessMetric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  target?: string;
};

export type CidpSuccessMetricsBundle = {
  generated_at: string;
  metrics: CidpSuccessMetric[];
  overall_health: "green" | "amber" | "red";
  notes: string[];
};

export function buildCidpSuccessMetrics(
  input: CidpSuccessMetricsInput = {},
): CidpSuccessMetricsBundle {
  const started = num(input.simulations_started);
  const completed = num(input.simulations_completed);
  const completion =
    started === 0 ? 0 : Math.min(1, completed / Math.max(1, started));
  const deployOk = num(input.pilots_deployed_ok);
  const deployTotal = Math.max(1, num(input.pilots_total, 1));
  const deployRate = Math.min(1, deployOk / deployTotal);
  const uptime = clamp01(num(input.uptime_ratio, 1));
  const errorRate = clamp01(num(input.error_rate));
  const p95 = num(input.api_latency_p95_ms);

  const metrics: CidpSuccessMetric[] = [
    {
      id: "deployment_success_rate",
      label: "Deployment success rate",
      value: pct(deployRate),
      unit: "%",
      target: "≥95%",
    },
    {
      id: "system_availability",
      label: "System availability",
      value: pct(uptime),
      unit: "%",
      target: "≥99%",
    },
    {
      id: "avg_response_time",
      label: "Average API response (p95)",
      value: p95,
      unit: "ms",
      target: "≤3000ms",
    },
    {
      id: "simulation_completion_rate",
      label: "Simulation completion rate",
      value: pct(completion),
      unit: "%",
      target: "≥70%",
    },
    {
      id: "resident_satisfaction",
      label: "Resident satisfaction",
      value: pct(clamp01(num(input.resident_satisfaction))),
      unit: "%",
      target: "Survey-based",
    },
    {
      id: "faculty_satisfaction",
      label: "Faculty satisfaction",
      value: pct(clamp01(num(input.faculty_satisfaction))),
      unit: "%",
      target: "Survey-based",
    },
    {
      id: "supervisor_agreement",
      label: "Supervisor agreement",
      value: pct(clamp01(num(input.supervisor_agreement))),
      unit: "%",
      target: "Observational",
    },
    {
      id: "assessment_consistency",
      label: "Assessment consistency",
      value: pct(clamp01(num(input.assessment_consistency))),
      unit: "%",
      target: "Observational — not validated",
    },
    {
      id: "validation_consistency",
      label: "Validation consistency",
      value: pct(clamp01(num(input.validation_consistency))),
      unit: "%",
      target: "Observational",
    },
    {
      id: "operational_stability",
      label: "Operational stability (1 − error rate)",
      value: pct(1 - errorRate),
      unit: "%",
      target: "≥95%",
    },
    {
      id: "research_utilization",
      label: "Research utilization (exports)",
      value: num(input.research_exports),
      target: "Protocol-driven",
    },
  ];

  let overall_health: CidpSuccessMetricsBundle["overall_health"] = "green";
  if (uptime < 0.99 || errorRate > 0.05 || p95 > 5000) overall_health = "amber";
  if (uptime < 0.95 || errorRate > 0.15 || p95 > 15000) overall_health = "red";

  return {
    generated_at: new Date().toISOString(),
    metrics,
    overall_health,
    notes: [
      "Aggregated counts and formative ratios only — no PHI.",
      "Competency / assessment consistency metrics are observational, not validated clinical instruments.",
    ],
  };
}

function num(v: number | undefined, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function pct(n: number): number {
  return Math.round(clamp01(n) * 1000) / 10;
}
