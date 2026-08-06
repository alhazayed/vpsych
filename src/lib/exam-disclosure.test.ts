import { describe, expect, it } from "vitest";
import { shouldHideGroundTruth } from "./exam-disclosure";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

function snap(
  preset: Partial<NonNullable<CaseInstanceSnapshot["instructor_preset"]>>,
): CaseInstanceSnapshot {
  return {
    instructor_preset: {
      id: "p1",
      slug: "osce-diagnostic-interview-ar",
      version: 1,
      name: "OSCE",
      primary_objective: "osce_examination",
      secondary_objectives: [],
      target_learner: "osce_candidate",
      assessment_type: "osce_examination",
      grading_mode: "osce",
      feedback_mode: "none",
      time_limit_minutes: 20,
      allow_hints: false,
      allow_pause: false,
      allow_restart: false,
      voice_enabled: true,
      ...preset,
    },
  } as CaseInstanceSnapshot;
}

describe("shouldHideGroundTruth (CQG-007)", () => {
  it("hides for OSCE examination presets", () => {
    expect(shouldHideGroundTruth(snap({}))).toBe(true);
  });

  it("hides when feedback_mode is none", () => {
    expect(
      shouldHideGroundTruth(
        snap({
          assessment_type: "formative",
          grading_mode: "formative",
          feedback_mode: "none",
        }),
      ),
    ).toBe(true);
  });

  it("does not hide for formative coaching presets", () => {
    expect(
      shouldHideGroundTruth(
        snap({
          assessment_type: "formative_practice",
          grading_mode: "formative",
          feedback_mode: "realtime_coaching",
        }),
      ),
    ).toBe(false);
  });

  it("does not hide when no preset is present", () => {
    expect(shouldHideGroundTruth(undefined)).toBe(false);
    expect(shouldHideGroundTruth({} as CaseInstanceSnapshot)).toBe(false);
  });
});
