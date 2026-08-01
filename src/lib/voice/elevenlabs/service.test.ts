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

  it("rejects empty text", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    await expect(
      elevenLabsService.synthesize({ text: "   ", locale: "en" }),
    ).rejects.toBeInstanceOf(ElevenLabsError);
  });

  it("streams audio and caches repeated requests", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
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
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    await expect(
      elevenLabsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_FAILED", status: 502 });
  });

  it("retries with the default premade voice after paid_plan_required", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
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
    expect(result.voiceId).toBe("21m00Tcm4TlvDq8ikWAM");
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain("library-voice");
    expect(calls[1]).toContain("21m00Tcm4TlvDq8ikWAM");
  });
});
