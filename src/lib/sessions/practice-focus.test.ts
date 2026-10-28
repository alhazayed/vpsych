import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { ladderVisibleSnapshot, sealLadderCase } from "@/lib/skill-tests/exam";
import { focusFromFeedback, type FocusCandidate } from "./practice-focus";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const PRACTICE: FocusCandidate = {
  id: A,
  ended_at: "2026-10-27T10:00:00Z",
  language: "en",
  skill_test_assignment_id: null,
  sealed_case: null,
  clinical_snapshot: null,
};

const ROW = {
  assessment_mode: "ai_examiner",
  feedback: {
    strengths: ["Warm opening."],
    missed: ["No risk question."],
    next_steps: ["Ask about sleep and appetite early.", "Summarise before closing."],
  },
};

describe("focusFromFeedback", () => {
  it("carries the next steps of a practice session", () => {
    expect(focusFromFeedback(PRACTICE, ROW)).toEqual({
      sessionId: A,
      endedAt: "2026-10-27T10:00:00Z",
      language: "en",
      nextSteps: ["Ask about sleep and appetite early.", "Summarise before closing."],
    });
  });

  it("gives nothing for a skill test, an admin test, or a heuristic report", () => {
    expect(focusFromFeedback({ ...PRACTICE, skill_test_assignment_id: A }, ROW)).toBeNull();
    expect(
      focusFromFeedback(
        { ...PRACTICE, clinical_snapshot: { admin_test: true } as unknown as CaseInstanceSnapshot },
        ROW,
      ),
    ).toBeNull();
    expect(focusFromFeedback(PRACTICE, { ...ROW, assessment_mode: "heuristic_fallback" })).toBeNull();
    expect(focusFromFeedback(PRACTICE, null)).toBeNull();
  });

  it("gives nothing when there are no next steps", () => {
    expect(
      focusFromFeedback(PRACTICE, { ...ROW, feedback: { ...ROW.feedback, next_steps: [] } }),
    ).toBeNull();
  });

  it("drops score-like next steps", () => {
    const focus = focusFromFeedback(PRACTICE, {
      ...ROW,
      feedback: { ...ROW.feedback, next_steps: ["Aim for a score above 70.", "Name feelings."] },
    });
    expect(focus?.nextSteps).toEqual(["Name feelings."]);
  });

  describe("sealed ladder level", () => {
    beforeEach(() => {
      vi.stubEnv("REPORT_WRITE_KEY", "test-report-key");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    });
    afterEach(() => vi.unstubAllEnvs());

    const LEVEL = {
      version: 2,
      assessment_id: "VPSY-L",
      locale: "en-US",
      primary_diagnosis: { id: "d1", slug: "ptsd", name: "PTSD" },
      comorbidities: [],
      clinical_core: { disorder: "ptsd", risk_profile: { current_risk: "low" } },
    } as unknown as CaseInstanceSnapshot;

    it("drops a next step naming the sealed diagnosis", () => {
      const session: FocusCandidate = {
        ...PRACTICE,
        sealed_case: sealLadderCase(A, LEVEL),
        clinical_snapshot: ladderVisibleSnapshot(LEVEL),
      };
      const focus = focusFromFeedback(session, {
        ...ROW,
        feedback: {
          ...ROW.feedback,
          next_steps: ["Screen for PTSD symptoms.", "Slow the pace when she cries."],
        },
      });
      expect(focus?.nextSteps).toEqual(["Slow the pace when she cries."]);
    });

    it("shows nothing when the sealed case cannot be opened", () => {
      const session: FocusCandidate = {
        ...PRACTICE,
        sealed_case: "not-a-real-blob",
        clinical_snapshot: ladderVisibleSnapshot(LEVEL),
      };
      expect(focusFromFeedback(session, ROW)).toBeNull();
    });
  });
});
