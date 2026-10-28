import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { ladderVisibleSnapshot, sealLadderCase } from "@/lib/skill-tests/exam";
import { citesAdjustedScore, commentHiddenReason } from "./comment-visibility";
import { traineeMayReadComment, traineeVisibleComments } from "./trainee-comments";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const row = (comment: string | null) => ({
  comment,
  reviewer_name: "Dr Salma",
  updated_at: "2026-10-28T09:00:00Z",
});

describe("traineeVisibleComments (page, second line)", () => {
  it("passes a plain comment through with name and time", () => {
    expect(traineeVisibleComments([row("  Slow down after she cries.  ")])).toEqual([
      { comment: "Slow down after she cries.", reviewerName: "Dr Salma", updatedAt: "2026-10-28T09:00:00Z" },
    ]);
  });

  it("hides empty and score-like comments", () => {
    expect(
      traineeVisibleComments([
        row(null),
        row("   "),
        row("I would give this 70/100."),
        row("The score is too low."),
        row("درجتك جيدة"),
        row("Ask about sleep."),
      ]).map((c) => c.comment),
    ).toEqual(["Ask about sleep."]);
  });

  it("on a sealed level hides a comment naming the diagnosis", () => {
    expect(
      traineeVisibleComments(
        [row("Classic PTSD avoidance, explore it."), row("Explore the avoidance.")],
        ["PTSD", "post-traumatic stress disorder"],
      ).map((c) => c.comment),
    ).toEqual(["Explore the avoidance."]);
  });
});

describe("traineeMayReadComment (review route, on save)", () => {
  beforeEach(() => {
    vi.stubEnv("REPORT_WRITE_KEY", "test-report-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const practice = {
    id: A,
    skill_test_assignment_id: null,
    sealed_case: null,
    clinical_snapshot: null,
  };
  const LEVEL = {
    version: 2,
    assessment_id: "VPSY-L",
    locale: "en-US",
    primary_diagnosis: { id: "d1", slug: "ptsd", name: "PTSD" },
    comorbidities: [],
    clinical_core: { disorder: "ptsd", risk_profile: { current_risk: "low" } },
  } as unknown as CaseInstanceSnapshot;

  it("marks a plain practice comment visible", () => {
    expect(traineeMayReadComment(practice, "Explore the layoffs.", null)).toBe(true);
  });

  it("never for a skill test, an empty comment, a score, or the adjusted number", () => {
    expect(traineeMayReadComment({ ...practice, skill_test_assignment_id: A }, "Good.", null)).toBe(false);
    expect(traineeMayReadComment(practice, null, null)).toBe(false);
    expect(traineeMayReadComment(practice, "  ", null)).toBe(false);
    expect(traineeMayReadComment(practice, "Score: 40%", null)).toBe(false);
    expect(traineeMayReadComment(practice, "Raised to 65 for the plan.", 65)).toBe(false);
    expect(traineeMayReadComment(practice, "Raised for the plan.", 65)).toBe(true);
  });

  it("on a sealed level drops a comment naming the diagnosis, and fails closed", () => {
    const sealed = {
      ...practice,
      sealed_case: sealLadderCase(A, LEVEL),
      clinical_snapshot: ladderVisibleSnapshot(LEVEL),
    };
    expect(traineeMayReadComment(sealed, "Typical PTSD avoidance.", null)).toBe(false);
    expect(traineeMayReadComment(sealed, "Explore the avoidance.", null)).toBe(true);
    expect(traineeMayReadComment({ ...sealed, sealed_case: "broken" }, "Explore.", null)).toBe(false);
  });
});

describe("commentHiddenReason", () => {
  it("names the reason the supervisor is warned about", () => {
    expect(commentHiddenReason("Score: 40%")).toBe("score");
    expect(commentHiddenReason("PTSD", { sealedLabels: ["PTSD"] })).toBe("diagnosis");
    expect(commentHiddenReason("Good work.")).toBeNull();
  });
});

describe("citesAdjustedScore", () => {
  it("finds the number in either digit set, not inside other numbers", () => {
    expect(citesAdjustedScore("Raised to 65.", 65)).toBe(true);
    expect(citesAdjustedScore("رفعتها إلى ٦٥", 65)).toBe(true);
    expect(citesAdjustedScore("رفعتها إلى ۶۵", 65)).toBe(true);
    expect(citesAdjustedScore("Turn 165 was good", 65)).toBe(false);
    expect(citesAdjustedScore("No numbers here", 65)).toBe(false);
  });
});
