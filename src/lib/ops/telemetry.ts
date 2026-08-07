/**
 * Production telemetry collectors (GA Controlled Institutional Deployment).
 * In-process ring buffers — pair with Vercel/Upstash/APM for multi-instance.
 * Never writes patient clinical state.
 */

export type TelemetryKind =
  | "api_latency"
  | "llm_latency"
  | "voice_stt_latency"
  | "voice_tts_latency"
  | "realtime_latency"
  | "avatar_latency"
  | "db_latency"
  | "error"
  | "session_start"
  | "session_end"
  | "session_drop"
  | "reconnect"
  | "queue_depth"
  | "tenant_active";

export type TelemetryEvent = {
  kind: TelemetryKind;
  at: string;
  ms?: number;
  ok?: boolean;
  tenantId?: string;
  reason?: string;
  detail?: string;
};

const MAX = 10_000;
const events: TelemetryEvent[] = [];

export function recordTelemetry(event: Omit<TelemetryEvent, "at"> & { at?: string }) {
  events.push({
    ...event,
    at: event.at ?? new Date().toISOString(),
  });
  if (events.length > MAX) {
    events.splice(0, events.length - MAX);
  }
}

export function listTelemetry(limit = 500): TelemetryEvent[] {
  return events.slice(-Math.max(1, Math.min(limit, MAX)));
}

export function clearTelemetryForTests() {
  events.length = 0;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function p95(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] ?? null;
}

export function telemetrySummary() {
  const lat = (kind: TelemetryKind) =>
    events
      .filter((e) => e.kind === kind && typeof e.ms === "number")
      .map((e) => e.ms as number);

  const api = lat("api_latency");
  const llm = lat("llm_latency");
  const stt = lat("voice_stt_latency");
  const tts = lat("voice_tts_latency");
  const rt = lat("realtime_latency");
  const avatar = lat("avatar_latency");
  const db = lat("db_latency");

  const starts = events.filter((e) => e.kind === "session_start").length;
  const ends = events.filter((e) => e.kind === "session_end").length;
  const drops = events.filter((e) => e.kind === "session_drop").length;
  const reconnects = events.filter((e) => e.kind === "reconnect").length;
  const errors = events.filter((e) => e.kind === "error" || e.ok === false);

  const tenants = new Set(
    events.map((e) => e.tenantId).filter((t): t is string => Boolean(t)),
  );

  const failureReasons: Record<string, number> = {};
  for (const e of errors) {
    const key = e.reason || e.detail || "unknown";
    failureReasons[key] = (failureReasons[key] ?? 0) + 1;
  }

  const queueSamples = events
    .filter((e) => e.kind === "queue_depth" && typeof e.ms === "number")
    .map((e) => e.ms as number);

  return {
    samples: events.length,
    api_latency_avg_ms: avg(api),
    api_latency_p95_ms: p95(api),
    llm_latency_avg_ms: avg(llm),
    llm_latency_p95_ms: p95(llm),
    voice_stt_avg_ms: avg(stt),
    voice_tts_avg_ms: avg(tts),
    realtime_avg_ms: avg(rt),
    avatar_avg_ms: avg(avatar),
    db_avg_ms: avg(db),
    session_starts: starts,
    session_ends: ends,
    session_drops: drops,
    drop_rate: starts === 0 ? 0 : drops / starts,
    completion_rate: starts === 0 ? 0 : ends / starts,
    reconnects,
    error_count: errors.length,
    error_rate: events.length === 0 ? 0 : errors.length / events.length,
    queue_length: queueSamples.at(-1) ?? 0,
    tenant_count: tenants.size,
    failure_reasons: failureReasons,
  };
}

/** In-process session simulation for GA load methodology (not live prod). */
export function simulateSessionLoad(count: number, tenantPrefix = "sim-tenant") {
  const n = Math.max(1, Math.min(count, 5000));
  for (let i = 0; i < n; i++) {
    const tenantId = `${tenantPrefix}-${i % 50}`;
    recordTelemetry({ kind: "session_start", tenantId, ok: true });
    recordTelemetry({
      kind: "api_latency",
      ms: 80 + (i % 40),
      ok: true,
      tenantId,
    });
    recordTelemetry({
      kind: "llm_latency",
      ms: 900 + (i % 500),
      ok: true,
      tenantId,
    });
    recordTelemetry({
      kind: "voice_stt_latency",
      ms: 400 + (i % 200),
      ok: true,
      tenantId,
    });
    recordTelemetry({
      kind: "voice_tts_latency",
      ms: 600 + (i % 300),
      ok: true,
      tenantId,
    });
    recordTelemetry({
      kind: "realtime_latency",
      ms: 50 + (i % 30),
      ok: true,
      tenantId,
    });
    recordTelemetry({
      kind: "avatar_latency",
      ms: 30 + (i % 20),
      ok: true,
      tenantId,
    });
    recordTelemetry({
      kind: "db_latency",
      ms: 20 + (i % 15),
      ok: true,
      tenantId,
    });
    if (i % 40 === 0) {
      recordTelemetry({
        kind: "session_drop",
        ok: false,
        tenantId,
        reason: "client_disconnect",
      });
      recordTelemetry({ kind: "reconnect", ok: true, tenantId });
    } else {
      recordTelemetry({ kind: "session_end", ok: true, tenantId });
    }
    if (i % 100 === 0) {
      recordTelemetry({ kind: "queue_depth", ms: i % 7, tenantId });
    }
  }
  return telemetrySummary();
}
