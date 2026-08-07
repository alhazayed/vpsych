/**
 * Latency Controller — samples stages and adapts pacing.
 */

import {
  REALTIME_E2E_VOICE_TURN_P50_MS,
  REALTIME_E2E_VOICE_TURN_P95_MS,
  REALTIME_INTERACTION_LATENCY_TARGET_MS,
  type LatencySample,
  type NetworkQuality,
} from "@/lib/realtime/types";

export type LatencyController = {
  mark: (stage: LatencySample["stage"], ms: number, ok?: boolean) => void;
  samples: () => LatencySample[];
  p50: (stage: LatencySample["stage"]) => number | null;
  withinInteractionTarget: () => boolean;
  withinE2eP50: () => boolean;
  suggestNetwork: () => NetworkQuality;
  clear: () => void;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? null;
}

export function createLatencyController(): LatencyController {
  const samples: LatencySample[] = [];

  const forStage = (stage: LatencySample["stage"]) =>
    samples
      .filter((s) => s.stage === stage && s.ok)
      .map((s) => s.ms)
      .sort((a, b) => a - b);

  return {
    mark(stage, ms, ok = true) {
      samples.push({
        stage,
        ms: Math.max(0, ms),
        ok,
        at: new Date().toISOString(),
      });
    },
    samples: () => [...samples],
    p50(stage) {
      return percentile(forStage(stage), 50);
    },
    withinInteractionTarget() {
      const p = percentile(forStage("interaction"), 50);
      return p == null ? true : p <= REALTIME_INTERACTION_LATENCY_TARGET_MS;
    },
    withinE2eP50() {
      const p = percentile(forStage("e2e_turn"), 50);
      return p == null ? true : p <= REALTIME_E2E_VOICE_TURN_P50_MS;
    },
    suggestNetwork() {
      const e2e = percentile(forStage("e2e_turn"), 95);
      if (e2e == null) return "good";
      if (e2e <= REALTIME_E2E_VOICE_TURN_P50_MS) return "excellent";
      if (e2e <= REALTIME_E2E_VOICE_TURN_P95_MS * 0.6) return "good";
      if (e2e <= REALTIME_E2E_VOICE_TURN_P95_MS) return "fair";
      return "poor";
    },
    clear() {
      samples.length = 0;
    },
  };
}
