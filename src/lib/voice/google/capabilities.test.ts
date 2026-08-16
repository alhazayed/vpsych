import { describe, expect, it } from "vitest";
import {
  CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES,
  googleSupports,
  googleVoiceFamily,
  PAUSE_CONTROL_EXCLUDED_LOCALES,
  PITCH_SEMITONE_RANGE,
  SPEAKING_RATE_RANGE,
} from "@/lib/voice/google/capabilities";

const CHIRP_AR = "ar-XA-Chirp3-HD-Kore";
const CHIRP_EN = "en-US-Chirp3-HD-Kore";
const NEURAL_EN = "en-US-Neural2-A";

describe("googleVoiceFamily", () => {
  it("identifies Chirp and classic families", () => {
    expect(googleVoiceFamily(CHIRP_AR)).toBe("chirp3-hd");
    expect(googleVoiceFamily(CHIRP_EN)).toBe("chirp3-hd");
    expect(googleVoiceFamily(NEURAL_EN)).toBe("classic");
    expect(googleVoiceFamily("en-US-Wavenet-D")).toBe("classic");
  });
});

describe("speaking_rate capability", () => {
  it("is supported for Chirp 3 HD across locales, including ar-XA", () => {
    // Documented: Chirp 3 HD pace control is available in ALL locales.
    expect(googleSupports("speaking_rate", CHIRP_AR, "ar-XA")).toBe(true);
    expect(googleSupports("speaking_rate", CHIRP_EN, "en-US")).toBe(true);
  });

  it("is supported for classic voices too", () => {
    expect(googleSupports("speaking_rate", NEURAL_EN, "en-US")).toBe(true);
  });

  it("exposes Google's documented range", () => {
    expect(SPEAKING_RATE_RANGE).toEqual({ min: 0.25, max: 2.0 });
  });
});

describe("pitch capability", () => {
  it("is NOT supported for Chirp 3 HD", () => {
    // Google returns "This voice does not support pitch parameters at this time."
    expect(googleSupports("pitch", CHIRP_AR, "ar-XA")).toBe(false);
    expect(googleSupports("pitch", CHIRP_EN, "en-US")).toBe(false);
  });

  it("is supported for classic voice families", () => {
    expect(googleSupports("pitch", NEURAL_EN, "en-US")).toBe(true);
  });

  it("exposes Google's documented semitone range", () => {
    expect(PITCH_SEMITONE_RANGE).toEqual({ min: -20, max: 20 });
  });
});

describe("pause_control capability", () => {
  it("is supported for Chirp 3 HD in ar-XA and en-US", () => {
    expect(googleSupports("pause_control", CHIRP_AR, "ar-XA")).toBe(true);
    expect(googleSupports("pause_control", CHIRP_EN, "en-US")).toBe(true);
  });

  it("is not offered in the excluded locales", () => {
    expect(googleSupports("pause_control", "yue-HK-Chirp3-HD-Kore", "yue-HK")).toBe(
      false,
    );
    expect(googleSupports("pause_control", "he-IL-Chirp3-HD-Kore", "he-IL")).toBe(
      false,
    );
  });

  it("is not available to classic voices — markup is Chirp 3 HD only", () => {
    expect(googleSupports("pause_control", NEURAL_EN, "en-US")).toBe(false);
  });

  it("does not exclude ar-XA", () => {
    expect(PAUSE_CONTROL_EXCLUDED_LOCALES).not.toContain("ar-xa");
  });
});

describe("custom_pronunciation capability", () => {
  it("is supported in ar-XA and en-US", () => {
    expect(googleSupports("custom_pronunciation", CHIRP_AR, "ar-XA")).toBe(true);
    expect(googleSupports("custom_pronunciation", CHIRP_EN, "en-US")).toBe(true);
  });

  it("is not offered in the excluded locales", () => {
    expect(
      googleSupports("custom_pronunciation", "th-TH-Chirp3-HD-Kore", "th-TH"),
    ).toBe(false);
    expect(
      googleSupports("custom_pronunciation", "sv-SE-Chirp3-HD-Kore", "sv-SE"),
    ).toBe(false);
  });

  it("does not exclude ar-XA", () => {
    expect(CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES).not.toContain("ar-xa");
  });
});

describe("locale matching", () => {
  it("is case-insensitive", () => {
    expect(googleSupports("pause_control", "yue-HK-Chirp3-HD-Kore", "YUE-HK")).toBe(
      false,
    );
    expect(googleSupports("pause_control", CHIRP_AR, "AR-XA")).toBe(true);
  });
});

describe("ssml capability", () => {
  it("is not used for Chirp 3 HD", () => {
    expect(googleSupports("ssml", CHIRP_AR, "ar-XA")).toBe(false);
  });
});
