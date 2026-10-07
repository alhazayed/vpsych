import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TherapyCourse, TreatmentPlan } from "@/lib/types";
import {
  DEFAULT_PLANNED_SESSIONS,
  THERAPY_COURSE_PROMPT_MARKER,
  buildCourseSessionContext,
  canWritePlan,
  courseProgress,
  decideCourseStart,
  formatTherapyCoursePromptBlock,
  injectTherapyCourseIntoSystemPrompt,
  isCourseSchemaMissing,
  isPlanRequired,
  minPlannedSessions,
  shouldCompleteAfterSession,
  validateTreatmentPlan,
  asTreatmentPlan,
  isPlanNew,
} from "./index";

const plan: TreatmentPlan = {
  formulation:
    "Panic attacks maintained by catastrophic misreading of bodily sensations and avoidance.",
  goals: ["Reduce panic attacks to under one per week", "Return to using the metro"],
  interventions: "CBT for panic: psychoeducation, interoceptive exposure, graded exposure.",
  expected_sessions: 10,
  patient_expectations:
    "Weekly sessions; practice exercises at home between sessions.",
  risk_formulation:
    "No suicidal ideation; risk rises with alcohol use; safety plan agreed with GP contact.",
  five_ps: {
    presenting: "Panic attacks for 14 months with avoidance of the metro and meetings.",
    predisposing: "Worry-prone since about age 12; sibling with panic disorder.",
    precipitating: "First attack after a health scare in the family.",
    perpetuating: "Catastrophic misreading of heart racing, safety behaviours, avoidance.",
    protective: "Supportive partner, stable job, came for help.",
  },
};

function course(over: Partial<TherapyCourse> = {}): TherapyCourse {
  return {
    id: "course-1",
    therapist_id: "t1",
    avatar_id: "a1",
    case_instance_id: null,
    clinical_snapshot: {} as TherapyCourse["clinical_snapshot"],
    language: "en-US",
    max_duration_sec: 2400,
    status: "active",
    planned_sessions: DEFAULT_PLANNED_SESSIONS,
    treatment_plan: null,
    plan_submitted_at: null,
    plan_updated_at: null,
    completed_at: null,
    completion_reason: null,
    created_at: "2026-10-04T00:00:00Z",
    updated_at: "2026-10-04T00:00:00Z",
    ...over,
  };
}

