import type {
  HfteSessionMetrics,
  HfteTurnMetricSample,
} from "@/lib/conversation/types";

export function createEmptyMetrics(sessionId: string): HfteSessionMetrics {
  return {
    sessionId,
    interruptionCount: 0,
    pauseCount: 0,
    speechDurationMs: 0,
    thinkingLatencyMs: 0,
    turnCount: 0,
    vadConfidenceSum: 0,
    vadConfidenceSamples: 0,
    networkDisconnectCount: 0,
  };
}

export function recordTurn(
  metrics: HfteSessionMetrics,
  sample: HfteTurnMetricSample,
): HfteSessionMetrics {
  return {
    ...metrics,
    turnCount: metrics.turnCount + 1,
    speechDurationMs: metrics.speechDurationMs + sample.speechDurationMs,
    thinkingLatencyMs: metrics.thinkingLatencyMs + sample.thinkingLatencyMs,
    interruptionCount:
      metrics.interruptionCount + (sample.interrupted ? 1 : 0),
    vadConfidenceSum: metrics.vadConfidenceSum + sample.vadConfidence,
    vadConfidenceSamples: metrics.vadConfidenceSamples + 1,
  };
}

export function recordPause(metrics: HfteSessionMetrics): HfteSessionMetrics {
  return { ...metrics, pauseCount: metrics.pauseCount + 1 };
}

export function recordNetworkDisconnect(
  metrics: HfteSessionMetrics,
): HfteSessionMetrics {
  return {
    ...metrics,
    networkDisconnectCount: metrics.networkDisconnectCount + 1,
  };
}

export function summarizeMetrics(metrics: HfteSessionMetrics) {
  const turns = Math.max(1, metrics.turnCount);
  return {
    sessionId: metrics.sessionId,
    averageInterruptions: metrics.interruptionCount / turns,
    averageLatencyMs: metrics.thinkingLatencyMs / turns,
    speechDurationMs: metrics.speechDurationMs,
    pauseFrequency: metrics.pauseCount,
    vadConfidence:
      metrics.vadConfidenceSamples === 0
        ? 0
        : metrics.vadConfidenceSum / metrics.vadConfidenceSamples,
    interruptionCount: metrics.interruptionCount,
    turnCount: metrics.turnCount,
    networkDisconnectCount: metrics.networkDisconnectCount,
  };
}

/** Payload safe to POST — never includes audio or transcripts. */
export function metricsPayload(metrics: HfteSessionMetrics) {
  const summary = summarizeMetrics(metrics);
  return {
    session_id: metrics.sessionId,
    interruption_count: metrics.interruptionCount,
    pause_count: metrics.pauseCount,
    speech_duration_ms: metrics.speechDurationMs,
    thinking_latency_ms: metrics.thinkingLatencyMs,
    turn_count: metrics.turnCount,
    vad_confidence_avg: summary.vadConfidence,
    network_disconnect_count: metrics.networkDisconnectCount,
  };
}
