import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SESSION_SECONDS } from "./types";
import { dueTimeWarning, formatTimer, remainingSeconds } from "./session-timer";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTimer", () => {
  it("formats mm:ss with zero padding", () => {
    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(5)).toBe("00:05");
    expect(formatTimer(65)).toBe("01:05");
    expect(formatTimer(MAX_SESSION_SECONDS)).toBe("40:00");
  });
});

describe("remainingSeconds", () => {
  it("counts down from the max duration", () => {
    vi.useFakeTimers();
    const started = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-01-01T00:01:00.000Z")); // +60s
    expect(remainingSeconds(started.toISOString(), 2400)).toBe(2340);
  });

  it("never returns a negative value", () => {
    vi.useFakeTimers();
    const started = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z")); // long past
    expect(remainingSeconds(started.toISOString(), 2400)).toBe(0);
  });

  it("defaults to MAX_SESSION_SECONDS", () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);
    expect(remainingSeconds(now.toISOString())).toBe(MAX_SESSION_SECONDS);
  });
});

describe("dueTimeWarning", () => {
  it("stays quiet before five minutes are left", () => {
    expect(dueTimeWarning(301, null)).toBeNull();
  });

  it("warns at five minutes, then at one minute, once each", () => {
    expect(dueTimeWarning(300, null)).toBe(5);
    expect(dueTimeWarning(299, 5)).toBeNull();
    expect(dueTimeWarning(60, 5)).toBe(1);
    expect(dueTimeWarning(30, 1)).toBeNull();
  });

  it("gives only the nearest warning when the room opens late", () => {
    expect(dueTimeWarning(45, null)).toBe(1);
  });

  it("says nothing once time is up", () => {
    expect(dueTimeWarning(0, null)).toBeNull();
  });
});
