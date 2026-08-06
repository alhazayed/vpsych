import { describe, expect, it } from "vitest";
import { preparePatientSpeechForTts } from "@/lib/voice/tts-text";

describe("preparePatientSpeechForTts", () => {
  it("collapses whitespace and ensures terminal punctuation", () => {
    expect(preparePatientSpeechForTts("  I'm  just  tired  ")).toBe(
      "I'm just tired.",
    );
  });

  it("normalizes ellipses for breath pauses", () => {
    expect(preparePatientSpeechForTts("I don't know... maybe")).toBe(
      "I don't know… maybe.",
    );
  });

  it("adds pause-friendly dashes for slow/low phenotypes", () => {
    const out = preparePatientSpeechForTts("It's fine — just tired", {
      pace: "slow",
      energy: "low",
    });
    expect(out).toContain("…");
  });

  it("spaces hesitation particles", () => {
    expect(preparePatientSpeechForTts("Well um I guess")).toMatch(/um/);
  });
});
