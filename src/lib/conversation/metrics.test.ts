import { describe, expect, it } from "vitest";
import {
  createEmptyMetrics,
  metricsPayload,
  recordNetworkDisconnect,
  recordPause,
  recordTurn,
  summarizeMetrics,
} from "@/lib/conversation/metrics";
import { normalizeVoicePreferences } from "@/lib/conversation/preferences";
import { isHandsFreeTherapyEnabled } from "@/lib/conversation/feature-flag";

describe("HFTE metrics", () => {
  it("aggregates without storing audio", () => {
    let m = createEmptyMetrics("sess-1");
    m = recordTurn(m, {
      speechDurationMs: 1200,
      thinkingLatencyMs: 900,
      interrupted: true,
      vadConfidence: 0.8,
    });
    m = recordTurn(m, {
      speechDurationMs: 800,
      thinkingLatencyMs: 700,
      interrupted: false,
      vadConfidence: 0.6,
    });
    m = recordPause(m);
    m = recordNetworkDisconnect(m);
    const s = summarizeMetrics(m);
    expect(s.averageInterruptions).toBe(0.5);
    expect(s.speechDurationMs).toBe(2000);
    expect(s.pauseFrequency).toBe(1);
    expect(s.vadConfidence).toBeCloseTo(0.7);
    const payload = metricsPayload(m);
    expect(payload).not.toHaveProperty("audio");
    expect(JSON.stringify(payload)).not.toMatch(/wav|base64|audio/i);
  });
});

describe("preferences + feature flag", () => {
  it("normalizes preferences", () => {
    const p = normalizeVoicePreferences({
      mode: "push_to_talk",
      minSilenceMs: 50,
      voiceSensitivity: 2,
      thinkingDelayScale: 0.1,
    });
    expect(p.mode).toBe("push_to_talk");
    expect(p.minSilenceMs).toBe(600);
    expect(p.voiceSensitivity).toBe(1);
    expect(p.thinkingDelayScale).toBe(0.5);
  });

  it("reads ENABLE_HANDS_FREE_THERAPY", () => {
    expect(isHandsFreeTherapyEnabled({ ENABLE_HANDS_FREE_THERAPY: "true" })).toBe(
      true,
    );
    expect(
      isHandsFreeTherapyEnabled({
        NEXT_PUBLIC_ENABLE_HANDS_FREE_THERAPY: "1",
      }),
    ).toBe(true);
    expect(isHandsFreeTherapyEnabled({})).toBe(false);
  });
});
