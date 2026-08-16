import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readTtsCache,
  resetTtsCache,
  ttsCacheKey,
  ttsCacheSize,
  writeTtsCache,
  type TtsCacheEntry,
} from "@/lib/voice/tts/cache";
import type { TtsProviderId } from "@/lib/voice/tts/types";

const CACHE_ENV = [
  "TTS_CACHE_TTL_MS",
  "TTS_CACHE_MAX_ENTRIES",
  "ELEVENLABS_CACHE_TTL_MS",
  "ELEVENLABS_CACHE_MAX_ENTRIES",
] as const;

function entry(overrides: Partial<TtsCacheEntry> = {}): TtsCacheEntry {
  return {
    buffer: new Uint8Array([1, 2, 3]).buffer,
    contentType: "audio/mpeg",
    voiceId: "en-US-Chirp3-HD-Kore",
    modelId: "chirp3-hd",
    locale: "en",
    provider: "google",
    createdAt: Date.now(),
    ...overrides,
  };
}

function keyFor(overrides: {
  provider?: TtsProviderId;
  text?: string;
  voiceId?: string;
  modelId?: string;
  locale?: "en" | "ar";
  speechParams?: unknown;
} = {}) {
  return ttsCacheKey({
    provider: overrides.provider ?? "google",
    text: overrides.text ?? "Hello patient",
    voiceId: overrides.voiceId ?? "en-US-Chirp3-HD-Kore",
    modelId: overrides.modelId ?? "chirp3-hd",
    locale: overrides.locale ?? "en",
    speechParams: overrides.speechParams ?? { audioEncoding: "MP3" },
  });
}

describe("TTS cache", () => {
  beforeEach(() => {
    resetTtsCache();
    for (const key of CACHE_ENV) delete process.env[key];
  });

  afterEach(() => {
    resetTtsCache();
    vi.useRealTimers();
    for (const key of CACHE_ENV) delete process.env[key];
  });

  it("returns a hit for an identical key", () => {
    const key = keyFor();
    writeTtsCache(key, entry());
    expect(ttsCacheSize()).toBe(1);

    const hit = readTtsCache(key);
    expect(hit).not.toBeNull();
    expect(hit?.voiceId).toBe("en-US-Chirp3-HD-Kore");
    expect(hit?.provider).toBe("google");
  });

  it("returns a miss for an unknown key", () => {
    writeTtsCache(keyFor(), entry());
    expect(readTtsCache(keyFor({ text: "Different text" }))).toBeNull();
  });

  it("expires entries past the TTL", () => {
    process.env.TTS_CACHE_TTL_MS = "1000";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T00:00:00Z"));

    const key = keyFor();
    writeTtsCache(key, entry({ createdAt: Date.now() }));
    expect(readTtsCache(key)).not.toBeNull();

    vi.advanceTimersByTime(1500);
    expect(readTtsCache(key)).toBeNull();
    // The expired entry is evicted, not merely hidden.
    expect(ttsCacheSize()).toBe(0);
  });

  it("isolates providers — same text and voice never cross vendors", () => {
    const googleKey = keyFor({ provider: "google" });
    const elevenKey = keyFor({ provider: "elevenlabs" });
    expect(googleKey).not.toBe(elevenKey);

    writeTtsCache(googleKey, entry({ provider: "google" }));
    expect(readTtsCache(elevenKey)).toBeNull();
    expect(readTtsCache(googleKey)?.provider).toBe("google");
  });

  it("isolates voices", () => {
    const a = keyFor({ voiceId: "en-US-Chirp3-HD-Kore" });
    const b = keyFor({ voiceId: "en-US-Chirp3-HD-Puck" });
    expect(a).not.toBe(b);

    writeTtsCache(a, entry());
    expect(readTtsCache(b)).toBeNull();
  });

  it("isolates locales and models", () => {
    writeTtsCache(keyFor(), entry());
    expect(readTtsCache(keyFor({ locale: "ar" }))).toBeNull();
    expect(readTtsCache(keyFor({ modelId: "neural2" }))).toBeNull();
  });

  it("isolates prosody — a different delivery is a different entry", () => {
    const neutral = keyFor({ speechParams: { audioEncoding: "MP3" } });
    const slowed = keyFor({
      speechParams: { audioEncoding: "MP3", speakingRate: 0.75 },
    });
    expect(neutral).not.toBe(slowed);

    writeTtsCache(neutral, entry());
    expect(readTtsCache(slowed)).toBeNull();
  });

  it("treats key order in speech params as irrelevant", () => {
    const a = keyFor({ speechParams: { audioEncoding: "MP3", speakingRate: 0.8 } });
    const b = keyFor({ speechParams: { speakingRate: 0.8, audioEncoding: "MP3" } });
    expect(a).toBe(b);
  });

  it("bounds memory by evicting the oldest entries", () => {
    process.env.TTS_CACHE_MAX_ENTRIES = "3";
    for (let i = 0; i < 6; i++) {
      writeTtsCache(keyFor({ text: `line ${i}` }), entry());
    }
    expect(ttsCacheSize()).toBe(3);
    // The earliest writes were evicted.
    expect(readTtsCache(keyFor({ text: "line 0" }))).toBeNull();
    expect(readTtsCache(keyFor({ text: "line 5" }))).not.toBeNull();
  });

  it("refreshes recency on read so hot entries survive eviction", () => {
    process.env.TTS_CACHE_MAX_ENTRIES = "2";
    writeTtsCache(keyFor({ text: "a" }), entry());
    writeTtsCache(keyFor({ text: "b" }), entry());

    // Touch "a" so "b" becomes the eviction candidate.
    expect(readTtsCache(keyFor({ text: "a" }))).not.toBeNull();
    writeTtsCache(keyFor({ text: "c" }), entry());

    expect(readTtsCache(keyFor({ text: "a" }))).not.toBeNull();
    expect(readTtsCache(keyFor({ text: "b" }))).toBeNull();
  });

  it("honors the legacy ELEVENLABS_CACHE_* names during migration", () => {
    process.env.ELEVENLABS_CACHE_MAX_ENTRIES = "1";
    writeTtsCache(keyFor({ text: "a" }), entry());
    writeTtsCache(keyFor({ text: "b" }), entry());
    expect(ttsCacheSize()).toBe(1);
  });

  it("resetTtsCache clears everything", () => {
    writeTtsCache(keyFor(), entry());
    expect(ttsCacheSize()).toBe(1);
    resetTtsCache();
    expect(ttsCacheSize()).toBe(0);
  });
});
