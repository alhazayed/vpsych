import { describe, expect, it } from "vitest";
import { computeThinkingDelayMs } from "@/lib/conversation/thinking-delay";
import type { PmeUxCues } from "@/lib/conversation/types";

const base: PmeUxCues = {
  permitsVocalization: true,
  pace: "measured",
  energy: "moderate",
  severity: "moderate",
  hesitation: 0.35,
  confidence: 0.55,
  alliance: 0.5,
};

describe("thinking delay", () => {
  it("stays within natural bounds for default cues", () => {
    const ms = computeThinkingDelayMs(base);
    expect(ms).toBeGreaterThanOrEqual(700);
    expect(ms).toBeLessThanOrEqual(1800);
  });

  it("is slower for severe low-energy depression cues", () => {
    const slow = computeThinkingDelayMs({
      ...base,
      pace: "slow",
      energy: "low",
      severity: "severe",
      hesitation: 0.7,
      confidence: 0.3,
      disorderCategory: "mood",
      emotion: "sadness",
    });
    const fast = computeThinkingDelayMs({
      ...base,
      pace: "pressured",
      energy: "high",
      severity: "mild",
      hesitation: 0.1,
      confidence: 0.9,
      alliance: 0.9,
    });
    expect(slow).toBeGreaterThan(fast);
  });

  it("respects user scale without feeling like a fixed timeout", () => {
    const a = computeThinkingDelayMs(base, { scale: 0.5 });
    const b = computeThinkingDelayMs(base, { scale: 2 });
    expect(b).toBeGreaterThan(a);
  });

  it("is deterministic for the same cues", () => {
    expect(computeThinkingDelayMs(base)).toBe(computeThinkingDelayMs(base));
  });
});
