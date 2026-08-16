import { describe, expect, it } from "vitest";
import {
  isElevenLabsVoiceId,
  isGoogleVoiceName,
  isVoiceIdForProvider,
  providerForVoiceId,
} from "@/lib/voice/tts/voice-format";

const ELEVENLABS_IDS = ["EXAVITQu4vr4xnSDxMaL", "pNInz6obpgDQGcFmaJgB"];
const GOOGLE_NAMES = [
  "ar-XA-Chirp3-HD-Kore",
  "en-US-Chirp3-HD-Puck",
  "en-US-Neural2-A",
  "cmn-CN-Wavenet-A",
];

describe("isGoogleVoiceName", () => {
  it("accepts Google voice names", () => {
    for (const name of GOOGLE_NAMES) {
      expect(isGoogleVoiceName(name), name).toBe(true);
    }
  });

  it("rejects ElevenLabs ids, malformed names, and empty values", () => {
    for (const id of ELEVENLABS_IDS) {
      expect(isGoogleVoiceName(id), id).toBe(false);
    }
    expect(isGoogleVoiceName("ar-xa-Chirp3-HD-Kore")).toBe(false); // region must be uppercase
    expect(isGoogleVoiceName("ar-XA")).toBe(false); // no model segment
    expect(isGoogleVoiceName("../../v1/voices")).toBe(false);
    expect(isGoogleVoiceName("ar-XA-Chirp3 HD-Kore")).toBe(false);
    expect(isGoogleVoiceName("")).toBe(false);
    expect(isGoogleVoiceName(null)).toBe(false);
    expect(isGoogleVoiceName(undefined)).toBe(false);
  });
});

describe("isElevenLabsVoiceId", () => {
  it("accepts opaque ElevenLabs tokens", () => {
    for (const id of ELEVENLABS_IDS) {
      expect(isElevenLabsVoiceId(id), id).toBe(true);
    }
    // Existing fixture-style ids stay valid.
    expect(isElevenLabsVoiceId("registered-voice-1")).toBe(true);
    expect(isElevenLabsVoiceId("legacy-ar")).toBe(true);
  });

  it("rejects Google voice names — provider isolation", () => {
    for (const name of GOOGLE_NAMES) {
      expect(isElevenLabsVoiceId(name), name).toBe(false);
    }
  });

  it("still rejects path separators, dots, spaces, and short values", () => {
    expect(isElevenLabsVoiceId("../voices")).toBe(false);
    expect(isElevenLabsVoiceId("a/b/c")).toBe(false);
    expect(isElevenLabsVoiceId("voice.id")).toBe(false);
    expect(isElevenLabsVoiceId("has space")).toBe(false);
    expect(isElevenLabsVoiceId("ab")).toBe(false);
    expect(isElevenLabsVoiceId("")).toBe(false);
    expect(isElevenLabsVoiceId(null)).toBe(false);
  });
});

describe("isVoiceIdForProvider — cross-provider isolation", () => {
  it("an ElevenLabs voice id cannot be used with Google", () => {
    for (const id of ELEVENLABS_IDS) {
      expect(isVoiceIdForProvider("google", id), id).toBe(false);
      expect(isVoiceIdForProvider("elevenlabs", id), id).toBe(true);
    }
  });

  it("a Google voice name cannot be used with ElevenLabs", () => {
    for (const name of GOOGLE_NAMES) {
      expect(isVoiceIdForProvider("elevenlabs", name), name).toBe(false);
      expect(isVoiceIdForProvider("google", name), name).toBe(true);
    }
  });

  it("rejects malformed values for both providers", () => {
    for (const bad of ["../voices", "has space", "", null, undefined]) {
      expect(isVoiceIdForProvider("google", bad)).toBe(false);
      expect(isVoiceIdForProvider("elevenlabs", bad)).toBe(false);
    }
  });
});

describe("providerForVoiceId", () => {
  it("infers the owning provider from identifier shape", () => {
    expect(providerForVoiceId("ar-XA-Chirp3-HD-Kore")).toBe("google");
    expect(providerForVoiceId("EXAVITQu4vr4xnSDxMaL")).toBe("elevenlabs");
    expect(providerForVoiceId("../voices")).toBeNull();
    expect(providerForVoiceId(null)).toBeNull();
  });
});
