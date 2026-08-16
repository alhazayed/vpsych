import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleTtsService } from "@/lib/voice/google";
import { resetTtsCache, ttsCacheSize } from "@/lib/voice/tts/cache";
import { TtsError } from "@/lib/voice/tts/types";

const GOOGLE_ENV = [
  "GOOGLE_TTS_API_KEY",
  "GOOGLE_TTS_ACCESS_TOKEN",
  "GOOGLE_TTS_VOICE_EN",
  "GOOGLE_TTS_VOICE_AR",
  "GOOGLE_TTS_LANGUAGE_EN",
  "GOOGLE_TTS_LANGUAGE_AR",
  "GOOGLE_TTS_TIMEOUT_MS",
  "GOOGLE_TTS_ENABLE_SPEAKING_RATE",
] as const;

/** Base64 of a small non-empty payload, standing in for an MP3 clip. */
const AUDIO_B64 = Buffer.from([0xff, 0xfb, 0x90, 0x44]).toString("base64");

function okResponse(audioContent: string = AUDIO_B64) {
  return new Response(JSON.stringify({ audioContent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchCall = { url: string; init: RequestInit };

function captureFetch(responder: () => Response): {
  calls: FetchCall[];
  fn: ReturnType<typeof vi.fn>;
} {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return responder();
  });
  return { calls, fn };
}

function bodyOf(call: FetchCall): {
  input: { text: string };
  voice: { languageCode: string; name: string };
  audioConfig: Record<string, unknown>;
} {
  return JSON.parse(String(call.init.body));
}

describe("googleTtsService", () => {
  beforeEach(() => {
    resetTtsCache();
    for (const key of GOOGLE_ENV) delete process.env[key];
  });

  afterEach(() => {
    resetTtsCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of GOOGLE_ENV) delete process.env[key];
  });

  it("throws TTS_UNAVAILABLE when no credential is configured", async () => {
    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_UNAVAILABLE", status: 501 });
  });

  it("synthesizes English with the configured Chirp 3 HD voice and MP3 output", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    const result = await googleTtsService.synthesize({
      text: "Hello patient",
      locale: "en",
    });

    expect(result.provider).toBe("google");
    expect(result.contentType).toBe("audio/mpeg");
    expect(result.voiceId).toBe("en-US-Chirp3-HD-Kore");
    expect(result.locale).toBe("en");
    expect(result.modelId).toBe("chirp3-hd");
    expect(result.cached).toBe(false);
    // REST text:synthesize returns a complete clip, never a stream.
    expect(result.streamed).toBe(false);

    const bytes = new Uint8Array(await new Response(result.body).arrayBuffer());
    expect(Array.from(bytes)).toEqual([0xff, 0xfb, 0x90, 0x44]);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
    );
    const body = bodyOf(calls[0]!);
    expect(body.voice).toEqual({
      languageCode: "en-US",
      name: "en-US-Chirp3-HD-Kore",
    });
    expect(body.audioConfig.audioEncoding).toBe("MP3");
    expect(body.input.text).toBe("Hello patient");
  });

  it("synthesizes Arabic against ar-XA and preserves the Arabic wording verbatim", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    const arabic = "أشعر بالقلق طوال الوقت، ولا أستطيع النوم.";
    const result = await googleTtsService.synthesize({
      text: arabic,
      locale: "ar",
    });

    expect(result.voiceId).toBe("ar-XA-Chirp3-HD-Kore");
    expect(result.locale).toBe("ar");

    const body = bodyOf(calls[0]!);
    expect(body.voice.languageCode).toBe("ar-XA");
    // Clinical wording must reach the provider unmodified.
    expect(body.input.text).toBe(arabic);
  });

  it("sends the API key as X-Goog-Api-Key and never in the URL", async () => {
    process.env.GOOGLE_TTS_API_KEY = "secret-key-value";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    await googleTtsService.synthesize({ text: "Hello", locale: "en" });

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("secret-key-value");
    expect(calls[0]!.url).not.toContain("secret-key-value");
  });

  it("prefers a bearer access token when both credentials are set", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    process.env.GOOGLE_TTS_ACCESS_TOKEN = "ya29.test-token";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    await googleTtsService.synthesize({ text: "Hello", locale: "en" });

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ya29.test-token");
    expect(headers["X-Goog-Api-Key"]).toBeUndefined();
  });

  it("rejects a configured voice name that is not a Google voice", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    // An ElevenLabs id must never reach Google, even via env misconfiguration.
    process.env.GOOGLE_TTS_VOICE_EN = "EXAVITQu4vr4xnSDxMaL";
    const { fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    const result = await googleTtsService.synthesize({
      text: "Hello",
      locale: "en",
    });

    // Falls back to the benchmark default rather than forwarding the bad id.
    expect(result.voiceId).toBe("en-US-Chirp3-HD-Kore");
  });

  it("ignores a caller-supplied ElevenLabs voice id and uses the Google default", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    const result = await googleTtsService.synthesize({
      text: "Hello",
      locale: "en",
      voiceId: "EXAVITQu4vr4xnSDxMaL",
    });

    expect(result.voiceId).toBe("en-US-Chirp3-HD-Kore");
    expect(bodyOf(calls[0]!).voice.name).toBe("en-US-Chirp3-HD-Kore");
  });

  it("rejects empty text before calling the provider", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    await expect(
      googleTtsService.synthesize({ text: "   ", locale: "en" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
    expect(calls).toHaveLength(0);
  });

  it("rejects oversized Arabic by UTF-8 bytes, not character count", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    // 2600 Arabic characters ≈ 5200 UTF-8 bytes: under a 5000-char limit but
    // over the 5000-byte limit. A character-based check would let this through.
    const arabic = "ب".repeat(2600);
    expect(arabic.length).toBeLessThan(5000);
    expect(Buffer.byteLength(arabic, "utf8")).toBeGreaterThan(5000);

    await expect(
      googleTtsService.synthesize({ text: arabic, locale: "ar" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
    // Rejected before the network call.
    expect(calls).toHaveLength(0);
  });

  it("accepts Arabic that fits inside the byte budget", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    const arabic = "ب".repeat(2000); // ~4000 bytes
    await expect(
      googleTtsService.synthesize({ text: arabic, locale: "ar" }),
    ).resolves.toMatchObject({ provider: "google" });
  });

  it("maps 400 to BAD_REQUEST", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad audioConfig", { status: 400 })),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
  });

  it("maps 401 and 403 to TTS_CONFIG", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    for (const status of [401, 403]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("denied", { status })),
      );
      await expect(
        googleTtsService.synthesize({ text: "Hello", locale: "en" }),
      ).rejects.toMatchObject({ code: "TTS_CONFIG", status: 503 });
    }
  });

  it("maps 404 to TTS_VOICE_INVALID", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("voice not found", { status: 404 })),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_VOICE_INVALID", status: 502 });
  });

  it("maps 429 to TTS_QUOTA", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("quota exceeded", { status: 429 })),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_QUOTA", status: 429 });
  });

  it("maps 5xx to TTS_FAILED", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    for (const status of [500, 503]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("upstream boom", { status })),
      );
      await expect(
        googleTtsService.synthesize({ text: "Hello", locale: "en" }),
      ).rejects.toMatchObject({ code: "TTS_FAILED", status: 502 });
    }
  });

  it("maps an AbortSignal timeout to TTS_TIMEOUT", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    process.env.GOOGLE_TTS_TIMEOUT_MS = "50";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        if (init?.signal?.aborted) throw err;
        await new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(err));
        });
        return new Response();
      }),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_TIMEOUT", status: 504 });
  });

  it("maps a malformed (non-JSON) response to TTS_FAILED", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>not json</html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_FAILED", status: 502 });
  });

  it("maps a response with no audioContent to TTS_FAILED", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ audioConfig: {} }), { status: 200 }),
      ),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toMatchObject({ code: "TTS_FAILED", status: 502 });
  });

  it("maps audioContent that decodes to zero bytes to TTS_FAILED", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    // Node's base64 decoder drops invalid characters rather than throwing, so
    // the failure mode to guard is "decoded to nothing", not "threw".
    const decodesToNothing = "!!!!";
    expect(Buffer.from(decodesToNothing, "base64").byteLength).toBe(0);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse(decodesToNothing)),
    );

    await expect(
      googleTtsService.synthesize({ text: "Hello", locale: "en" }),
    ).rejects.toBeInstanceOf(TtsError);
  });

  it("serves a repeated identical request from cache without a second call", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    const first = await googleTtsService.synthesize({
      text: "Hello patient",
      locale: "en",
    });
    expect(first.cached).toBe(false);
    expect(ttsCacheSize()).toBe(1);

    const second = await googleTtsService.synthesize({
      text: "Hello patient",
      locale: "en",
    });
    expect(second.cached).toBe(true);
    expect(calls).toHaveLength(1);

    // The cached body is still replayable.
    const bytes = new Uint8Array(await new Response(second.body).arrayBuffer());
    expect(bytes.byteLength).toBe(4);
  });

  it("does not send speakingRate or pitch to a Chirp 3 HD voice", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    await googleTtsService.synthesize({
      text: "Hello",
      locale: "en",
      clinicalVoice: {
        speech_rate: 0.7,
        pitch: 1.3,
        pause_scale: 1.4,
        stability: 0.62,
        similarity_boost: 0.72,
        style: 0.15,
      },
    });

    const audioConfig = bodyOf(calls[0]!).audioConfig;
    expect(audioConfig).toEqual({ audioEncoding: "MP3" });
  });

  it("sends speakingRate when the escape hatch is enabled", async () => {
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    process.env.GOOGLE_TTS_ENABLE_SPEAKING_RATE = "true";
    const { calls, fn } = captureFetch(() => okResponse());
    vi.stubGlobal("fetch", fn);

    await googleTtsService.synthesize({
      text: "Hello",
      locale: "en",
      clinicalVoice: { speech_rate: 0.7 },
    });

    expect(bodyOf(calls[0]!).audioConfig).toEqual({
      audioEncoding: "MP3",
      speakingRate: 0.7,
    });
  });

  it("resolveVoiceId exposes the configured default per locale", () => {
    expect(googleTtsService.resolveVoiceId({ locale: "ar" })).toBe(
      "ar-XA-Chirp3-HD-Kore",
    );
    expect(googleTtsService.resolveVoiceId({ locale: "en" })).toBe(
      "en-US-Chirp3-HD-Kore",
    );
  });
});
