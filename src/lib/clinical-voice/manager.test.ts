import { describe, expect, it } from "vitest";
import {
  applyEmotionModulation,
  CLINICAL_EMOTIONS,
  DEFAULT_CLINICAL_VOICE_PARAMS,
  emotionFromDisorderSlug,
  emotionModulationFor,
  liveSwitchVoice,
  normalizeClinicalEmotion,
  resolveLiveEmotion,
  toClinicalVoiceProfile,
  validateClinicalVoiceParams,
} from "@/lib/clinical-voice";

const baseProfile = {
  id: "a1000000-0000-4000-8000-000000000001",
  provider: "elevenlabs",
  voice_name: "Youssef",
  voice_id: "pNInz6obpgDQGcFmaJgB",
  language: "en" as const,
  dialect: null,
  gender: "male",
  is_active: true,
  created_at: "2026-08-01T00:00:00Z",
  ...DEFAULT_CLINICAL_VOICE_PARAMS,
};

describe("Clinical Voice Profile Manager", () => {
  it("exposes the five clinical emotion bands", () => {
    expect(CLINICAL_EMOTIONS).toEqual([
      "neutral",
      "depressed",
      "anxious",
      "manic",
      "psychotic",
    ]);
  });

  it("maps depressed → slow + low energy", () => {
    const delta = emotionModulationFor("depressed");
    expect(delta.speech_rate_mul).toBeLessThan(1);
    expect(delta.energy).toBe("low");
    const applied = applyEmotionModulation(DEFAULT_CLINICAL_VOICE_PARAMS, "depressed");
    expect(applied.params.speech_rate).toBeLessThan(1);
    expect(applied.params.energy).toBe("low");
    expect(applied.params.prosody).toBe("flat");
  });

  it("maps anxious → faster + short breaths", () => {
    const applied = applyEmotionModulation(
      DEFAULT_CLINICAL_VOICE_PARAMS,
      "anxious",
    );
    expect(applied.params.speech_rate).toBeGreaterThan(1);
    expect(applied.params.breathing).toBe("short");
    expect(applied.params.prosody).toBe("anxious_edge");
  });

  it("maps manic → pressured speech", () => {
    const applied = applyEmotionModulation(
      DEFAULT_CLINICAL_VOICE_PARAMS,
      "manic",
    );
    expect(applied.params.speech_rate).toBeGreaterThan(1.2);
    expect(applied.params.prosody).toBe("pressured");
    expect(applied.params.hesitation_frequency).toBeLessThan(
      DEFAULT_CLINICAL_VOICE_PARAMS.hesitation_frequency,
    );
  });

  it("maps psychotic → inappropriate pauses", () => {
    const applied = applyEmotionModulation(
      DEFAULT_CLINICAL_VOICE_PARAMS,
      "psychotic",
    );
    expect(applied.pause_scale).toBeGreaterThan(1.4);
    expect(applied.params.prosody).toBe("fragmented");
    expect(applied.params.breathing).toBe("irregular");
  });

  it("live-switches without changing voice_id", () => {
    const depressed = liveSwitchVoice({
      profile: baseProfile,
      emotion: "depressed",
    });
    const manic = liveSwitchVoice({
      profile: baseProfile,
      emotion: "manic",
    });
    expect(depressed.voice_id).toBe(baseProfile.voice_id);
    expect(manic.voice_id).toBe(baseProfile.voice_id);
    expect(depressed.speech_rate).toBeLessThan(manic.speech_rate);
    expect(depressed.elevenlabs.stability).toBeGreaterThan(
      manic.elevenlabs.stability,
    );
    expect(depressed.emotion).toBe("depressed");
    expect(manic.emotion).toBe("manic");
  });

  it("infers emotion from disorder slug when emotion omitted", () => {
    expect(emotionFromDisorderSlug("mdd-recurrent-moderate")).toBe(
      "depressed",
    );
    expect(emotionFromDisorderSlug("bipolar-mania")).toBe("manic");
    expect(emotionFromDisorderSlug("schizophrenia")).toBe("psychotic");
    expect(emotionFromDisorderSlug("gad-with-panic")).toBe("anxious");
    expect(resolveLiveEmotion({ disorderSlug: "bipolar-mania" })).toBe(
      "manic",
    );
  });

  it("skips modulation when emotion_modulation is false", () => {
    const off = {
      ...baseProfile,
      emotion_modulation: false,
      speech_rate: 1.05,
    };
    const live = liveSwitchVoice({ profile: off, emotion: "manic" });
    expect(live.speech_rate).toBe(1.05);
    expect(live.prosody).toBe(off.prosody);
  });

  it("validates and clamps clinical params", () => {
    const bad = validateClinicalVoiceParams({ energy: "explode" });
    expect(bad.ok).toBe(false);
    const good = validateClinicalVoiceParams({
      speech_rate: 9,
      pitch: 0.1,
      hesitation_frequency: 2,
      speaker_boost: -1,
      energy: "high",
      prosody: "pressured",
      breathing: "short",
      emotion_modulation: true,
      pronunciation_ar: "  Levantine  ",
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.value.speech_rate).toBe(1.8);
      expect(good.value.pitch).toBe(0.5);
      expect(good.value.hesitation_frequency).toBe(1);
      expect(good.value.speaker_boost).toBe(0);
      expect(good.value.pronunciation_ar).toBe("Levantine");
    }
  });

  it("normalizes emotion aliases", () => {
    expect(normalizeClinicalEmotion("Depression")).toBe("depressed");
    expect(normalizeClinicalEmotion("panic")).toBe("anxious");
    expect(normalizeClinicalEmotion("nope")).toBeNull();
  });

  it("projects DB rows into clinical profiles with defaults", () => {
    const profile = toClinicalVoiceProfile({
      id: baseProfile.id,
      provider: "elevenlabs",
      voice_name: "Test",
      voice_id: "abc",
      language: "ar",
      is_active: true,
      created_at: "2026-08-01T00:00:00Z",
    });
    expect(profile.speech_rate).toBe(1);
    expect(profile.emotion_modulation).toBe(true);
    expect(profile.speaker_boost).toBe(0.75);
  });
});
