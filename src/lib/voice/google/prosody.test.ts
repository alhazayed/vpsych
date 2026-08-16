import { describe, expect, it } from "vitest";
import { googleProsodyFromClinicalVoice } from "@/lib/voice/google/prosody";

const CHIRP_AR = "ar-XA-Chirp3-HD-Kore";
const CHIRP_EN = "en-US-Chirp3-HD-Kore";
const NEURAL_EN = "en-US-Neural2-A";

function reasons(
  result: ReturnType<typeof googleProsodyFromClinicalVoice>,
): Record<string, string> {
  return Object.fromEntries(result.unsupported.map((u) => [u.signal, u.reason]));
}

describe("speech_rate → speakingRate", () => {
  it("is withheld when the feature is not enabled, and says so", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_EN,
      languageCode: "en-US",
      speechRate: 0.75,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.applied).toEqual([]);
    // Not "unsupported by the provider" — just not switched on yet.
    expect(reasons(result).speech_rate).toBe("not_enabled");
  });

  it("maps 1:1 for Chirp 3 HD when enabled — Google documents pace control", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_EN,
      languageCode: "en-US",
      speechRate: 0.75,
      enableSpeakingRate: true,
    });
    expect(result.audioConfig.speakingRate).toBe(0.75);
    expect(result.applied).toContain("speech_rate");
  });

  it("works for Arabic ar-XA — pace control covers all locales", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      speechRate: 1.35,
      enableSpeakingRate: true,
    });
    expect(result.audioConfig.speakingRate).toBe(1.35);
    expect(result.applied).toContain("speech_rate");
  });

  it("clamps into Google's documented 0.25–2.0 range", () => {
    const fast = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_EN,
      languageCode: "en-US",
      speechRate: 5,
      enableSpeakingRate: true,
    });
    expect(fast.audioConfig.speakingRate).toBe(2);

    const slow = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_EN,
      languageCode: "en-US",
      speechRate: 0.05,
      enableSpeakingRate: true,
    });
    expect(slow.audioConfig.speakingRate).toBe(0.25);
  });

  it("omits the field at the clinical baseline", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_EN,
      languageCode: "en-US",
      speechRate: 1,
      enableSpeakingRate: true,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.unsupported).toEqual([]);
  });
});

describe("pitch → semitones", () => {
  it("is never sent to a Chirp 3 HD voice, which rejects the parameter", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      pitch: 1.3,
      enableSpeakingRate: true,
    });
    expect(result.audioConfig.pitch).toBeUndefined();
    expect(reasons(result).pitch).toBe("voice_rejects_parameter");
  });

  it("converts the clinical ratio with 12·log2 for a capable voice", () => {
    expect(
      googleProsodyFromClinicalVoice({
        voiceName: NEURAL_EN,
        languageCode: "en-US",
        pitch: 2,
      }).audioConfig.pitch,
    ).toBe(12);
    expect(
      googleProsodyFromClinicalVoice({
        voiceName: NEURAL_EN,
        languageCode: "en-US",
        pitch: 0.5,
      }).audioConfig.pitch,
    ).toBe(-12);
    expect(
      googleProsodyFromClinicalVoice({
        voiceName: NEURAL_EN,
        languageCode: "en-US",
        pitch: 1.2,
      }).audioConfig.pitch,
    ).toBeCloseTo(3.16, 1);
  });

  it("clamps into the documented -20..20 semitone range", () => {
    expect(
      googleProsodyFromClinicalVoice({
        voiceName: NEURAL_EN,
        languageCode: "en-US",
        pitch: 100,
      }).audioConfig.pitch,
    ).toBe(20);
  });
});

describe("pause_scale", () => {
  it("is reported as markup-handled when enabled, never as audioConfig", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      pauseScale: 1.7,
      enablePauseControl: true,
    });
    expect(result.audioConfig).toEqual({});
    expect(reasons(result).pause_scale).toBe("handled_as_markup");
  });

  it("is reported as not-enabled when the flag is off", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      pauseScale: 1.7,
    });
    expect(reasons(result).pause_scale).toBe("not_enabled");
  });

  it("is reported as provider-rejected for a voice without markup support", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: NEURAL_EN,
      languageCode: "en-US",
      pauseScale: 1.7,
      enablePauseControl: true,
    });
    expect(reasons(result).pause_scale).toBe("voice_rejects_parameter");
  });

  it("is ignored at baseline", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      pauseScale: 1,
      enablePauseControl: true,
    });
    expect(result.unsupported).toEqual([]);
  });
});

describe("ElevenLabs-only controls", () => {
  it("never invents an equivalent for stability, similarity_boost, or style", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      stability: 0.3,
      similarityBoost: 0.7,
      style: 0.45,
      enableSpeakingRate: true,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.applied).toEqual([]);
    expect(result.unsupported.map((u) => u.signal)).toEqual([
      "stability",
      "similarity_boost",
      "style",
    ]);
    for (const u of result.unsupported) {
      expect(u.reason).toBe("provider_has_no_equivalent");
    }
  });
});

describe("full clinical payload on a Chirp 3 HD Arabic voice", () => {
  it("applies only pace, and reports every other signal honestly", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_AR,
      languageCode: "ar-XA",
      speechRate: 0.8,
      pitch: 1.25,
      pauseScale: 1.7,
      stability: 0.62,
      similarityBoost: 0.72,
      style: 0.15,
      enableSpeakingRate: true,
      enablePauseControl: true,
    });

    expect(result.audioConfig).toEqual({ speakingRate: 0.8 });
    expect(result.applied).toEqual(["speech_rate"]);
    expect(reasons(result)).toEqual({
      pitch: "voice_rejects_parameter",
      pause_scale: "handled_as_markup",
      stability: "provider_has_no_equivalent",
      similarity_boost: "provider_has_no_equivalent",
      style: "provider_has_no_equivalent",
    });
  });
});

describe("input hygiene", () => {
  it("ignores absent or non-finite clinical values", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP_EN,
      languageCode: "en-US",
      speechRate: null,
      pitch: undefined,
      pauseScale: Number.NaN,
      enableSpeakingRate: true,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.unsupported).toEqual([]);
  });
});