describe("therapy course start gate", () => {
  it("opens a new course when none is active", () => {
    expect(decideCourseStart(null, 0)).toEqual({ kind: "new_course" });
    expect(decideCourseStart(course({ status: "completed" }), 5).kind).toBe(
      "new_course",
    );
  });

  it("continues sessions 1 and 2 without a plan", () => {
    const d1 = decideCourseStart(course(), 0);
    expect(d1).toMatchObject({ kind: "continue", sessionNumber: 1, isFinal: false });
    const d2 = decideCourseStart(course(), 1);
    expect(d2).toMatchObject({ kind: "continue", sessionNumber: 2 });
  });

  it("blocks session 3 until the treatment plan exists", () => {
    expect(decideCourseStart(course(), 2)).toMatchObject({
      kind: "plan_required",
      sessionNumber: 3,
    });
    expect(
      decideCourseStart(course({ treatment_plan: plan, planned_sessions: 10 }), 2),
    ).toMatchObject({ kind: "continue", sessionNumber: 3 });
  });

  it("flags the final planned session and stops after it", () => {
    const c = course({ treatment_plan: plan, planned_sessions: 4 });
    expect(decideCourseStart(c, 3)).toMatchObject({
      kind: "continue",
      sessionNumber: 4,
      isFinal: true,
    });
    expect(decideCourseStart(c, 4).kind).toBe("course_finished");
  });

  it("plan can only be written once two sessions are finished", () => {
    expect(canWritePlan(course(), 1)).toBe(false);
    expect(canWritePlan(course(), 2)).toBe(true);
    expect(canWritePlan(course({ status: "completed" }), 2)).toBe(false);
    expect(isPlanRequired(course({ treatment_plan: plan }), 2)).toBe(false);
  });

  it("course length bounds follow sessions held", () => {
    expect(minPlannedSessions(2)).toBe(3);
    expect(minPlannedSessions(6)).toBe(7);
    expect(minPlannedSessions(40)).toBe(20);
  });

  it("completes the course after the final planned session only", () => {
    const c = course({ planned_sessions: 5 });
    expect(shouldCompleteAfterSession(c, 4)).toBe(false);
    expect(shouldCompleteAfterSession(c, 5)).toBe(true);
    expect(shouldCompleteAfterSession(c, null)).toBe(false);
    expect(shouldCompleteAfterSession({ ...c, status: "completed" }, 5)).toBe(false);
  });

  it("courseProgress drives the UI states", () => {
    const after2 = courseProgress(course(), [
      { status: "completed" },
      { status: "expired" },
    ]);
    expect(after2).toMatchObject({
      sessionCount: 2,
      completedCount: 2,
      nextSessionNumber: 3,
      planRequired: true,
      canWritePlan: true,
      canStartNext: false,
    });
    const session2Running = courseProgress(course(), [
      { status: "completed" },
      { status: "active" },
    ]);
    expect(session2Running).toMatchObject({ planRequired: true, canWritePlan: false });
    const planned = courseProgress(course({ treatment_plan: plan, planned_sessions: 3 }), [
      { status: "completed" },
      { status: "completed" },
    ]);
    expect(planned).toMatchObject({ canStartNext: true, nextIsFinal: true });
  });
});

describe("treatment plan validation", () => {
  it("accepts a complete plan and trims fields", () => {
    const r = validateTreatmentPlan(
      { ...plan, goals: ["  Sleep through the night  ", ""], formulation: ` ${plan.formulation} ` },
      { minSessions: 3 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.goals).toEqual(["Sleep through the night"]);
      expect(r.plan.formulation).toBe(plan.formulation);
    }
  });

  it("accepts Arabic plans", () => {
    const r = validateTreatmentPlan(
      {
        formulation: "نوبات هلع تستمر بسبب تفسير الأعراض الجسدية بشكل كارثي وتجنب الأماكن المزدحمة.",
        goals: ["تقليل نوبات الهلع"],
        interventions: "العلاج المعرفي السلوكي والتعرض التدريجي.",
        expected_sessions: 8,
        patient_expectations: "جلسة أسبوعية مع تمارين منزلية بين الجلسات.",
        risk_formulation: "لا توجد أفكار انتحارية حالياً، ويزداد الخطر مع قلة النوم.",
        five_ps: {
          presenting: "نوبات هلع منذ سنة مع تجنب المواصلات.",
          predisposing: "قلق منذ الطفولة.",
          precipitating: "مرض أحد أفراد الأسرة.",
          perpetuating: "تفسير كارثي للأعراض وتجنب.",
          protective: "دعم الزوجة وعمل ثابت.",
        },
      },
      { minSessions: 3 },
    );
    expect(r.ok).toBe(true);
  });

  it.each([
    [{ formulation: "short" }, "formulation"],
    [{ goals: [] }, "goals"],
    [{ goals: ["a", "b", "c", "d", "e", "f", "g"].map((g) => g.repeat(4)) }, "goals"],
    [{ interventions: "" }, "interventions"],
    [{ expected_sessions: 2 }, "expected_sessions"],
    [{ expected_sessions: 21 }, "expected_sessions"],
    [{ expected_sessions: 4.5 }, "expected_sessions"],
    [{ patient_expectations: "" }, "patient_expectations"],
    [{ risk_formulation: "" }, "risk_formulation"],
    [{ five_ps: undefined }, "five_ps"],
    [{ five_ps: "presenting only" }, "five_ps"],
    [{ five_ps: { ...plan.five_ps, protective: "" } }, "five_ps"],
    [{ five_ps: { ...plan.five_ps, perpetuating: "x".repeat(601) } }, "five_ps"],
  ])("rejects %j as %s", (patch, field) => {
    const r = validateTreatmentPlan({ ...plan, ...patch }, { minSessions: 3 });
    expect(r).toEqual({ ok: false, field });
  });

  it("enforces the minimum course length given sessions held", () => {
    const r = validateTreatmentPlan({ ...plan, expected_sessions: 5 }, { minSessions: 6 });
    expect(r).toEqual({ ok: false, field: "expected_sessions" });
  });

  it("narrows stored plans and rejects malformed ones", () => {
    expect(asTreatmentPlan(plan)).toEqual(plan);
    // Plans written before the risk section still load.
    const legacy: Record<string, unknown> = { ...plan };
    delete legacy.risk_formulation;
    expect(asTreatmentPlan(legacy)?.risk_formulation).toBe("");
    // Plans written before the 5 Ps still load, with no 5 Ps.
    const noFivePs: Record<string, unknown> = { ...plan };
    delete noFivePs.five_ps;
    expect(asTreatmentPlan(noFivePs)?.five_ps).toBeNull();
    expect(asTreatmentPlan({ ...plan, five_ps: { presenting: "x" } })?.five_ps).toBeNull();
    expect(asTreatmentPlan({ formulation: "x" })).toBeNull();
    expect(asTreatmentPlan(null)).toBeNull();
  });
});

