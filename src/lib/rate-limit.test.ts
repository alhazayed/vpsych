import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "./rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = `k-${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks buckets independently per key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const key = `w-${Math.random()}`;
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
    expect(rateLimit(key, 1, 1_000).ok).toBe(false);
    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z")); // +2s > window
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
  });
});
