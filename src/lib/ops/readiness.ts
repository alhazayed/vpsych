/**
 * Aggregated readiness probes for VPsych dependencies.
 * Never returns raw provider error strings to clients.
 */

import { hasOpenAIApiKey } from "@/lib/ai/openai/client";
import { hasElevenLabs } from "@/lib/voice/config";
import { hasUpstashRedis } from "@/lib/rate-limit";
import {
  openaiCircuit,
  elevenLabsCircuit,
} from "@/lib/performance/resilience";
import { RECOVERY_OBJECTIVES } from "@/lib/ops/targets";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export type HealthCheckResult = {
  id: string;
  status: CheckStatus;
  latencyMs?: number;
  detail?: string;
};

export type ReadinessReport = {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  checks: HealthCheckResult[];
  circuits: {
    openai: string;
    elevenlabs: string;
  };
  objectives: typeof RECOVERY_OBJECTIVES;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("probe_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function probeSupabase(): Promise<HealthCheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return { id: "supabase", status: "fail", detail: "not_configured" };
  }
  const started = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
      }),
      RECOVERY_OBJECTIVES.healthProbeTimeoutMs,
    );
    const latencyMs = Date.now() - started;
    if (res.ok || res.status === 401 || res.status === 404) {
      // Auth health paths vary by project version; reachable HTTP = pass.
      return { id: "supabase", status: "pass", latencyMs };
    }
    return {
      id: "supabase",
      status: "warn",
      latencyMs,
      detail: `http_${res.status}`,
    };
  } catch {
    return {
      id: "supabase",
      status: "fail",
      latencyMs: Date.now() - started,
      detail: "unreachable",
    };
  }
}

function probeOpenAIConfig(): HealthCheckResult {
  if (!hasOpenAIApiKey()) {
    return { id: "openai", status: "warn", detail: "not_configured" };
  }
  if (openaiCircuit.isOpen()) {
    return { id: "openai", status: "warn", detail: "circuit_open" };
  }
  return { id: "openai", status: "pass", detail: "configured" };
}

function probeElevenLabsConfig(): HealthCheckResult {
  if (!hasElevenLabs()) {
    return { id: "elevenlabs", status: "warn", detail: "not_configured" };
  }
  if (elevenLabsCircuit.isOpen()) {
    return { id: "elevenlabs", status: "warn", detail: "circuit_open" };
  }
  return { id: "elevenlabs", status: "pass", detail: "configured" };
}

function probeUpstash(): HealthCheckResult {
  if (!hasUpstashRedis()) {
    return {
      id: "upstash",
      status: "warn",
      detail: "memory_fallback",
    };
  }
  return { id: "upstash", status: "pass", detail: "configured" };
}

function probeApp(): HealthCheckResult {
  return { id: "app", status: "pass", detail: "process_up" };
}

/**
 * Build readiness report. Supabase reachability is the only live network probe
 * by default; vendor keys/circuits are config checks (live OpenAI probe remains
 * admin-only at /api/health/openai to control cost).
 */
export async function buildReadinessReport(opts?: {
  probeNetwork?: boolean;
}): Promise<ReadinessReport> {
  const probeNetwork = opts?.probeNetwork !== false;
  const checks: HealthCheckResult[] = [
    probeApp(),
    probeOpenAIConfig(),
    probeElevenLabsConfig(),
    probeUpstash(),
  ];

  if (probeNetwork) {
    checks.splice(1, 0, await probeSupabase());
  } else {
    checks.splice(1, 0, {
      id: "supabase",
      status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "skip" : "fail",
      detail: "probe_skipped",
    });
  }

  const criticalDown = checks.some(
    (c) =>
      (c.id === "app" || c.id === "supabase") && c.status === "fail",
  );
  const degraded = checks.some((c) => c.status === "warn" || c.status === "fail");

  return {
    status: criticalDown ? "down" : degraded ? "degraded" : "ok",
    checkedAt: new Date().toISOString(),
    checks,
    circuits: {
      openai: openaiCircuit.getState(),
      elevenlabs: elevenLabsCircuit.getState(),
    },
    objectives: RECOVERY_OBJECTIVES,
  };
}

export function httpStatusForReadiness(
  status: ReadinessReport["status"],
): number {
  if (status === "down") return 503;
  // Degraded still serves traffic with fallbacks — return 200 with body status.
  return 200;
}
