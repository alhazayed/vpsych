import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasUpstashRedis,
  rateLimit,
  resetRateLimitMemory,
} from "@/lib/rate-limit";
import {
  ConcurrencyBusyError,
  ConcurrencyGate,
  resetConcurrencyGates,
} from "@/lib/concurrency";
import { resetElevenLabsCache } from "@/lib/voice/elevenlabs/service";

afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimitMemory();
  resetConcurrencyGates();
  resetElevenLabsCache();
  vi.useRealTimers();
});

describe("Mission 12 failure injection — rate limit / Redis", () => {
  it("returns Retry-After semantics when the memory bucket is exhausted", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(hasUpstashRedis()).toBe(false);

    const key = `inject-${Math.random()}`;
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    const blocked = await rateLimit(key, 1, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("recovers after the window elapses (automatic recovery)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T00:00:00.000Z"));
    const key = `recover-${Math.random()}`;
    expect((await rateLimit(key, 1, 1_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 1_000)).ok).toBe(false);
    vi.setSystemTime(new Date("2026-08-03T00:00:02.000Z"));
    expect((await rateLimit(key, 1, 1_000)).ok).toBe(true);
  });
});

describe("Mission 12 failure injection — ElevenLabs unavailable", () => {
  it("surfaces TTS_UNAVAILABLE (501) so clients can fall back to browser TTS", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const { elevenLabsService } = await import("@/lib/voice/elevenlabs/service");
    await expect(
      elevenLabsService.synthesize({ text: "hi", locale: "en" }),
    ).rejects.toMatchObject({
      code: "TTS_UNAVAILABLE",
      status: 501,
    });
  });
});

describe("Mission 12 failure injection — concurrency saturation", () => {
  it("rejects with CONCURRENCY_BUSY when saturated, then recovers", async () => {
    const gate = new ConcurrencyGate(1, 15);
    const hold = gate.run(() => new Promise((r) => setTimeout(r, 60)));
    await expect(gate.run(async () => "nope")).rejects.toBeInstanceOf(
      ConcurrencyBusyError,
    );
    await hold;
    await expect(gate.run(async () => "ok")).resolves.toBe("ok");
  });
});
