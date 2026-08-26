/**
 * Language-specific voice routing contract.
 *
 * Locks the guarantee that a session's speech locale — and only the locale —
 * decides which ElevenLabs voice is used, so an Arabic session can be given a
 * dedicated Arabic voice without touching English.
 *
 * These tests assert the *contract*, not a particular voice id, so they stay
 * valid whichever Arabic voice is ultimately cast. They also pin the
 * precedence order, because that order decides whether configuring
 * `ELEVENLABS_VOICE_ID_AR` has any effect at all for a given avatar:
 *
 *   active same-language voice_profile  >  legacy voice_id / voice_id_ar
 *                                       >  env override  >  built-in default
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ELEVENLABS_VOICE_AR,
  DEFAULT_ELEVENLABS_VOICE_EN,
  resolveElevenLabsVoiceId,
} from "@/lib/voice/config";
import { resolveAvatarSpeechVoice } from "@/lib/voice/registry";
import type { VoiceProfile } from "@/lib/types";

const AR_VOICE = "ArabicVoiceIdAAAAAAA";
const EN_VOICE = "EnglishVoiceIdAAAAAA";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

function arProfile(voiceId: string, isActive = true): VoiceProfile {
  return {
    id: "a1000000-0000-4000-8000-000000000003",
    provider: "elevenlabs",
    voice_name: "Arabic profile",
    voice_id: voiceId,
    language: "ar",
    dialect: "Levantine Arabic",
    gender: "female",
    is_active: isActive,
    created_at: "2026-08-25T00:00:00.000Z",
  };
}

describe("language-specific voice routing", () => {
  it("an English session resolves the English voice (1)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_VOICE;
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    expect(resolveElevenLabsVoiceId({ locale: "en" })).toBe(EN_VOICE);
    expect(resolveAvatarSpeechVoice({ locale: "en" }).voiceId).toBe(EN_VOICE);
  });

  it("an Arabic session resolves the Arabic voice (2)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_VOICE;
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    expect(resolveElevenLabsVoiceId({ locale: "ar" })).toBe(AR_VOICE);
    expect(resolveAvatarSpeechVoice({ locale: "ar" }).voiceId).toBe(AR_VOICE);
  });

  it("Arabic never falls back to the English voice once an Arabic voice is configured (3)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_VOICE;
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    // Every Arabic entry point, including one carrying an English legacy id.
    expect(resolveElevenLabsVoiceId({ locale: "ar" })).not.toBe(EN_VOICE);
    expect(
      resolveElevenLabsVoiceId({ locale: "ar", voiceId: EN_VOICE }),
    ).toBe(AR_VOICE);
    expect(
      resolveAvatarSpeechVoice({ locale: "ar", voiceId: EN_VOICE }).voiceId,
    ).toBe(AR_VOICE);
    expect(resolveAvatarSpeechVoice({ locale: "ar" }).voiceId).not.toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
  });

  it("English never accidentally resolves the Arabic voice (4)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_VOICE;
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceIdAr: AR_VOICE }),
    ).toBe(EN_VOICE);
    // An Arabic registry profile must not win on an English turn.
    expect(
      resolveAvatarSpeechVoice({
        locale: "en",
        voiceProfile: arProfile(AR_VOICE),
      }).voiceId,
    ).toBe(EN_VOICE);
  });

  it("rejects malformed voice ids and falls back rather than passing them upstream (5)", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    for (const bad of ["../secret", "a/b", "sh rt", "", "x".repeat(65)]) {
      expect(
        resolveElevenLabsVoiceId({ locale: "ar", voiceIdAr: bad }),
      ).toBe(AR_VOICE);
    }
  });

  it("a client-supplied id can only ever land in its own locale slot (6)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_VOICE;
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    // The Arabic slot is the only thing an Arabic turn will read, so a client
    // id planted in the English slot cannot be spoken on an Arabic turn.
    const attacker = "AttackerChosenVoice1";
    expect(
      resolveElevenLabsVoiceId({ locale: "ar", voiceId: attacker }),
    ).toBe(AR_VOICE);
    expect(
      resolveElevenLabsVoiceId({ locale: "en", voiceIdAr: attacker }),
    ).toBe(EN_VOICE);
  });

  it("mixed-language content cannot switch the voice mid-response (7)", () => {
    process.env.ELEVENLABS_VOICE_ID_EN = EN_VOICE;
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    // Resolution is a pure function of locale: it takes no text argument at
    // all, so one response is always spoken by exactly one voice.
    const first = resolveAvatarSpeechVoice({ locale: "ar" });
    const second = resolveAvatarSpeechVoice({ locale: "ar" });

    expect(first.voiceId).toBe(AR_VOICE);
    expect(second.voiceId).toBe(first.voiceId);
    expect(first.locale).toBe("ar");
    // Guard the shape itself — adding a text/content parameter would be the
    // change that could make a single turn switch voices.
    expect(resolveAvatarSpeechVoice.length).toBe(1);
  });

  it("keeps the resolution result shape the TTS route depends on (8)", () => {
    const resolved = resolveAvatarSpeechVoice({ locale: "ar" });

    expect(resolved).toMatchObject({
      voiceId: expect.any(String),
      source: expect.any(String),
      provider: "elevenlabs",
      locale: "ar",
    });
    expect(["voice_profile", "legacy_column", "env_default"]).toContain(
      resolved.source,
    );
  });
});

describe("voice precedence — why an env override can be inert", () => {
  it("an active same-language voice_profile outranks the Arabic env override", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;
    const profileVoice = "ProfileVoiceIdAAAAAA";

    const resolved = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceProfile: arProfile(profileVoice),
    });

    // Setting ELEVENLABS_VOICE_ID_AR does NOT reach an avatar that has an
    // active Arabic voice_profile — that avatar's profile wins.
    expect(resolved.voiceId).toBe(profileVoice);
    expect(resolved.voiceId).not.toBe(AR_VOICE);
    expect(resolved.source).toBe("voice_profile");
  });

  it("a legacy voice_id_ar column also outranks the Arabic env override", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;
    const legacy = "LegacyArVoiceIdAAAAA";

    const resolved = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceIdAr: legacy,
    });

    expect(resolved.voiceId).toBe(legacy);
    expect(resolved.source).toBe("legacy_column");
  });

  it("the env override applies only when neither profile nor legacy column is set", () => {
    process.env.ELEVENLABS_VOICE_ID_AR = AR_VOICE;

    const resolved = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceProfile: arProfile("InactiveVoiceIdAAAAA", false),
    });

    expect(resolved.voiceId).toBe(AR_VOICE);
    expect(resolved.source).toBe("env_default");
  });

  it("with nothing configured at all, Arabic uses the built-in Arabic default", () => {
    delete process.env.ELEVENLABS_VOICE_ID_AR;
    delete process.env.ELEVENLABS_VOICE_ID_EN;

    expect(resolveAvatarSpeechVoice({ locale: "ar" }).voiceId).toBe(
      DEFAULT_ELEVENLABS_VOICE_AR,
    );
    expect(resolveAvatarSpeechVoice({ locale: "en" }).voiceId).toBe(
      DEFAULT_ELEVENLABS_VOICE_EN,
    );
  });
});
