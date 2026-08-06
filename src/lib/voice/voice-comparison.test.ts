import { describe, expect, it } from "vitest";
import {
  latencyScoreFromMs,
  rankVoiceCandidates,
  recommendedPatientVoices,
  scoreVoiceComposite,
} from "@/lib/voice/voice-comparison";

describe("voice comparison rubric", () => {
  it("ranks Sarah / Charlotte highly for SP casting", () => {
    const { en, ar, ranking } = recommendedPatientVoices();
    expect(en.label).toBe("Sarah");
    expect(ar.label).toBe("Charlotte");
    expect(ranking[0]!.composite).toBeGreaterThan(7);
  });

  it("weights clinical realism and naturalness in the composite", () => {
    const high = scoreVoiceComposite({
      naturalness: 9,
      clinicalRealism: 9,
      warmth: 8,
      emotionalExpression: 8,
      arabicPronunciation: 7,
      englishPronunciation: 9,
      conversationFlow: 8,
      latency: 7,
    });
    const low = scoreVoiceComposite({
      naturalness: 4,
      clinicalRealism: 4,
      warmth: 4,
      emotionalExpression: 4,
      arabicPronunciation: 4,
      englishPronunciation: 4,
      conversationFlow: 4,
      latency: 4,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("maps latency to a bounded score", () => {
    expect(latencyScoreFromMs(300)).toBe(10);
    expect(latencyScoreFromMs(3000)).toBe(1);
    expect(rankVoiceCandidates().length).toBeGreaterThan(3);
  });
});
