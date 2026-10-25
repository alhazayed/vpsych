import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRAINEE_FEEDBACK_MAX_CHARS,
  feedbackForTrainee,
  mentionsScore,
  normalizeTraineeFeedback,
  traineeFeedbackView,
} from "@/lib/sessions/trainee-feedback";
import { parseAssessmentModelText } from "@/lib/ai/assessment-parse";
import { buildExaminerSystemPrompt } from "@/lib/ai/report-locale";

const root = join(__dirname, "..", "..", "..");

describe("mentionsScore", () => {
  it.each([
    "You scored 3/5 on alliance.",
    "Alliance was 4 out of 5.",
    "About 60% of your questions were open.",
    "Your score improved.",
    "حصلت على ٣/٥ في التحالف.",
    "درجتك في التحالف جيدة.",
    "كانت ٦٠٪ من أسئلتك مفتوحة.",
  ])("flags %s", (text) => {
    expect(mentionsScore(text)).toBe(true);
  });

  it.each([
    "You asked open questions about sleep.",
    "Try graded exposure language when you plan homework.",
    "You checked the PHQ-9 items in the patient's own words.",
    "سألتَ أسئلة مفتوحة عن النوم.",
    "إلى حدّ ما، لخّصت ما قالته المريضة.",
  ])("keeps %s", (text) => {
    expect(mentionsScore(text)).toBe(false);
  });
});

describe("normalizeTraineeFeedback", () => {
  it("keeps up to three trimmed items per list and drops score-like ones", () => {
    const fb = normalizeTraineeFeedback({
      strengths: ["  You reflected feelings.  ", "You scored 4/5.", 7, ""],
      missed: ["a", "b", "c", "d"],
      next_steps: "not a list",
    });
    expect(fb).toEqual({
      strengths: ["You reflected feelings."],
      missed: ["a", "b", "c"],
      next_steps: [],
    });
  });

  it("caps long items", () => {
    const fb = normalizeTraineeFeedback({ strengths: ["x".repeat(500)] });
    expect(fb?.strengths[0]?.length).toBe(TRAINEE_FEEDBACK_MAX_CHARS);
  });

  it("returns null when nothing is left", () => {
    expect(normalizeTraineeFeedback(null)).toBeNull();
    expect(normalizeTraineeFeedback([])).toBeNull();
    expect(normalizeTraineeFeedback({ strengths: ["Score: 80%"] })).toBeNull();
  });
});

describe("feedbackForTrainee (sealed ladder case)", () => {
  const labels = ["major depressive disorder", "MDD", "اضطراب الاكتئاب"];

  it("drops items that name the diagnosis, in English and Arabic", () => {
    const fb = feedbackForTrainee(
      {
        strengths: ["You screened for MDD early.", "You asked about sleep."],
        missed: ["لم تسأل عن اضطراب الاكتئاب لدى العائلة."],
        next_steps: ["Ask about appetite."],
      },
      labels,
    );
    expect(fb).toEqual({
      strengths: ["You asked about sleep."],
      missed: [],
      next_steps: ["Ask about appetite."],
    });
  });

  it("leaves practice sessions (no labels) untouched", () => {
    const fb = feedbackForTrainee({ strengths: ["You screened for MDD early."] });
    expect(fb?.strengths).toEqual(["You screened for MDD early."]);
  });
});

describe("traineeFeedbackView", () => {
  it("shows nothing without a report row", () => {
    expect(traineeFeedbackView(null)).toEqual({ kind: "none" });
  });

  it("says not available for a heuristic report", () => {
    expect(
      traineeFeedbackView({
        feedback: { strengths: ["x"] },
        assessment_mode: "heuristic_fallback",
      }),
    ).toEqual({ kind: "unavailable" });
  });

  it("shows nothing for an older report without feedback", () => {
    expect(
      traineeFeedbackView({ feedback: null, assessment_mode: "llm_examiner" }),
    ).toEqual({ kind: "none" });
  });

  it("returns the feedback for an examiner report", () => {
    expect(
      traineeFeedbackView({
        feedback: { strengths: ["You asked about sleep."], missed: [], next_steps: [] },
        assessment_mode: "llm_examiner",
      }),
    ).toEqual({
      kind: "feedback",
      feedback: { strengths: ["You asked about sleep."], missed: [], next_steps: [] },
    });
  });
});

describe("examiner output and prompt", () => {
  it("parses trainee_feedback and still parses reports without it", () => {
    const withFb = parseAssessmentModelText(
      JSON.stringify({
        items: [{ id: "alliance", score: 4, feedback: "ok" }],
        narrative: "n",
        excerpts: [],
        trainee_feedback: { strengths: ["s"], missed: [], next_steps: [] },
      }),
    );
    expect(normalizeTraineeFeedback(withFb.trainee_feedback)?.strengths).toEqual(["s"]);
    const without = parseAssessmentModelText(
      JSON.stringify({ items: [], narrative: "n", excerpts: [] }),
    );
    expect(without.trainee_feedback).toBeUndefined();
  });

  it.each(["en", "ar"] as const)(
    "asks for trainee_feedback without scores or diagnosis (%s)",
    (language) => {
      const prompt = buildExaminerSystemPrompt({
        language,
        patientName: "P",
        disorder: "D",
        approach: "",
        goals: "",
        durationSec: 600,
        rubricLines: "alliance — Alliance",
      });
      expect(prompt).toContain("trainee_feedback");
      expect(prompt).toContain('"next_steps"');
      expect(prompt).toMatch(language === "en" ? /Never name the diagnosis/ : /ممنوع ذكر التشخيص/);
      expect(prompt).toMatch(language === "en" ? /Never mention a score/ : /ممنوع ذكر أي درجة/);
    },
  );
});

describe("trainee feedback stays words-only (source guardrails)", () => {
  it("the complete page reads feedback through the RPC, never the report table", () => {
    const page = readFileSync(
      join(root, "src/app/(app)/sessions/[id]/complete/page.tsx"),
      "utf8",
    );
    expect(page).toContain('rpc("my_session_feedback"');
    expect(page).not.toMatch(/from\(\s*["']session_reports["']\s*\)/);
    // A sealed case that cannot be opened must show nothing.
    expect(page).toMatch(/typed\.sealed_case && !opened\.ok/);
  });

  it("the RPC returns only the feedback words, owner only, never for a skill test", () => {
    const sql = readFileSync(
      join(root, "supabase/migrations/20261025213000_my_session_feedback.sql"),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("AS $$"), sql.lastIndexOf("$$;"));
    expect(body).toMatch(/r\.scores -> 'trainee_feedback'/);
    expect(body).not.toMatch(/'items'|'overall'|narrative|excerpts/);
    expect(body).toMatch(/s\.therapist_id = \(select auth\.uid\(\)\)/);
    expect(body).toMatch(/s\.skill_test_assignment_id IS NULL/);
    expect(body).toMatch(/\(select public\.is_approved\(\)\)/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.my_session_feedback\(uuid\) FROM public, anon/);
  });
});
