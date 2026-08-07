/**
 * Production ops metrics façade (Stage 12).
 *
 * Aggregates existing Stage 10/11 in-process observability plus env/rate-limit
 * posture. Does not invent a second APM product — operators wire Sentry/Vercel
 * log drains externally; this endpoint is the in-app dashboard snapshot.
 */

import { validateProductionEnv } from "@/lib/env";
import { hasUpstashRedis } from "@/lib/rate-limit";
import {
  buildObservabilitySnapshot as enterpriseObs,
} from "@/lib/enterprise";
import {
  realtimeMetrics,
  buildRealtimeDashboard,
} from "@/lib/realtime";
import { PACKAGE_VERSION, STAGE12_CERT_ID } from "@/lib/ops/versions";

export type ProductionOpsSnapshot = {
  cert_id: string;
  package_version: string;
  checked_at: string;
  health: {
    liveness: "ok";
    env_ok: boolean;
    upstash_rate_limit: boolean;
  };
  env: ReturnType<typeof validateProductionEnv>;
  enterprise: ReturnType<typeof enterpriseObs>;
  realtime: {
    metrics: ReturnType<typeof realtimeMetrics.summary>;
    dashboard: ReturnType<typeof buildRealtimeDashboard>;
  };
  clinical_pipeline: {
    note: string;
    stages: string[];
  };
  latency_budgets: {
    voice_e2e_p50_target_ms: number;
    voice_e2e_p95_target_ms: number;
    openai_hard_timeout_ms: number;
    elevenlabs_timeout_ms: number;
  };
};

export function buildProductionOpsSnapshot(): ProductionOpsSnapshot {
  const env = validateProductionEnv();
  const timeoutMs = Number(process.env.ELEVENLABS_TIMEOUT_MS ?? 30_000);
  const openaiTimeout = Number(process.env.OPENAI_TIMEOUT_MS ?? 60_000);

  return {
    cert_id: STAGE12_CERT_ID,
    package_version: PACKAGE_VERSION,
    checked_at: new Date().toISOString(),
    health: {
      liveness: "ok",
      env_ok: env.ok,
      upstash_rate_limit: hasUpstashRedis(),
    },
    env,
    enterprise: enterpriseObs(),
    realtime: {
      metrics: realtimeMetrics.summary(),
      dashboard: buildRealtimeDashboard({}),
    },
    clinical_pipeline: {
      note: "Presentation + soft-fail layers only; patient cognition unchanged",
      stages: [
        "case_mint",
        "message_turn",
        "assess",
        "education",
        "validation",
        "supervisor",
        "enterprise",
        "realtime",
      ],
    },
    latency_budgets: {
      voice_e2e_p50_target_ms: 6000,
      voice_e2e_p95_target_ms: 15_000,
      openai_hard_timeout_ms: openaiTimeout,
      elevenlabs_timeout_ms: timeoutMs,
    },
  };
}
