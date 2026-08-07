/**
 * Realtime Observability — PHI-free media/session metrics.
 */

import type { LatencySample, RealtimeMetricEvent } from "@/lib/realtime/types";

export type RealtimeMetricsStore = {
  record: (event: Omit<RealtimeMetricEvent, "at"> & { at?: string }) => void;
  recordLatency: (sample: LatencySample, sessionId?: string) => void;
  list: (sessionId?: string) => RealtimeMetricEvent[];
  summary: (sessionId?: string) => RealtimeMetricsSummary;
  clear: () => void;
};

export type RealtimeMetricsSummary = {
  total: number;
  reconnects: number;
  sttFailures: number;
  ttsFailures: number;
  speechFailures: number;
  streamInterrupts: number;
  avatarSyncEvents: number;
  avgLatencyMs: number | null;
  packetLossEvents: number;
};

const globalStore: RealtimeMetricEvent[] = [];

export function createRealtimeMetricsStore(
  seed: RealtimeMetricEvent[] = globalStore,
): RealtimeMetricsStore {
  const events = seed;

  return {
    record(event) {
      events.push({
        ...event,
        at: event.at ?? new Date().toISOString(),
      });
    },
    recordLatency(sample, sessionId) {
      events.push({
        kind: "latency",
        sessionId,
        value: sample.ms,
        detail: `${sample.stage}:${sample.ok ? "ok" : "fail"}`,
        at: sample.at,
      });
    },
    list(sessionId) {
      if (!sessionId) return [...events];
      return events.filter((e) => e.sessionId === sessionId);
    },
    summary(sessionId) {
      const list = sessionId
        ? events.filter((e) => e.sessionId === sessionId)
        : events;
      const latency = list.filter(
        (e) => e.kind === "latency" && typeof e.value === "number",
      );
      const avg =
        latency.length === 0
          ? null
          : latency.reduce((a, e) => a + (e.value ?? 0), 0) / latency.length;
      return {
        total: list.length,
        reconnects: list.filter((e) => e.kind === "reconnect").length,
        sttFailures: list.filter((e) => e.kind === "stt_failure").length,
        ttsFailures: list.filter((e) => e.kind === "tts_failure").length,
        speechFailures: list.filter((e) => e.kind === "speech_failure").length,
        streamInterrupts: list.filter((e) => e.kind === "stream_interrupt")
          .length,
        avatarSyncEvents: list.filter((e) => e.kind === "avatar_sync").length,
        avgLatencyMs: avg,
        packetLossEvents: list.filter((e) => e.kind === "packet_loss").length,
      };
    },
    clear() {
      events.length = 0;
    },
  };
}

export const realtimeMetrics = createRealtimeMetricsStore();

export function clearRealtimeMetricsForTests() {
  realtimeMetrics.clear();
}
