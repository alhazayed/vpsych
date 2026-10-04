/**
 * Course carry-over — what one session in a therapy course hands to the next:
 * the homework the therapist set, and PHQ-9 / GAD-7 levels that move with the
 * quality of the previous session (measurement-based care).
 *
 * The movement rule is a simple, documented simulation model so trainees see
 * scores respond to how they work. It is not validated and must be labelled
 * that way wherever it is shown.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateSessionPractice, windowRange } from "@/lib/session-practice/checklist";
import { PRACTICE_PATTERNS } from "@/lib/session-practice/patterns";
import { baselineCourseSelfReport } from "@/lib/session-practice/self-report";
import type {
  ClinicalCore,
  CourseSelfReport,
  TherapyCourseSessionContext,
} from "@/lib/types";

const HOMEWORK_PATTERN = PRACTICE_PATTERNS.find((p) => p.id === "homework_set")!;
const MAX_HOMEWORK_CHARS = 300;

/** Multipliers applied to every item level except PHQ-9 item 9. */
export const COURSE_CHANGE = {
  /** Plan agreed, well-structured previous session. */
  strong: 0.85,
  /** Plan agreed, partly structured session. */
  partial: 0.93,
  /** Plan agreed, little structure: no change. */
  flat: 1,
  /** Plan agreed, almost no structure: slight worsening. */
  worse: 1.05,
  /** Assessment phase (no plan yet) with a well-structured session. */
  assessment: 0.97,
  /** Extra effect when homework was agreed in a planned session. */
  homework: 0.97,
} as const;

export const COURSE_SELF_REPORT_LIMITATION =
  "Simulated symptom course: scores move with session structure and homework under a fixed rule. Not a validated model of treatment response.";

/** The homework the therapist set at the end of a session, if any. */
export function extractHomework(
  messages: Array<{ role: string; content: string }>,
): string | null {
  const turns = messages.filter((m) => m.role === "user").map((m) => m.content ?? "");
  const [from, to] = windowRange(HOMEWORK_PATTERN.window, turns.length);
  for (let i = to - 1; i >= from; i--) {
    if (HOMEWORK_PATTERN.pattern.test(turns[i]!)) {
      const t = turns[i]!.replace(/\s+/g, " ").trim();
      return t.length <= MAX_HOMEWORK_CHARS ? t : `${t.slice(0, MAX_HOMEWORK_CHARS - 1)}…`;
    }
  }
  return null;
}

/** Structure coverage (0–1) of a session, the quality signal for the next. */
export function sessionStructureQuality(
  messages: Array<{ role: string; content: string }>,
  sessionNumber: number,
): number {
  const report = evaluateSessionPractice({ messages, sessionNumber });
  return report.groups.find((g) => g.group === "structure")?.coverage ?? 0;
}

export function courseChangeFactor(opts: {
  quality: number;
  planInPlace: boolean;
  homeworkSet: boolean;
}): number {
  if (!opts.planInPlace) {
    return opts.quality >= 0.6 ? COURSE_CHANGE.assessment : COURSE_CHANGE.flat;
  }
  let factor: number =
    opts.quality >= 0.6
      ? COURSE_CHANGE.strong
      : opts.quality >= 0.3
        ? COURSE_CHANGE.partial
        : opts.quality >= 0.15
          ? COURSE_CHANGE.flat
          : COURSE_CHANGE.worse;
  if (opts.homeworkSet && factor < 1) factor *= COURSE_CHANGE.homework;
  return factor;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Move the previous session's levels by `factor`, never above the baseline
 * by more than half a step and never outside 0–3. PHQ-9 item 9 stays tied to
 * the case risk profile. */
export function applyCourseChange(
  previous: CourseSelfReport,
  baseline: CourseSelfReport,
  factor: number,
): CourseSelfReport {
  const move = (levels: number[], base: number[], keepIndex: number | null) =>
    levels.map((v, i) =>
      i === keepIndex
        ? base[i] ?? v
        : round2(Math.max(0, Math.min(3, (base[i] ?? 3) + 0.5, v * factor))),
    );
  const trend: CourseSelfReport["trend"] =
    factor < 0.995 ? "improving" : factor > 1.005 ? "worsening" : "unchanged";
  return {
    phq9: move(previous.phq9, baseline.phq9, 8),
    gad7: move(previous.gad7, baseline.gad7, null),
    trend,
  };
}

export type PreviousCourseSession = {
  sessionNumber: number;
  messages: Array<{ role: string; content: string }>;
  context: TherapyCourseSessionContext | null;
};

/** Course fields for the next session's frozen context (pure). */
export function buildCourseCarryOver(opts: {
  core: ClinicalCore;
  previous: PreviousCourseSession | null;
}): Pick<TherapyCourseSessionContext, "self_report" | "previous_homework"> {
  const baseline = baselineCourseSelfReport(opts.core);
  if (!opts.previous) {
    return { self_report: baseline, previous_homework: null };
  }
  const homework = extractHomework(opts.previous.messages);
  const factor = courseChangeFactor({
    quality: sessionStructureQuality(opts.previous.messages, opts.previous.sessionNumber),
    planInPlace: Boolean(opts.previous.context?.treatment_plan),
    homeworkSet: homework !== null,
  });
  const prior = opts.previous.context?.self_report ?? baseline;
  return {
    self_report: applyCourseChange(prior, baseline, factor),
    previous_homework: homework,
  };
}

/**
 * Load the latest earlier session of a course (its number, transcript and
 * frozen course context). Best-effort: returns null on any error so session
 * start never fails because of carry-over.
 */
export async function loadPreviousCourseSession(
  supabase: SupabaseClient,
  courseId: string,
): Promise<PreviousCourseSession | null> {
  try {
    const { data: prev, error } = await supabase
      .from("sessions")
      .select("id, course_session_number, clinical_snapshot")
      .eq("therapy_course_id", courseId)
      .order("course_session_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !prev) return null;
    const row = prev as {
      id: string;
      course_session_number: number | null;
      clinical_snapshot: { therapy_course?: TherapyCourseSessionContext } | null;
    };
    const { data: messages } = await supabase
      .from("session_messages")
      .select("role, content")
      .eq("session_id", row.id)
      .order("created_at", { ascending: true });
    return {
      sessionNumber: row.course_session_number ?? 1,
      messages: (messages ?? []) as Array<{ role: string; content: string }>,
      context: row.clinical_snapshot?.therapy_course ?? null,
    };
  } catch {
    return null;
  }
}
