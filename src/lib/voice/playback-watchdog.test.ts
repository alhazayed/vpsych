import { describe, expect, it } from "vitest";
import {
  PLAYBACK_MAX_MS,
  PLAYBACK_OVERRUN_GRACE_MS,
  PLAYBACK_STALL_MS,
  playbackVerdict,
} from "./playback-watchdog";

const base = { startedAt: 0, duration: 10, playbackRate: 1 };

describe("playbackVerdict", () => {
  it("is ok while the clock advances within the clip length", () => {
    expect(playbackVerdict({ ...base, now: 5000, lastProgressAt: 4800 })).toBe("ok");
  });

  it("flags a clip whose position stopped moving", () => {
    expect(
      playbackVerdict({ ...base, now: 6000, lastProgressAt: 6000 - PLAYBACK_STALL_MS }),
    ).toBe("stalled");
  });

  it("flags a clip that runs past its length plus grace", () => {
    const now = 10_000 + PLAYBACK_OVERRUN_GRACE_MS;
    expect(playbackVerdict({ ...base, now, lastProgressAt: now - 100 })).toBe("overrun");
  });

  it("scales the budget with playbackRate", () => {
    // 10 s at 0.82× ≈ 12.2 s of real time — not overrun at 14 s.
    expect(
      playbackVerdict({ ...base, playbackRate: 0.82, now: 14_000, lastProgressAt: 13_900 }),
    ).toBe("ok");
  });

  it("uses the hard ceiling when the length is unknown", () => {
    const d = { ...base, duration: Number.POSITIVE_INFINITY };
    expect(playbackVerdict({ ...d, now: 60_000, lastProgressAt: 59_900 })).toBe("ok");
    expect(
      playbackVerdict({ ...d, now: PLAYBACK_MAX_MS, lastProgressAt: PLAYBACK_MAX_MS - 100 }),
    ).toBe("overrun");
  });
});
