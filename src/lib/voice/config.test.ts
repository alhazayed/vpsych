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
import {
  VoiceLanguageError,
  trustedVoiceLanguage,
} from "@/lib/voice/voice-language";

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
  // Fixtures are real, language-verified ids: the resolver now checks the
  // voice's verified language, so a placeholder id is (correctly) approved for
  // nothing. EN = Bella, AR = Omars.
  const EN = "hpp4J3VqNfWAUOO0d1Us";
  const AR = "HJ8unGw6UFYkApOU0Oea";

  it("picks Arabic vs English voice ids", () => {
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceId: EN, voiceIdAr: AR }),
    ).toBe(EN);
    expect(
      resolveElevenLabsVoiceId({ locale: "ar", voiceId: EN, voiceIdAr: AR }),
    ).toBe(AR);
  });

  it("falls back to the English default, which is a verified English voice", () => {
    expect(resolveElevenLabsVoiceId({ locale: "en" })).toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
  });

  it("refuses the Arabic default because it is a verified English voice", () => {
    // DEFAULT_ELEVENLABS_VOICE_AR is "Adam - Dominant, Firm" (language en).
    // Speaking Arabic with it is the defect this guard exists to stop, so with
    // no other Arabic candidate the resolver raises rather than returning it.
    expect(() => resolveElevenLabsVoiceId({ locale: "ar" })).toThrow(
      VoiceLanguageError,
    );
    expect(trustedVoiceLanguage(DEFAULT_ELEVENLABS_VOICE_AR)).toBe("en");
  });

  it("ignores path-injecting / malformed client voice ids and falls back to the default", () => {
    expect(resolveElevenLabsVoiceId({ locale: "en", voiceId: "../voices" })).toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
    expect(resolveElevenLabsVoiceId({ locale: "en", voiceId: "bad id!" })).toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
    // Same rejection on the Arabic side; it surfaces as the language error only
    // because no valid Arabic default is configured to fall through to.
    expect(() =>
      resolveElevenLabsVoiceId({
        locale: "ar",
        voiceIdAr: "../../v1/user/subscription",
      }),
    ).toThrow(VoiceLanguageError);
  });

  it("passes through well-formed, language-verified voice ids", () => {
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceId: "EXAVITQu4vr4xnSDxMaL" }),
    ).toBe("EXAVITQu4vr4xnSDxMaL");
  });

  it("rejects a well-formed id whose verified language is the other locale", () => {
    // Sarah is a verified English voice sitting in the Arabic slot — exactly
    // the production state that produced English speech on Arabic turns.
    expect(() =>
      resolveElevenLabsVoiceId({
        locale: "ar",
        voiceIdAr: "EXAVITQu4vr4xnSDxMaL",
      }),
    ).toThrow(VoiceLanguageError);
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
