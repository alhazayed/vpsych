import { describe, expect, it } from "vitest";
import {
  azureSpeechLocale,
  browserSpeechLocale,
  isValidElevenLabsVoiceId,
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

  it("ignores path-injecting / malformed client voice ids and falls back to the default", () => {
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceId: "../voices" }),
    ).toBe(DEFAULT_ELEVENLABS_VOICE_EN);
    expect(
      resolveElevenLabsVoiceId({
        locale: "ar",
        voiceIdAr: "../../v1/user/subscription",
      }),
    ).toBe(DEFAULT_ELEVENLABS_VOICE_AR);
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceId: "bad id!" }),
    ).toBe(DEFAULT_ELEVENLABS_VOICE_EN);
  });

  it("passes through well-formed voice ids", () => {
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceId: "EXAVITQu4vr4xnSDxMaL" }),
    ).toBe("EXAVITQu4vr4xnSDxMaL");
  });
});

describe("isValidElevenLabsVoiceId", () => {
  it("accepts opaque alphanumeric ids", () => {
    expect(isValidElevenLabsVoiceId("EXAVITQu4vr4xnSDxMaL")).toBe(true);
    expect(isValidElevenLabsVoiceId("pNInz6obpgDQGcFmaJgB")).toBe(true);
  });

  it("rejects ids with path separators, dots, spaces, or empty values", () => {
    expect(isValidElevenLabsVoiceId("../voices")).toBe(false);
    expect(isValidElevenLabsVoiceId("a/b/c")).toBe(false);
    expect(isValidElevenLabsVoiceId("voice.id")).toBe(false);
    expect(isValidElevenLabsVoiceId("has space")).toBe(false);
    expect(isValidElevenLabsVoiceId("")).toBe(false);
    expect(isValidElevenLabsVoiceId("ab")).toBe(false);
    expect(isValidElevenLabsVoiceId(null)).toBe(false);
    expect(isValidElevenLabsVoiceId(undefined)).toBe(false);
  });
});
