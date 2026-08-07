import { afterEach, describe, expect, it, vi } from "vitest";
import {
  elevenLabsCacheSize,
  elevenLabsService,
  ElevenLabsError,
  resetElevenLabsCache,
} from "@/lib/voice/elevenlabs";

describe("elevenLabsService", () => {
  afterEach(() => {
    resetElevenLabsCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.ELEVENLABS_API_KEY;
  });

  it("throws TTS_UNAVAILABLE when API key is missing", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    await expect(
      elevenLabsService.synthesize({
        text: "Hello",
        locale: "en",
      }),
    ).rejects.toMatchObject({
      code: "TTS_UNAVAILABLE",
      status: 501,
    });
  });

  it("throws TTS_CONFIG when API key lacks sk_ prefix (W3-H5)", async () => {
    process.env.ELEVENLABS_API_KEY = "xi-old-or-placeholder";
    await expect(
      elevenLabsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_CONFIG", status: 503 });
  });

  it("rejects empty text", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_testkey123456";
    await expect(
      elevenLabsService.synthesize({ text: "   ", locale: "en" }),
    ).rejects.toBeInstanceOf(ElevenLabsError);
  });

  it("streams audio and caches repeated requests", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_testkey123456";
    let fetchCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        fetchCount += 1;
        const bytes = new Uint8Array([1, 2, 3, 4]);
        return new Response(bytes, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }),
    );

    const first = await elevenLabsService.synthesize({
      text: "Hello patient",
      locale: "en",
      voiceId: "voice-en",
    });
    expect(first.cached).toBe(false);
    expect(first.streamed).toBe(true);
    expect(first.voiceId).toBe("voice-en");
    // Drain stream so the tee cache fill can complete.
    await new Response(first.body).arrayBuffer();
    await vi.waitFor(() => expect(elevenLabsCacheSize()).toBe(1));

    const second = await elevenLabsService.synthesize({
      text: "Hello patient",
      locale: "en",
      voiceId: "voice-en",
    });
    expect(second.cached).toBe(true);
    expect(fetchCount).toBe(1);

    const arabic = await elevenLabsService.synthesize({
      text: "مرحبا",
      locale: "ar",
      voiceIdAr: "voice-ar",
    });
    expect(arabic.voiceId).toBe("voice-ar");
    expect(arabic.cached).toBe(false);
    expect(fetchCount).toBe(2);
  });

  it("maps ElevenLabs HTTP failures to TTS_FAILED", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_testkey123456";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    await expect(
      elevenLabsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_FAILED", status: 502 });
  });

  it("maps AbortSignal timeout to TTS_TIMEOUT (Stage 12 / RT-03)", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_testkey123456";
    process.env.ELEVENLABS_TIMEOUT_MS = "50";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        // Honour the signal when present (mirrors undici AbortSignal.timeout).
        if (init?.signal?.aborted) throw err;
        await new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(err));
        });
        return new Response();
      }),
    );

    await expect(
      elevenLabsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_TIMEOUT", status: 504 });
    delete process.env.ELEVENLABS_TIMEOUT_MS;
  });

  it("retries with the default premade voice after paid_plan_required", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_testkey123456";
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (url.includes("library-voice")) {
          return new Response(
            JSON.stringify({
              detail: {
                type: "payment_required",
                code: "paid_plan_required",
                message: "Free users cannot use library voices via the API.",
              },
            }),
            { status: 402 },
          );
        }
        return new Response(new Uint8Array([9, 9]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }),
    );

    const result = await elevenLabsService.synthesize({
      text: "Hello",
      locale: "en",
      voiceId: "library-voice",
    });
    expect(result.voiceId).toBe("EXAVITQu4vr4xnSDxMaL");
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain("library-voice");
    expect(calls[1]).toContain("EXAVITQu4vr4xnSDxMaL");
  });
});
