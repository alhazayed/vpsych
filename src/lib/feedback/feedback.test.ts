import { describe, expect, it, beforeEach } from "vitest";
import {
  clearFeedbackStoreForTests,
  feedbackSummary,
  listFeedback,
  sanitizeFeedbackMetadata,
  submitFeedback,
  validateFeedbackInput,
  FEEDBACK_OWNERSHIP_RULE,
} from "@/lib/feedback";

describe("institutional feedback framework", () => {
  beforeEach(() => clearFeedbackStoreForTests());

  it("rejects clinical payloads in metadata", () => {
    const clean = sanitizeFeedbackMetadata({
      clinical_snapshot: { diagnosis: "mdd" },
      decision_plan: { speak: "x" },
      browser: "chrome",
      score: 4,
    });
    expect(clean.clinical_snapshot).toBeUndefined();
    expect(clean.decision_plan).toBeUndefined();
    expect(clean.browser).toBe("chrome");
    expect(clean.score).toBe(4);
  });

  it("validates role/category/body", () => {
    expect(
      validateFeedbackInput({
        role_persona: "resident",
        category: "clinical_realism",
        body: "Felt realistic",
        rating: 4,
      }),
    ).toBeNull();
    expect(
      validateFeedbackInput({
        role_persona: "resident",
        category: "clinical_realism",
        body: "",
      }),
    ).toMatch(/body/);
  });

  it("stores feedback without touching patient cognition ownership rule", () => {
    expect(FEEDBACK_OWNERSHIP_RULE).toMatch(/Never writes clinical_snapshot/);
    const row = submitFeedback(
      {
        role_persona: "faculty",
        category: "educational_value",
        severity: "medium",
        rating: 5,
        body: "Useful for OSCE prep",
      },
      "user-1",
    );
    expect(row.id).toBeTruthy();
    expect(listFeedback()).toHaveLength(1);
    expect(feedbackSummary().total).toBe(1);
    expect(feedbackSummary().avgRating).toBe(5);
  });
});
