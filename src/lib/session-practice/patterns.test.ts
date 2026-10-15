import { describe, expect, it } from "vitest";
import { PRACTICE_PATTERNS, matchesPractice } from "./patterns";
import type { PracticeCheckId } from "./types";

function matched(turn: string): PracticeCheckId[] {
  return PRACTICE_PATTERNS.filter((p) => matchesPractice(p, turn)).map((p) => p.id);
}

describe("practice cues in formal Arabic (MSA)", () => {
  // Phrasings a trainee typed in a level-1 session that were marked "not
  // performed" although the same questions in English and in Levantine
  // Arabic were credited.
  it.each([
    ["ما الذي أتى بك اليوم؟", "presenting_problem"],
    ["ما هي المشكلة التي جاءت بك؟", "presenting_problem"],
    ["ماذا يزعجك هذه الأيام؟", "presenting_problem"],
    ["كيف يمكنني أن أساعدك؟", "presenting_problem"],
    ["ومتى بدأ ذلك؟", "history"],
    ["منذ متى تشعر بهذا؟", "history"],
    ["هل حدث هذا من قبل؟", "history"],
    ["هل توافق أن نكمل؟", "consent_to_proceed"],
    ["هل نتفق على أن نبدأ؟", "consent_to_proceed"],
    ["هل هذا مناسب لك؟", "consent_to_proceed"],
    ["هل لديك أي سؤال قبل أن نبدأ؟", "consent_to_proceed"],
    ["كيف شعرت بجلسة اليوم؟", "feedback_elicited"],
    ["ما رأيك في جلستنا؟", "feedback_elicited"],
    ["هل لديك أي ملاحظات؟", "feedback_elicited"],
  ] as const)("credits %s as %s", (turn, id) => {
    expect(matched(turn)).toContain(id);
  });

  it("still credits the Levantine wording", () => {
    expect(matched("شو اللي جابك اليوم؟ ومن إيمتى بلّش هالشي؟")).toEqual(
      expect.arrayContaining(["presenting_problem", "history"]),
    );
    expect(matched("كيف كانت جلسة اليوم بالنسبة إلك؟")).toContain("feedback_elicited");
  });

  it("does not credit unrelated turns", () => {
    expect(matched("هل نمت جيدًا الليلة الماضية؟")).toEqual([]);
    expect(matched("هذا يبدو صعبًا جدًا عليك.")).toEqual([]);
  });
});

describe("consent cues in English", () => {
  it.each([
    "Is it OK to continue?",
    "Are you happy to go ahead?",
    "Shall we begin?",
    "Is it alright with you if we start?",
  ])("credits %s", (turn) => {
    expect(matched(turn)).toContain("consent_to_proceed");
  });

  it("does not credit a plain question about feelings", () => {
    expect(matched("Is it hard to talk about?")).not.toContain("consent_to_proceed");
  });
});
