import { describe, expect, it } from "vitest";
import {
  MAX_EVIDENCE_PER_ITEM,
  normalizeForQuoteMatch,
  storedEvidence,
  verifyEvidence,
  type EvidenceTurn,
} from "@/lib/ai/assessment-evidence";

const turns: EvidenceTurn[] = [
  { n: 1, speaker: "therapist", content: "Hi, I'm glad you came in. What brings you here today?" },
  { n: 2, speaker: "patient", content: "I can't sleep, and work feels pointless." },
  { n: 3, speaker: "system", content: "Five minutes remaining." },
  { n: 4, speaker: "therapist", content: "Have you had any thoughts of ending your life?" },
  { n: 5, speaker: "therapist", content: "هل راودتكَ أفكارٌ عن إيذاء نفسك؟" },
];

describe("verifyEvidence", () => {
  it("keeps a word-for-word quote from the cited turn", () => {
    expect(verifyEvidence([{ turn: 4, quote: "thoughts of ending your life" }], turns)).toEqual([
      { turn: 4, speaker: "therapist", quote: "thoughts of ending your life" },
    ]);
  });

  it("ignores case, punctuation and surrounding quote marks", () => {
    const out = verifyEvidence([{ turn: 1, quote: "“what brings you here today”" }], turns);
    expect(out).toEqual([{ turn: 1, speaker: "therapist", quote: "what brings you here today" }]);
  });

  it("drops an invented or paraphrased quote", () => {
    expect(
      verifyEvidence(
        [
          { turn: 4, quote: "Do you want to kill yourself?" },
          { turn: 1, quote: "I validated the patient's feelings" },
        ],
        turns,
      ),
    ).toEqual([]);
  });

  it("re-points a real quote cited under the wrong turn", () => {
    expect(verifyEvidence([{ turn: 1, quote: "I can't sleep" }], turns)).toEqual([
      { turn: 2, speaker: "patient", quote: "I can't sleep" },
    ]);
  });

  it("never cites a system turn", () => {
    expect(verifyEvidence([{ turn: 3, quote: "Five minutes remaining" }], turns)).toEqual([]);
  });

  it("matches Arabic with or without diacritics and hamza forms", () => {
    expect(verifyEvidence([{ turn: 5, quote: "راودتك افكار عن ايذاء نفسك" }], turns)).toEqual([
      { turn: 5, speaker: "therapist", quote: "راودتك افكار عن ايذاء نفسك" },
    ]);
  });

  it("accepts quotes with an ellipsis when the parts appear in order", () => {
    expect(verifyEvidence([{ turn: 1, quote: "glad you came in … brings you here" }], turns)).toHaveLength(1);
    expect(verifyEvidence([{ turn: 1, quote: "brings you here … glad you came in" }], turns)).toEqual([]);
  });

  it("does not match a word inside another word", () => {
    expect(verifyEvidence([{ turn: 2, quote: "leep" }], turns)).toEqual([]);
  });

  it("drops too-short quotes, duplicates and junk, and caps the list", () => {
    const out = verifyEvidence(
      [
        { turn: 1, quote: "hi" },
        null,
        42,
        { turn: 1, quote: "glad you came in" },
        { turn: 1, quote: "Glad you came in." },
        { turn: "2", quote: "work feels pointless" },
        { turn: 4, quote: "any thoughts" },
        { turn: 4, quote: "ending your life" },
      ],
      turns,
    );
    expect(out).toHaveLength(MAX_EVIDENCE_PER_ITEM);
    expect(out.map((e) => e.turn)).toEqual([1, 2, 4]);
  });

  it("returns nothing for a missing or non-array value", () => {
    expect(verifyEvidence(undefined, turns)).toEqual([]);
    expect(verifyEvidence("turn 4", turns)).toEqual([]);
  });
});

describe("normalizeForQuoteMatch", () => {
  it("strips tatweel and short vowels", () => {
    expect(normalizeForQuoteMatch("نَـفْـسَكَ")).toBe("نفسك");
  });
});

describe("storedEvidence", () => {
  it("keeps well-shaped rows only", () => {
    expect(
      storedEvidence([
        { turn: 2, speaker: "patient", quote: "I can't sleep" },
        { turn: 3, speaker: "system", quote: "x" },
        { turn: "4", speaker: "therapist", quote: "y" },
      ]),
    ).toEqual([{ turn: 2, speaker: "patient", quote: "I can't sleep" }]);
    expect(storedEvidence(null)).toEqual([]);
  });
});
