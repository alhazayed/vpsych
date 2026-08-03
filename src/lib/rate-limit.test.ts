import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasUpstashRedis,
  rateLimit,
  rateLimitMemory,
  resetRateLimitMemory,
  windowMsToDuration,
} from "./rate-limit";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetRateLimitMemory();
});

describe("rateLimitMemory", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = `k-${Math.random()}`;
    expect(rateLimitMemory(key, 2, 60_000).ok).toBe(true);
    expect(rateLimitMemory(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimitMemory(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks buckets independently per key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimitMemory(a, 1, 60_000).ok).toBe(true);
    expect(rateLimitMemory(a, 1, 60_000).ok).toBe(false);
    expect(rateLimitMemory(b, 1, 60_000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const key = `w-${Math.random()}`;
    expect(rateLimitMemory(key, 1, 1_000).ok).toBe(true);
    expect(rateLimitMemory(key, 1, 1_000).ok).toBe(false);
    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z")); // +2s > window
    expect(rateLimitMemory(key, 1, 1_000).ok).toBe(true);
  });
});

describe("rateLimit (async facade)", () => {
  it("uses the in-memory path when Upstash env is unset", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(hasUpstashRedis()).toBe(false);

    const key = `async-${Math.random()}`;
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
  });

  it("tightens memory fallback limit in production", async () => {
    const { memoryFallbackLimit } = await import("./rate-limit");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    expect(memoryFallbackLimit(120)).toBe(60);
    expect(memoryFallbackLimit(8)).toBe(5); // floor when half < floor
    expect(memoryFallbackLimit(4)).toBe(4); // never exceeds configured limit
  });
});

describe("windowMsToDuration", () => {
  it("maps common windows to Upstash duration units", () => {
    expect(windowMsToDuration(3_600_000)).toBe("1 h");
    expect(windowMsToDuration(60_000)).toBe("1 m");
    expect(windowMsToDuration(5_000)).toBe("5 s");
    expect(windowMsToDuration(250)).toBe("250 ms");
  });
});
