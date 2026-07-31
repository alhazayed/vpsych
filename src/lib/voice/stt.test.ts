import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildTranscribeFormData,
  emptyAudioError,
  guessAudioExtension,
  notConfiguredError,
  openAISpeechLanguage,
  parseTranscribeResponse,
  speechLocaleTag,
} from "@/lib/voice/stt";

describe("openAISpeechLanguage", () => {
  it("maps session.language Arabic tags to ar", () => {
    expect(openAISpeechLanguage("ar")).toBe("ar");
    expect(openAISpeechLanguage("ar-JO")).toBe("ar");
    expect(openAISpeechLanguage("AR")).toBe("ar");
  });

  it("maps English / unknown to en", () => {
    expect(openAISpeechLanguage("en")).toBe("en");
    expect(openAISpeechLanguage("en-US")).toBe("en");
    expect(openAISpeechLanguage(null)).toBe("en");
  });
});

describe("speechLocaleTag", () => {
  it("returns BCP-47 tags for responses", () => {
    expect(speechLocaleTag("ar")).toBe("ar-JO");
    expect(speechLocaleTag("en")).toBe("en-US");
  });
});

describe("guessAudioExtension", () => {
  it("detects common microphone mime types", () => {
    expect(guessAudioExtension("audio/wav")).toBe("wav");
    expect(guessAudioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(guessAudioExtension("audio/mpeg")).toBe("mp3");
    expect(guessAudioExtension("")).toBe("wav");
  });
});

describe("buildTranscribeFormData", () => {
  it("preserves Voice Session multipart contract", () => {
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
    const form = buildTranscribeFormData({
      audio,
      locale: "ar-JO",
    });
    expect(form.get("locale")).toBe("ar-JO");
    const file = form.get("audio");
    expect(file).toBeInstanceOf(Blob);
  });
});

describe("parseTranscribeResponse", () => {
  it("reads successful OpenAI payload", () => {
    expect(
      parseTranscribeResponse({
        transcript: "  hello  ",
        provider: "openai",
      }),
    ).toEqual({
      transcript: "hello",
      provider: "openai",
      error: undefined,
      code: undefined,
    });
  });

  it("reads error payload", () => {
    expect(
      parseTranscribeResponse({
        error: "missing key",
        code: "STT_UNAVAILABLE",
      }),
    ).toMatchObject({
      transcript: "",
      error: "missing key",
      code: "STT_UNAVAILABLE",
    });
  });
});

describe("STT error helpers", () => {
  it("reports configuration and empty-audio failures", () => {
    expect(notConfiguredError()).toMatchObject({
      code: "STT_UNAVAILABLE",
      status: 501,
    });
    expect(emptyAudioError()).toMatchObject({
      code: "NO_AUDIO",
      status: 400,
    });
  });
});

describe("transcribe route OpenAI-only behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 501 when OPENAI_API_KEY is missing", async () => {
    vi.resetModules();
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: { id: "u1" } } }),
        },
      }),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: () => ({ ok: true }),
    }));

    const { POST } = await import("@/app/api/voice/transcribe/route");
    const form = new FormData();
    form.append(
      "audio",
      new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      "t.wav",
    );
    form.append("locale", "en");
    const res = await POST(
      new Request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.code).toBe("STT_UNAVAILABLE");

    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });

  it("transcribes Arabic and English via OpenAI service", async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-key";

    const speechToText = vi.fn(async (params: { language?: string }) => ({
      transcript:
        params.language === "ar" ? "مرحبا" : "hello therapist",
      model: "gpt-4o-transcribe",
      provider: "openai" as const,
      language: params.language,
    }));

    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: { id: "u1" } } }),
        },
      }),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      rateLimit: () => ({ ok: true }),
    }));
    vi.doMock("@/lib/ai/openai", () => ({
      hasOpenAIApiKey: () => true,
      openAIService: { speechToText },
      OpenAIServiceError: class OpenAIServiceError extends Error {
        code = "OPENAI_API";
        status = 502;
      },
    }));

    const { POST } = await import("@/app/api/voice/transcribe/route");

    async function call(locale: string) {
      const form = new FormData();
      form.append(
        "audio",
        new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }),
        "turn.wav",
      );
      form.append("locale", locale);
      return POST(
        new Request("http://localhost/api/voice/transcribe", {
          method: "POST",
          body: form,
        }),
      );
    }

    const en = await call("en-US");
    expect(en.status).toBe(200);
    await expect(en.json()).resolves.toMatchObject({
      transcript: "hello therapist",
      provider: "openai",
      language: "en",
      locale: "en-US",
    });

    const ar = await call("ar");
    expect(ar.status).toBe(200);
    await expect(ar.json()).resolves.toMatchObject({
      transcript: "مرحبا",
      provider: "openai",
      language: "ar",
      locale: "ar-JO",
    });

    expect(speechToText).toHaveBeenCalledTimes(2);
    expect(speechToText.mock.calls[0]?.[0]).toMatchObject({ language: "en" });
    expect(speechToText.mock.calls[1]?.[0]).toMatchObject({ language: "ar" });
  });
});
