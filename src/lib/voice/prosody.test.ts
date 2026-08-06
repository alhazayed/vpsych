import { describe, expect, it } from "vitest";
import {
  browserSpeechRateForPace,
  normalizeSpeechPace,
  resolveVoiceSettings,
  voiceSettingsForPaceEnergy,
  voiceSettingsForSpeechProfile,
} from "@/lib/voice/prosody";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";

describe("CB-HCF-007 voice prosody", () => {
  it("maps slow/low depression to steadier flatter settings", () => {
    const s = voiceSettingsForPaceEnergy("slow", "low");
    expect(s.stability).toBeGreaterThan(0.5);
    expect(s.stability).toBeGreaterThan(
      voiceSettingsForPaceEnergy("pressured", "high").stability,
    );
  });

  it("maps pressured mania to more variable delivery", () => {
    const mania = voiceSettingsForSpeechProfile(
      speechBehaviorForDisorder("bipolar-mania"),
    );
    const mdd = voiceSettingsForSpeechProfile(
      speechBehaviorForDisorder("mdd-recurrent-moderate"),
    );
    expect(mania.stability).toBeLessThan(mdd.stability);
    expect((mania.style ?? 0)).toBeGreaterThan((mdd.style ?? 0));
  });

  it("resolves from disorder slug when pace omitted", () => {
    const s = resolveVoiceSettings({ disorderSlug: "gad-with-panic" });
    expect(s.stability).toBeLessThan(0.5);
  });

  it("ignores malformed disorder slugs", () => {
    const s = resolveVoiceSettings({
      disorderSlug: "DROP TABLE;;",
    });
    expect(s.stability).toBe(0.4);
  });

  it("normalizes pace and browser rate", () => {
    expect(normalizeSpeechPace("PRESSURED")).toBe("pressured");
    expect(normalizeSpeechPace("nope")).toBeNull();
    expect(browserSpeechRateForPace("slow")).toBeLessThan(
      browserSpeechRateForPace("pressured"),
    );
  });
});
