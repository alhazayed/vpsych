import { describe, expect, it } from "vitest";
import {
  azureSpeechLocale,
  browserSpeechLocale,
  normalizeSpeechLocale,
  resolveElevenLabsVoiceId,
  DEFAULT_ELEVENLABS_VOICE_AR,
  DEFAULT_ELEVENLABS_VOICE_EN,
} from "@/lib/voice/config";

describe("normalizeSpeechLocale", () => {
  it("maps Arabic tags to ar", () => {
    expect(normalizeSpeechLocale("ar")).toBe("ar");
    expect(normalizeSpeechLocale("ar-JO")).toBe("ar");
    expect(normalizeSpeechLocale("AR-SA")).toBe("ar");
  });

  it("defaults to en", () => {
    expect(normalizeSpeechLocale(undefined)).toBe("en");
    expect(normalizeSpeechLocale("en-US")).toBe("en");
  });
});

describe("provider locale tags", () => {
  it("uses Azure/browser locale tags", () => {
    expect(azureSpeechLocale("ar")).toBe("ar-JO");
    expect(azureSpeechLocale("en")).toBe("en-US");
    expect(browserSpeechLocale("ar")).toBe("ar-SA");
  });
});

describe("resolveElevenLabsVoiceId", () => {
  it("picks Arabic vs English voice ids", () => {
    expect(
      resolveElevenLabsVoiceId({
        locale: "en",
        voiceId: "en-voice",
        voiceIdAr: "ar-voice",
      }),
    ).toBe("en-voice");
    expect(
      resolveElevenLabsVoiceId({
        locale: "ar",
        voiceId: "en-voice",
        voiceIdAr: "ar-voice",
      }),
    ).toBe("ar-voice");
  });

  it("falls back to defaults", () => {
    expect(resolveElevenLabsVoiceId({ locale: "en" })).toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
    expect(resolveElevenLabsVoiceId({ locale: "ar" })).toBe(
      DEFAULT_ELEVENLABS_VOICE_AR,
    );
  });
});
