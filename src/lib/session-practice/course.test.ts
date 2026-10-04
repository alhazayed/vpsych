import { describe, expect, it } from "vitest";
import {
  COURSE_CHANGE,
  applyCourseChange,
  baselineCourseSelfReport,
  buildCourseCarryOver,
  courseChangeFactor,
  extractHomework,
  formatSelfReportForPrompt,
  profileFromCourseSelfReport,
} from "@/lib/session-practice";
import { formatTherapyCoursePromptBlock } from "@/lib/therapy-course";
import type {
  ClinicalCore,
  TherapyCourseSessionContext,
  TreatmentPlan,
} from "@/lib/types";

const core = {
  disorder: "Major depressive disorder",
  age: 34,
  gender: "female",
  severity: "moderate",
  symptom_profile: [
    { id: "low_mood", description: "low mood", domain: "mood" },
    { id: "insomnia", description: "early waking", domain: "sleep" },
    { id: "worry", description: "worry", domain: "anxiety" },
  ],
  disclosure_rules: [],
  session_goals: [],
  ideal_approach: "",
  risk_profile: { suicidal_ideation: "passive" },
} as unknown as ClinicalCore;

const plan: TreatmentPlan = {
  formulation: "Low mood maintained by withdrawal.",
  goals: ["Sleep better"],
  interventions: "Behavioural activation",
  expected_sessions: 8,
  patient_expectations: "Weekly sessions",
  risk_formulation: "",
};

function convo(therapist: string[]) {
  return therapist.flatMap((t) => [
    { role: "user", content: t },
    { role: "assistant", content: "..." },
  ]);
}

const STRUCTURED = convo([
  "Last time we talked about your sleep.",
  "How has your mood been this week?",
  "What would you like to focus on today?",
  "How did the activity diary go?",
  "Tell me more.",
  "That makes sense.",
  "Let me summarise what we covered.",
  "This week, could you try one walk each morning?",
  "How did today's session feel for you?",
]);

const UNSTRUCTURED = convo(["Okay.", "Mm.", "I see.", "Right."]);

function ctx(overrides: Partial<TherapyCourseSessionContext> = {}): TherapyCourseSessionContext {
  return {
    course_id: "c1",
    session_number: 3,
    planned_sessions: 8,
    is_final_session: false,
    treatment_plan: plan,
    ...overrides,
  };
}

describe("extractHomework", () => {
  it("returns the therapist's closing homework turn", () => {
    expect(extractHomework(STRUCTURED)).toBe(
      "This week, could you try one walk each morning?",
    );
  });

  it("returns null when no homework was set", () => {
    expect(extractHomework(UNSTRUCTURED)).toBeNull();
  });

  it("finds Arabic homework", () => {
    expect(
      extractHomework(convo(["مرحبا", "كيف حالك؟", "خلال الأسبوع جرب تمشي كل يوم الصبح."])),
    ).toMatch(/خلال الأسبوع/);
  });
});

describe("courseChangeFactor", () => {
  it("improves most with a plan, good structure and homework", () => {
    expect(courseChangeFactor({ quality: 1, planInPlace: true, homeworkSet: true })).toBeCloseTo(
      COURSE_CHANGE.strong * COURSE_CHANGE.homework,
    );
  });

  it("barely moves before a plan exists", () => {
    expect(courseChangeFactor({ quality: 1, planInPlace: false, homeworkSet: true })).toBe(
      COURSE_CHANGE.assessment,
    );
    expect(courseChangeFactor({ quality: 0.2, planInPlace: false, homeworkSet: false })).toBe(1);
  });

  it("worsens slightly when a planned session has almost no structure", () => {
    expect(courseChangeFactor({ quality: 0, planInPlace: true, homeworkSet: false })).toBe(
      COURSE_CHANGE.worse,
    );
  });
});

describe("applyCourseChange", () => {
  const baseline = baselineCourseSelfReport(core);

  it("keeps PHQ-9 item 9 tied to the case risk", () => {
    const next = applyCourseChange(baseline, baseline, 0.5);
    expect(next.phq9[8]).toBe(baseline.phq9[8]);
    expect(next.trend).toBe("improving");
  });

  it("never rises more than half a step above baseline", () => {
    let r = baseline;
    for (let i = 0; i < 20; i++) r = applyCourseChange(r, baseline, 1.05);
    r.phq9.forEach((v, i) => expect(v).toBeLessThanOrEqual(Math.min(3, baseline.phq9[i]! + 0.5)));
    expect(r.trend).toBe("worsening");
  });

  it("moves totals down gradually over good sessions", () => {
    let r = baseline;
    const totals = [profileFromCourseSelfReport(r).phq9.total];
    for (let i = 0; i < 5; i++) {
      r = applyCourseChange(r, baseline, COURSE_CHANGE.strong);
      totals.push(profileFromCourseSelfReport(r).phq9.total);
    }
    expect(totals.at(-1)!).toBeLessThan(totals[0]!);
    for (let i = 1; i < totals.length; i++) expect(totals[i]!).toBeLessThanOrEqual(totals[i - 1]!);
  });
});

describe("buildCourseCarryOver", () => {
  it("starts a course at baseline with no homework", () => {
    const c = buildCourseCarryOver({ core, previous: null });
    expect(c.self_report?.trend).toBe("baseline");
    expect(c.previous_homework).toBeNull();
  });

  it("carries homework and improvement from a structured planned session", () => {
    const previous = {
      sessionNumber: 3,
      messages: STRUCTURED,
      context: ctx({ self_report: baselineCourseSelfReport(core) }),
    };
    const c = buildCourseCarryOver({ core, previous });
    expect(c.previous_homework).toMatch(/walk each morning/);
    expect(c.self_report?.trend).toBe("improving");
  });

  it("does not improve after an unstructured session", () => {
    const previous = { sessionNumber: 3, messages: UNSTRUCTURED, context: ctx() };
    const c = buildCourseCarryOver({ core, previous });
    expect(c.self_report?.trend).toBe("worsening");
    expect(c.previous_homework).toBeNull();
  });
});

describe("course prompts", () => {
  it("self-report block uses the course levels and trend", () => {
    const course = applyCourseChange(
      baselineCourseSelfReport(core),
      baselineCourseSelfReport(core),
      0.5,
    );
    const block = formatSelfReportForPrompt(core, course);
    expect(block).toMatch(/eased a little/);
    expect(formatSelfReportForPrompt(core)).not.toMatch(/Since your last session/);
  });

  it("course block mentions last session's homework from session 2 on", () => {
    const block = formatTherapyCoursePromptBlock(
      ctx({ session_number: 2, treatment_plan: null, previous_homework: "Write down your worries." }),
    );
    expect(block).toMatch(/Write down your worries\./);
    expect(block).toMatch(/done part of it, forgotten, or avoided it/);
  });

  it("course block has no homework line without homework", () => {
    expect(formatTherapyCoursePromptBlock(ctx())).not.toMatch(/last session the therapist suggested/);
  });
});
