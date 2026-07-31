import { describe, expect, it } from "vitest";
import {
  clearLegacyColumnsFromProfile,
  coerceVoiceProfile,
  isActiveVoiceProfile,
  legacyColumnsFromProfile,
  projectAvatarVoiceFields,
  resolveAvatarSpeechVoice,
} from "@/lib/voice/registry";
import type { Avatar, VoiceProfile } from "@/lib/types";

const amira: VoiceProfile = {
  id: "a1000000-0000-4000-8000-000000000003",
  provider: "elevenlabs",
  voice_name: "Amira",
  voice_id: "cdxrkuYK4nZwDSkjw5sa",
  language: "ar",
  dialect: "Levantine Arabic",
  gender: "female",
  is_active: true,
  created_at: "2026-07-31T00:00:00.000Z",
};

const youssef: VoiceProfile = {
  id: "a1000000-0000-4000-8000-000000000001",
  provider: "elevenlabs",
  voice_name: "Youssef",
  voice_id: "ZCXYdzd5Evtsll2EdoCi",
  language: "ar",
  dialect: "Levantine Arabic",
  gender: "male",
  is_active: true,
  created_at: "2026-07-31T00:00:00.000Z",
};

describe("coerceVoiceProfile", () => {
  it("unwraps PostgREST array embeds", () => {
    expect(coerceVoiceProfile([amira])?.voice_name).toBe("Amira");
    expect(coerceVoiceProfile(amira)?.id).toBe(amira.id);
    expect(coerceVoiceProfile(null)).toBeNull();
  });
});

describe("isActiveVoiceProfile", () => {
  it("requires active flag and non-empty voice_id", () => {
    expect(isActiveVoiceProfile(amira)).toBe(true);
    expect(isActiveVoiceProfile({ ...amira, is_active: false })).toBe(false);
    expect(isActiveVoiceProfile({ ...amira, voice_id: "  " })).toBe(false);
  });
});

describe("resolveAvatarSpeechVoice", () => {
  it("uses active Arabic registry voice for Arabic locale", () => {
    const result = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceProfile: amira,
      voiceId: "legacy-en",
      voiceIdAr: "legacy-ar",
    });
    expect(result.source).toBe("voice_profile");
    expect(result.voiceId).toBe("cdxrkuYK4nZwDSkjw5sa");
    expect(result.voiceProfileId).toBe(amira.id);
  });

  it("falls back to English legacy column when Arabic profile is assigned", () => {
    const result = resolveAvatarSpeechVoice({
      locale: "en",
      voiceProfile: amira,
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      voiceIdAr: amira.voice_id,
    });
    expect(result.source).toBe("legacy_column");
    expect(result.voiceId).toBe("21m00Tcm4TlvDq8ikWAM");
  });

  it("falls back to env defaults without profile or legacy ids", () => {
    const result = resolveAvatarSpeechVoice({ locale: "en" });
    expect(result.source).toBe("env_default");
    expect(result.voiceId).toBeTruthy();
  });

  it("ignores inactive profiles", () => {
    const result = resolveAvatarSpeechVoice({
      locale: "ar",
      voiceProfile: { ...youssef, is_active: false },
      voiceIdAr: "legacy-ar",
    });
    expect(result.source).toBe("legacy_column");
    expect(result.voiceId).toBe("legacy-ar");
  });
});

describe("projectAvatarVoiceFields", () => {
  it("projects Arabic profile onto voice_id_ar", () => {
    const avatar = {
      voice_profile_id: amira.id,
      voice_profile: amira,
      voice_id: "en-legacy",
      voice_id_ar: "old-ar",
    } as Avatar;

    const projected = projectAvatarVoiceFields(avatar);
    expect(projected.voice_profile?.voice_name).toBe("Amira");
    expect(projected.voice_id_ar).toBe(amira.voice_id);
    expect(projected.voice_id).toBe("en-legacy");
  });
});

describe("legacyColumnsFromProfile", () => {
  it("maps language to the correct legacy column", () => {
    expect(legacyColumnsFromProfile(amira)).toEqual({
      voice_id_ar: amira.voice_id,
    });
    expect(
      legacyColumnsFromProfile({
        ...amira,
        language: "en",
        voice_id: "en-voice",
      }),
    ).toEqual({ voice_id: "en-voice" });
  });
});

describe("clearLegacyColumnsFromProfile", () => {
  it("nulls the language-specific legacy column on unassign", () => {
    expect(clearLegacyColumnsFromProfile(amira)).toEqual({
      voice_id_ar: null,
    });
    expect(
      clearLegacyColumnsFromProfile({
        ...amira,
        language: "en",
        voice_id: "en-voice",
      }),
    ).toEqual({ voice_id: null });
  });
});
