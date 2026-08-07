/**
 * Enterprise observability — Stage 10.
 * Health · latency · failures · usage · cost · scaling hints.
 * Complements docs/runtime/OBSERVABILITY.md without replacing runtime tracing debt.
 */

import type { ObservabilitySnapshot } from "@/lib/enterprise/types";

export type ObservabilitySample = {
  latencies_ms?: number[];
  failures?: number;
  requests?: number;
  active_sessions?: number;
  queue_depth?: number;
  cost_events_usd?: number[];
};

export function buildObservabilitySnapshot(
  sample: ObservabilitySample = {},
): ObservabilitySnapshot {
  const latencies = [...(sample.latencies_ms ?? [])].sort((a, b) => a - b);
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const requests = Math.max(1, sample.requests ?? (latencies.length || 1));
  const failures = sample.failures ?? 0;
  const failure_rate = failures / requests;
  const active_sessions = sample.active_sessions ?? 0;
  const queue_depth = sample.queue_depth ?? 0;
  const costs = sample.cost_events_usd ?? [];
  const estimated_hourly_cost_usd =
    costs.length === 0 ? 0 : costs.reduce((a, b) => a + b, 0);

  let health: ObservabilitySnapshot["health"] = "ok";
  if (failure_rate > 0.05 || p95 > 5000 || queue_depth > 100) {
    health = "degraded";
  }
  if (failure_rate > 0.25 || p95 > 15000) {
    health = "down";
  }

  return {
    generated_at: new Date().toISOString(),
    health,
    api_latency_p50_ms: p50,
    api_latency_p95_ms: p95,
    failure_rate,
    active_sessions,
    queue_depth,
    estimated_hourly_cost_usd: Math.round(estimated_hourly_cost_usd * 100) / 100,
    scaling_hint: scalingHint({
      active_sessions,
      queue_depth,
      p95,
      failure_rate,
    }),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1),
  );
  return sorted[idx]!;
}

function scalingHint(opts: {
  active_sessions: number;
  queue_depth: number;
  p95: number;
  failure_rate: number;
}): string {
  if (opts.active_sessions >= 800 || opts.queue_depth > 50) {
    return "Scale serverless concurrency / warm pools; enable Upstash rate-limit";
  }
  if (opts.p95 > 3000 || opts.failure_rate > 0.02) {
    return "Investigate provider latency; shed non-critical admin analytics";
  }
  return "Within Stage 10 design envelope (≤1000 concurrent sessions target)";
}

/** Performance envelope claimed by Stage 10 design (verified via tests). */
export const PERFORMANCE_ENVELOPE = {
  organizations: 100,
  users: 10_000,
  concurrent_sessions: 1_000,
} as const;
