import { describe, expect, it } from "vitest";
import {
  composeTtsText,
  selectVocalization,
} from "@/lib/conversation/vocalization";
import type { PmeUxCues } from "@/lib/conversation/types";

describe("vocalization", () => {
  it("never randomizes — same cues same result", () => {
    const cues: PmeUxCues = {
      permitsVocalization: true,
      disorderCategory: "mood",
      pace: "slow",
      energy: "low",
      hesitation: 0.6,
      confidence: 0.4,
      severity: "moderate",
    };
    expect(selectVocalization(cues).kind).toBe(selectVocalization(cues).kind);
  });

  it("suppresses theatrical vocalization when not permitted", () => {
    const cues: PmeUxCues = {
      permitsVocalization: false,
      disorderCategory: "mood",
      hesitation: 0.9,
      confidence: 0.1,
    };
    expect(selectVocalization(cues).kind).toBeNull();
  });

  it("uses Arabic prefixes when locale is ar", () => {
    const cues: PmeUxCues = {
      permitsVocalization: true,
      hesitation: 0.6,
      confidence: 0.4,
    };
    const v = selectVocalization(cues, "ar");
    expect(v.kind).toBe("hmm");
    expect(v.ttsPrefix).toContain("همم");
  });

  it("uses English prefixes for en", () => {
    const cues: PmeUxCues = {
      permitsVocalization: true,
      hesitation: 0.6,
      confidence: 0.4,
    };
    const v = selectVocalization(cues, "en");
    expect(v.ttsPrefix.toLowerCase()).toContain("hmm");
  });

  it("composeTtsText does not mutate when no prefix", () => {
    expect(
      composeTtsText("Hello", { kind: null, ttsPrefix: "", pauseBeforeMs: 0 }),
    ).toBe("Hello");
  });

  it("avoids nervous laugh for severe presentations", () => {
    const cues: PmeUxCues = {
      permitsVocalization: true,
      disorderCategory: "anxiety",
      pace: "fast",
      energy: "high",
      severity: "severe",
    };
    expect(selectVocalization(cues).kind).not.toBe("nervous_laugh");
  });
});
