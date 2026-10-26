import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_REVIEW_COMMENT,
  REVIEW_VALIDATION_CODES,
  reviewsBySession,
  validateReviewInput,
  type ReviewWithAuthor,
} from "./index";
import { linkErrorKey, reviewErrorKey } from "./client-errors";

describe("validateReviewInput", () => {
  it("accepts a comment with an adjusted score and a flag", () => {
    expect(
      validateReviewInput({ comment: "  Missed the risk question ", adjustedOverall: 52, flagged: true }),
    ).toEqual({
      ok: true,
      value: { comment: "Missed the risk question", adjustedOverall: 52, flagged: true },
    });
  });

  it("accepts a comment alone and a flag alone", () => {
    expect(validateReviewInput({ comment: "Good pacing" })).toEqual({
      ok: true,
      value: { comment: "Good pacing", adjustedOverall: null, flagged: false },
    });
    expect(validateReviewInput({ flagged: true })).toEqual({
      ok: true,
      value: { comment: null, adjustedOverall: null, flagged: true },
    });
  });

  it("accepts Arabic comments as written", () => {
    const comment = "لم يسأل عن الأفكار الانتحارية";
    const out = validateReviewInput({ comment });
    expect(out.ok && out.value.comment).toBe(comment);
  });

  it("requires a comment for an adjusted score", () => {
    expect(validateReviewInput({ adjustedOverall: 40 })).toEqual({
      ok: false,
      error: "comment_required",
    });
    expect(validateReviewInput({ adjustedOverall: 40, comment: "   " })).toEqual({
      ok: false,
      error: "comment_required",
    });
  });

  it("keeps the score a whole number from 0 to 100", () => {
    for (const bad of [-1, 101, 55.5, "60", Number.NaN, true]) {
      expect(validateReviewInput({ comment: "x", adjustedOverall: bad })).toEqual({
        ok: false,
        error: "score_invalid",
      });
    }
    for (const good of [0, 100]) {
      expect(validateReviewInput({ comment: "x", adjustedOverall: good }).ok).toBe(true);
    }
  });

  it("treats an empty score field as no adjustment", () => {
    expect(validateReviewInput({ comment: "x", adjustedOverall: "" })).toEqual({
      ok: true,
      value: { comment: "x", adjustedOverall: null, flagged: false },
    });
  });

  it("refuses an empty review, a long comment and bad types", () => {
    expect(validateReviewInput({})).toEqual({ ok: false, error: "review_empty" });
    expect(validateReviewInput(null)).toEqual({ ok: false, error: "review_empty" });
    expect(validateReviewInput({ comment: "  ", flagged: false })).toEqual({
      ok: false,
      error: "review_empty",
    });
    expect(validateReviewInput({ comment: "x".repeat(MAX_REVIEW_COMMENT + 1) })).toEqual({
      ok: false,
      error: "comment_too_long",
    });
    expect(validateReviewInput({ comment: "x".repeat(MAX_REVIEW_COMMENT) }).ok).toBe(true);
    expect(validateReviewInput({ comment: 5 })).toEqual({ ok: false, error: "comment_invalid" });
    expect(validateReviewInput({ comment: "x", flagged: "yes" })).toEqual({
      ok: false,
      error: "flag_invalid",
    });
  });
});

describe("reviewErrorKey", () => {
  it("maps every validation code to a message", () => {
    for (const code of REVIEW_VALIDATION_CODES) {
      expect(reviewErrorKey(400, code)).toBeTruthy();
    }
    expect(reviewErrorKey(400, "comment_required")).toBe("commentRequired");
    expect(reviewErrorKey(403, "review_forbidden")).toBe("forbidden");
  });

  it("falls back on the status", () => {
    expect(reviewErrorKey(401)).toBe("signedOut");
    expect(reviewErrorKey(403)).toBe("forbidden");
    expect(reviewErrorKey(404)).toBe("notFound");
    expect(reviewErrorKey(429)).toBe("rateLimited");
    expect(reviewErrorKey(500, "unknown")).toBe("failed");
  });
});

describe("linkErrorKey", () => {
  it("maps link codes", () => {
    expect(linkErrorKey(403, "MFA_REQUIRED")).toBe("mfaRequired");
    expect(linkErrorKey(409, "NOT_SUPERVISOR")).toBe("notSupervisor");
    expect(linkErrorKey(409, "LINK_NOT_UPDATED")).toBe("notApplied");
    expect(linkErrorKey(429)).toBe("rateLimited");
    expect(linkErrorKey(500)).toBe("changeFailed");
  });
});

describe("reviewsBySession", () => {
  it("groups reviews in order", () => {
    const r = (id: string, session_id: string) =>
      ({ id, session_id }) as unknown as ReviewWithAuthor;
    const grouped = reviewsBySession([r("1", "a"), r("2", "b"), r("3", "a")]);
    expect(grouped.get("a")?.map((x) => x.id)).toEqual(["1", "3"]);
    expect(grouped.get("b")?.map((x) => x.id)).toEqual(["2"]);
  });
});

describe("the AI report is never written by review code", () => {
  it("review and link routes touch only their own tables", () => {
    for (const file of [
      "src/app/api/supervise/reviews/[sessionId]/route.ts",
      "src/app/api/admin/supervisors/trainees/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(/from\("session_reports"\)/);
      expect(src).not.toMatch(/create_session_report/);
    }
  });
});