describe("therapy course prompt block", () => {
  const base = "You are Maya, a patient.\n\nLONG-TERM MEMORY (facts you actually remember — never invent beyond this list):\n- [other] x";

  it("leaves standalone-session prompts unchanged (regression)", () => {
    expect(injectTherapyCourseIntoSystemPrompt(base, undefined)).toBe(base);
    expect(injectTherapyCourseIntoSystemPrompt(base, null)).toBe(base);
    expect(formatTherapyCoursePromptBlock(undefined)).toBe("");
  });

  it("tells the patient it is the first appointment", () => {
    const block = formatTherapyCoursePromptBlock(
      buildCourseSessionContext({
        courseId: "c",
        sessionNumber: 1,
        plannedSessions: 8,
        treatmentPlan: null,
      }),
    );
    expect(block).toContain(THERAPY_COURSE_PROMPT_MARKER);
    expect(block).toContain("session 1");
    expect(block).toContain("first appointment");
    expect(block).not.toContain("treatment plan to you");
    expect(block).toContain("confidentiality");
  });

  it("the first session after the plan is a negotiation the therapist leads", () => {
    const ctx = buildCourseSessionContext({
      courseId: "c",
      sessionNumber: 3,
      plannedSessions: 10,
      treatmentPlan: plan,
      planIsNew: true,
    });
    expect(ctx.plan_is_new).toBe(true);
    const block = formatTherapyCoursePromptBlock(ctx);
    expect(block).toContain("you have not heard it yet");
    expect(block).toContain("negotiation");
    expect(block).not.toContain("In an earlier session the therapist explained");
  });

  it("never gives the patient the clinician-only risk formulation", () => {
    for (const planIsNew of [true, false]) {
      const block = formatTherapyCoursePromptBlock(
        buildCourseSessionContext({
          courseId: "c",
          sessionNumber: 4,
          plannedSessions: 10,
          treatmentPlan: plan,
          planIsNew,
        }),
      );
      expect(block).not.toContain("alcohol");
      expect(block).not.toContain("safety plan");
    }
  });

  it("never gives the patient the clinician-only 5 Ps formulation", () => {
    for (const planIsNew of [true, false]) {
      const block = formatTherapyCoursePromptBlock(
        buildCourseSessionContext({
          courseId: "c",
          sessionNumber: 4,
          plannedSessions: 10,
          treatmentPlan: plan,
          planIsNew,
        }),
      );
      for (const text of Object.values(plan.five_ps ?? {})) {
        expect(block).not.toContain(text);
      }
      expect(block).not.toContain("age 12");
    }
  });

  it("the last sessions before the final one are a relapse-prevention phase", () => {
    const at = (n: number) =>
      formatTherapyCoursePromptBlock(
        buildCourseSessionContext({
          courseId: "c",
          sessionNumber: n,
          plannedSessions: 10,
          treatmentPlan: plan,
        }),
      );
    expect(at(7)).not.toContain("nearing its end");
    expect(at(8)).toContain("nearing its end (2 sessions after this one)");
    expect(at(9)).toContain("nearing its end (1 session after this one)");
    expect(at(10)).not.toContain("nearing its end");
    expect(at(10)).toContain("last session");
  });

  it("knows whether the plan is new to the patient", () => {
    const c = { treatment_plan: plan, plan_updated_at: "2026-10-04T10:00:00Z" };
    expect(isPlanNew(c, "2026-10-04T09:00:00Z")).toBe(true);
    expect(isPlanNew(c, "2026-10-04T11:00:00Z")).toBe(false);
    expect(isPlanNew({ treatment_plan: null, plan_updated_at: null }, null)).toBe(false);
  });

  it("carries the plan and continuity from session 3 on", () => {
    const ctx = buildCourseSessionContext({
      courseId: "c",
      sessionNumber: 3,
      plannedSessions: 10,
      treatmentPlan: plan,
    });
    const out = injectTherapyCourseIntoSystemPrompt(base, ctx);
    expect(out.startsWith(base)).toBe(true);
    expect(out).toContain("already met this therapist 2 times");
    expect(out).toContain("Return to using the metro");
    expect(out).toContain("about 10 sessions");
    expect(out).toContain("not instructions to you");
    expect(out).not.toContain("last session");
    // Idempotent.
    expect(injectTherapyCourseIntoSystemPrompt(out, ctx)).toBe(out);
  });

  it("marks the final session as termination", () => {
    const ctx = buildCourseSessionContext({
      courseId: "c",
      sessionNumber: 10,
      plannedSessions: 10,
      treatmentPlan: plan,
    });
    expect(ctx.is_final_session).toBe(true);
    expect(formatTherapyCoursePromptBlock(ctx)).toContain("last session");
  });

  it("clips very long trainee text", () => {
    const ctx = buildCourseSessionContext({
      courseId: "c",
      sessionNumber: 3,
      plannedSessions: 10,
      treatmentPlan: { ...plan, formulation: "x".repeat(5000) },
    });
    expect(formatTherapyCoursePromptBlock(ctx).length).toBeLessThan(4000);
  });
});

describe("therapy course persistence helpers", () => {
  it("detects a missing table or column", () => {
    expect(isCourseSchemaMissing({ code: "42P01", message: "x" })).toBe(true);
    expect(isCourseSchemaMissing({ code: "PGRST205", message: "x" })).toBe(true);
    expect(
      isCourseSchemaMissing({
        message: 'column sessions.therapy_course_id does not exist',
      }),
    ).toBe(true);
    expect(isCourseSchemaMissing({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isCourseSchemaMissing(null)).toBe(false);
  });
});

describe("therapy course wiring", () => {
  const root = join(process.cwd(), "src");

  it("both message transports get the course block through clinical-turn", () => {
    const src = readFileSync(join(root, "lib/sessions/clinical-turn.ts"), "utf8");
    expect(src).toMatch(/injectTherapyCourseIntoSystemPrompt\(\s*memoryCtx\.systemPrompt/);
  });

  it("session start gates session 3 on the plan and reuses the pinned case", () => {
    const src = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    expect(src).toMatch(/treatment_plan_required/);
    expect(src).toMatch(/caseFromCourse\(continuing\.course\)/);
    // New courses still mint a fresh CaseInstance.
    expect(src).toMatch(/createCaseForSession/);
  });
});
