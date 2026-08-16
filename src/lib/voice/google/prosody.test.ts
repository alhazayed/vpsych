import { describe, expect, it } from "vitest";
import {
  googleProsodyFromClinicalVoice,
  googleVoiceCapabilities,
} from "@/lib/voice/google/prosody";

const CHIRP = "ar-XA-Chirp3-HD-Kore";
const NEURAL = "en-US-Neural2-A";

function reasons(
  result: ReturnType<typeof googleProsodyFromClinicalVoice>,
): Record<string, string> {
  return Object.fromEntries(result.unsupported.map((u) => [u.signal, u.reason]));
}

describe("googleVoiceCapabilities", () => {
  it("marks Chirp voices as rejecting SSML, speakingRate, and pitch", () => {
    expect(googleVoiceCapabilities(CHIRP)).toEqual({
      speakingRate: false,
      pitch: false,
      ssml: false,
    });
    expect(googleVoiceCapabilities("en-US-Chirp3-HD-Puck").pitch).toBe(false);
  });

  it("allows the classic voice families to use rate and pitch", () => {
    expect(googleVoiceCapabilities(NEURAL)).toEqual({
      speakingRate: true,
      pitch: true,
      ssml: true,
    });
  });
});

describe("googleProsodyFromClinicalVoice", () => {
  it("applies nothing for a Chirp voice and reports every signal as unsupported", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP,
      speechRate: 0.75,
      pitch: 1.25,
      pauseScale: 1.35,
      stability: 0.62,
      similarityBoost: 0.72,
      style: 0.15,
    });

    expect(result.audioConfig).toEqual({});
    expect(result.applied).toEqual([]);
    expect(reasons(result)).toEqual({
      speech_rate: "voice_rejects_speaking_rate",
      pitch: "voice_rejects_pitch",
      pause_scale: "no_audioconfig_equivalent",
      stability: "provider_has_no_equivalent",
      similarity_boost: "provider_has_no_equivalent",
      style: "provider_has_no_equivalent",
    });
  });

  it("maps clinical speech_rate 1:1 onto speakingRate for a capable voice", () => {
    const slow = googleProsodyFromClinicalVoice({
      voiceName: NEURAL,
      speechRate: 0.75,
    });
    expect(slow.audioConfig.speakingRate).toBe(0.75);
    expect(slow.applied).toContain("speech_rate");

    const pressured = googleProsodyFromClinicalVoice({
      voiceName: NEURAL,
      speechRate: 1.35,
    });
    expect(pressured.audioConfig.speakingRate).toBe(1.35);
  });

  it("clamps speakingRate into Google's documented 0.25–2.0 range", () => {
    expect(
      googleProsodyFromClinicalVoice({ voiceName: NEURAL, speechRate: 5 })
        .audioConfig.speakingRate,
    ).toBe(2);
    expect(
      googleProsodyFromClinicalVoice({ voiceName: NEURAL, speechRate: 0.05 })
        .audioConfig.speakingRate,
    ).toBe(0.25);
  });

  it("converts the clinical pitch ratio to semitones (12·log2)", () => {
    // A doubling of frequency is exactly one octave = 12 semitones.
    expect(
      googleProsodyFromClinicalVoice({ voiceName: NEURAL, pitch: 2 })
        .audioConfig.pitch,
    ).toBe(12);
    // Halving is one octave down.
    expect(
      googleProsodyFromClinicalVoice({ voiceName: NEURAL, pitch: 0.5 })
        .audioConfig.pitch,
    ).toBe(-12);
    // A mild clinical lift.
    expect(
      googleProsodyFromClinicalVoice({ voiceName: NEURAL, pitch: 1.2 })
        .audioConfig.pitch,
    ).toBeCloseTo(3.16, 1);
  });

  it("clamps pitch into Google's documented -20..20 semitone range", () => {
    expect(
      googleProsodyFromClinicalVoice({ voiceName: NEURAL, pitch: 100 })
        .audioConfig.pitch,
    ).toBe(20);
  });

  it("omits parameters that sit at the clinical baseline", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: NEURAL,
      speechRate: 1,
      pitch: 1,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.applied).toEqual([]);
    // Baseline values are not "unsupported" — they are simply the default.
    expect(result.unsupported).toEqual([]);
  });

  it("never invents an equivalent for stability, similarity_boost, or style", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: NEURAL,
      stability: 0.3,
      similarityBoost: 0.7,
      style: 0.45,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.applied).toEqual([]);
    expect(result.unsupported.map((u) => u.signal)).toEqual([
      "stability",
      "similarity_boost",
      "style",
    ]);
  });

  it("honors the speakingRate escape hatch on a Chirp voice", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: CHIRP,
      speechRate: 0.8,
      allowSpeakingRate: true,
    });
    expect(result.audioConfig.speakingRate).toBe(0.8);
    expect(result.applied).toContain("speech_rate");
    // Pitch stays off — the escape hatch covers rate only.
    expect(result.audioConfig.pitch).toBeUndefined();
  });

  it("ignores absent or non-finite clinical values", () => {
    const result = googleProsodyFromClinicalVoice({
      voiceName: NEURAL,
      speechRate: null,
      pitch: undefined,
      pauseScale: Number.NaN,
    });
    expect(result.audioConfig).toEqual({});
    expect(result.unsupported).toEqual([]);
  });
});
