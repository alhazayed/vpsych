import type { SupabaseClient } from "@supabase/supabase-js";
import { sealedDiagnosisLabels } from "@/lib/ai/diagnosis-labels";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { isCaseSealed, withSkillTestCase } from "@/lib/skill-tests";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  traineeFeedbackView,
  type MySessionFeedbackRow,
} from "@/lib/sessions/trainee-feedback";

/**
 * "Try next time" from the trainee's latest practice session, shown again
 * before the next one so a session starts with one thing to practise. Same
 * words and filters as the complete page (no scores; on a sealed ladder level
 * no item naming the diagnosis). Never from a skill test: the RPC returns
 * nothing for one and the query leaves them out.
 */
export type PracticeFocus = {
  sessionId: string;
  endedAt: string | null;
  language: "en" | "ar";
  nextSteps: string[];
};

/** Sessions read to find the latest one with feedback. */
export const PRACTICE_FOCUS_LOOKBACK = 3;

export type FocusCandidate = {
  id: string;
  ended_at: string | null;
  language: string | null;
  skill_test_assignment_id: string | null;
  sealed_case: string | null;
  clinical_snapshot: CaseInstanceSnapshot | null;
};

/** The focus a session's feedback row gives, or null when it gives none. */
export function focusFromFeedback(
  session: FocusCandidate,
  row: MySessionFeedbackRow | null,
): PracticeFocus | null {
  if (session.skill_test_assignment_id) return null;
  if (isAdminTestSnapshot(session.clinical_snapshot)) return null;
  const opened = withSkillTestCase(session);
  // A sealed case that cannot be opened shows nothing (fail closed).
  if (isCaseSealed(session) && !opened.ok) return null;
  const labels =
    isCaseSealed(session) && opened.ok
      ? sealedDiagnosisLabels(opened.session.clinical_snapshot)
      : [];
  const view = traineeFeedbackView(row, labels);
  if (view.kind !== "feedback" || view.feedback.next_steps.length === 0) return null;
  return {
    sessionId: session.id,
    endedAt: session.ended_at,
    language: normalizeReportLanguage(session.language),
    nextSteps: view.feedback.next_steps,
  };
}

/**
 * Latest focus for this trainee. Best effort: a failed read logs and returns
 * null, which only hides the card.
 */
export async function loadPracticeFocus(
  supabase: SupabaseClient,
  userId: string,
): Promise<PracticeFocus | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, ended_at, language, skill_test_assignment_id, sealed_case, clinical_snapshot")
    .eq("therapist_id", userId)
    .in("status", ["completed", "expired"])
    .is("skill_test_assignment_id", null)
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(PRACTICE_FOCUS_LOOKBACK);
  if (error) {
    console.warn("[practice-focus] sessions load failed", { error: error.message });
    return null;
  }
  for (const session of (data ?? []) as FocusCandidate[]) {
    if (isAdminTestSnapshot(session.clinical_snapshot)) continue;
    const { data: row, error: rowError } = await supabase
      .rpc("my_session_feedback", { p_session_id: session.id })
      .maybeSingle<MySessionFeedbackRow>();
    if (rowError) {
      console.warn("[practice-focus] my_session_feedback failed", {
        sessionId: session.id,
        error: rowError.message,
      });
      return null;
    }
    const focus = focusFromFeedback(session, row ?? null);
    if (focus) return focus;
  }
  return null;
}
