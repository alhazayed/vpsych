/**
 * Cross-language voice integrity.
 *
 * The defect these tests lock out: the resolver matched the session locale
 * against `voice_profiles.language` — a label — and never against the language
 * the voice actually speaks. Production therefore served English speech on
 * Arabic turns through three separate paths (an Arabic-labelled profile holding
 * an English voice, an Arabic legacy column holding an English voice, and an
 * Arabic default that is an English voice).
 *
 * Every test here asserts the same invariant from a different entry point:
 * a voice verified as one language is never spoken on the other.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ELEVENLABS_VOICE_AR,
  DEFAULT_ELEVENLABS_VOICE_EN,
  resolveElevenLabsVoiceId,
} from "@/lib/voice/config";
import { resolveAvatarSpeechVoice } from "@/lib/voice/registry";
import {
  VoiceLanguageError,
  approvedVoicesFor,
  isVoiceApprovedFor,
  trustedVoiceLanguage,
} from "@/lib/voice/voice-language";
import type { VoiceProfile } from "@/lib/types";

// Verified ids, transcribed from ElevenLabs workspace metadata.
const AR_OMARS = "HJ8unGw6UFYkApOU0Oea";
const AR_AMIRA = "cdxrkuYK4nZwDSkjw5sa";
const EN_SARAH = "EXAVITQu4vr4xnSDxMaL";
const EN_BELLA = "hpp4J3VqNfWAUOO0d1Us";
const UNVERIFIED = "UnknownVoiceIdAAAAAA";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

function profile(
  voiceId: string,
  language: string,
  isActive = true,
): VoiceProfile {
  return {
    id: "a1000000-0000-4000-8000-00000000000f",
    provider: "elevenlabs",
    voice_name: "fixture",
    voice_id: voiceId,
    language,
    dialect: null,
    gender: "female",
    is_active: isActive,
    created_at: "2026-08-26T00:00:00.000Z",
  } as VoiceProfile;
}

describe("trusted voice language classification", () => {
  it("classifies verified ids and refuses to classify unknown ones", () => {
    expect(trustedVoiceLanguage(AR_OMARS)).toBe("ar");
    expect(trustedVoiceLanguage(EN_SARAH)).toBe("en");
    // Fail-closed: an id nobody verified has no language, so it is approved
    // for nothing rather than being assumed to match the slot it sits in.
    expect(trustedVoiceLanguage(UNVERIFIED)).toBeNull();
    expect(trustedVoiceLanguage(null)).toBeNull();
    expect(trustedVoiceLanguage("")).toBeNull();
    expect(isVoiceApprovedFor(UNVERIFIED, "ar")).toBe(false);
    expect(isVoiceApprovedFor(UNVERIFIED, "en")).toBe(false);
  });

  it("records the production defaults truthfully", () => {
    // These two facts are the defect, stated as assertions.
    expect(trustedVoiceLanguage(DEFAULT_ELEVENLABS_VOICE_EN)).toBe("en");
    expect(trustedVoiceLanguage(DEFAULT_ELEVENLABS_VOICE_AR)).toBe("en");
  });

  it("lists approved voices per locale", () => {
    expect(approvedVoicesFor("ar")).toContain(AR_OMARS);
    expect(approvedVoicesFor("ar")).not.toContain(EN_SARAH);
    expect(approvedVoicesFor("en")).toContain(EN_SARAH);
    expect(approvedVoicesFor("en")).not.toContain(AR_OMARS);
  });
});

describe("same-language resolution still works", () => {
  it("Arabic session + valid Arabic voice → PASS (1)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;
    expect(resolveElevenLabsVoiceId({ locale: "ar" })).toBe(AR_OMARS);
    expect(
      resolveAvatarSpeechVoice({ locale: "ar", voiceProfile: profile(AR_AMIRA, "ar") })
        .voiceId,
    ).toBe(AR_AMIRA);
  });

  it("English session + valid English voice → PASS (2)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_BELLA;
    expect(resolveElevenLabsVoiceId({ locale: "en" })).toBe(EN_BELLA);
    expect(
      resolveAvatarSpeechVoice({ locale: "en", voiceProfile: profile(EN_SARAH, "en") })
        .voiceId,
    ).toBe(EN_SARAH);
  });
});

describe("cross-language assignment is impossible", () => {
  it("Arabic session + English voice in an Arabic-labelled profile → REJECT (3)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;

    // This is verbatim the production "Amira (Bella)" row: language 'ar',
    // voice_id an English voice. The label must not be enough to win.
    const resolved = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceProfile: profile(EN_SARAH, "ar"),
    });

    expect(resolved.voiceId).not.toBe(EN_SARAH);
    expect(resolved.voiceId).toBe(AR_OMARS);
    expect(resolved.source).not.toBe("voice_profile");
  });

  it("English session + Arabic voice in an English-labelled profile → REJECT (4)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_BELLA;

    const resolved = resolveAvatarSpeechVoice({
      locale: "en",
      voiceProfile: profile(AR_OMARS, "en"),
    });

    expect(resolved.voiceId).not.toBe(AR_OMARS);
    expect(resolved.voiceId).toBe(EN_BELLA);
  });

  it("Arabic session + English legacy voice_id_ar → REJECT (5)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;

    // maya-chen.voice_id_ar holds an English voice in production.
    const resolved = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceIdAr: EN_SARAH,
    });

    expect(resolved.voiceId).toBe(AR_OMARS);
    expect(resolved.voiceId).not.toBe(EN_SARAH);
  });

  it("English session + Arabic legacy voice_id → REJECT (6)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_BELLA;

    const resolved = resolveAvatarSpeechVoice({
      locale: "en",
      voiceId: AR_OMARS,
    });

    expect(resolved.voiceId).toBe(EN_BELLA);
    expect(resolved.voiceId).not.toBe(AR_OMARS);
  });

  it("Arabic session + invalid Arabic default → error, never an English voice (7)", () => {
    delete process.env.ELEVENLABS_VOICE_ID_AR;

    // Nothing approved for Arabic anywhere in the chain.
    expect(() => resolveElevenLabsVoiceId({ locale: "ar" })).toThrow(
      VoiceLanguageError,
    );
    try {
      resolveElevenLabsVoiceId({ locale: "ar" });
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceLanguageError);
      expect((error as VoiceLanguageError).locale).toBe("ar");
      expect((error as VoiceLanguageError).status).toBe(503);
      expect((error as VoiceLanguageError).code).toBe(
        "VOICE_LANGUAGE_UNAVAILABLE",
      );
    }
  });

  it("English session + invalid English default → error, never an Arabic voice (8)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = AR_OMARS; // misconfigured on purpose
    // The env override is an Arabic voice; the built-in English default is
    // still valid, so English falls through to it rather than speaking Arabic.
    expect(resolveElevenLabsVoiceId({ locale: "en" })).toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
    expect(resolveElevenLabsVoiceId({ locale: "en" })).not.toBe(AR_OMARS);
  });

  it("client-supplied cross-language voice → REJECT (9)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;
    process.env.ELEVENLABS_VOICE_ID_EN = EN_BELLA;

    // Even an id that passes the registry allow-list in resolveTtsVoice cannot
    // reach the wrong locale: the language gate is downstream of it.
    expect(
      resolveElevenLabsVoiceId({ locale: "ar", voiceIdAr: EN_SARAH }),
    ).toBe(AR_OMARS);
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceId: AR_OMARS }),
    ).toBe(EN_BELLA);
  });

  it("valid same-language client/config path still passes (10)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;
    expect(
      resolveElevenLabsVoiceId({ locale: "ar", voiceIdAr: AR_AMIRA }),
    ).toBe(AR_AMIRA);
  });

  it("precedence order is unchanged for same-language candidates (11)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;

    // profile > legacy > env, all Arabic, all approved.
    expect(
      resolveAvatarSpeechVoice({
        locale: "ar",
        voiceProfile: profile(AR_AMIRA, "ar"),
        voiceIdAr: AR_OMARS,
      }).source,
    ).toBe("voice_profile");
    expect(
      resolveAvatarSpeechVoice({ locale: "ar", voiceIdAr: AR_AMIRA }).source,
    ).toBe("legacy_column");
    expect(resolveAvatarSpeechVoice({ locale: "ar" }).source).toBe(
      "env_default",
    );
  });

  it("malformed voice ids remain rejected by the format gate (12)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_OMARS;
    for (const bad of ["../secret", "a/b", "has space", "ab", ""]) {
      expect(
        resolveElevenLabsVoiceId({ locale: "ar", voiceIdAr: bad }),
      ).toBe(AR_OMARS);
    }
  });
});
