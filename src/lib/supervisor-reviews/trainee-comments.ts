import type { SupabaseClient } from "@supabase/supabase-js";
import { sealedDiagnosisLabels } from "@/lib/ai/diagnosis-labels";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { isCaseSealed, withSkillTestCase } from "@/lib/skill-tests";
import { citesAdjustedScore, commentHiddenReason } from "./comment-visibility";

export { citesAdjustedScore, commentHiddenReason };

/**
 * Supervisor comments the trainee may read on their own practice session
 * (`my_session_review_comments()`, practice only, never skill tests). The
 * review route decides `trainee_visible` when the review is saved: a comment
 * is hidden when it reads like a score, quotes its own adjusted score, or, on
 * a sealed ladder level, names the diagnosis. The database returns only
 * marked comments, with the reviewer's name and time; scores and flags never
 * leave it. The page filters again as a second line. Supervisors are told
 * this beside the comment box.
 */
export type ReviewCommentRow = {
  comment: string | null;
  reviewer_name: string | null;
  updated_at: string;
};

type ReviewedSession = {
  id: string;
  skill_test_assignment_id: string | null;
  sealed_case: string | null;
  clinical_snapshot: CaseInstanceSnapshot | null;
};

/**
 * Server-side, when a review is saved: may the trainee read this comment?
 * Never on a skill test, never when a sealed case cannot be opened.
 */
export function traineeMayReadComment(
  session: ReviewedSession,
  comment: string | null,
  adjustedOverall: number | null,
): boolean {
  if (!comment?.trim() || session.skill_test_assignment_id) return false;
  const opened = withSkillTestCase(session);
  if (!opened.ok) return false;
  const sealedLabels = isCaseSealed(session)
    ? sealedDiagnosisLabels(opened.session.clinical_snapshot)
    : [];
  return (
    commentHiddenReason(comment, {
      citesReviewNumber:
        adjustedOverall !== null && citesAdjustedScore(comment, adjustedOverall),
      sealedLabels,
    }) === null
  );
}

export type TraineeReviewComment = {
  comment: string;
  reviewerName: string | null;
  updatedAt: string;
};

export function traineeVisibleComments(
  rows: readonly ReviewCommentRow[],
  sealedLabels: readonly string[] = [],
): TraineeReviewComment[] {
  const out: TraineeReviewComment[] = [];
  for (const row of rows) {
    const comment = row.comment?.trim();
    if (!comment) continue;
    if (commentHiddenReason(comment, { sealedLabels })) continue;
    out.push({ comment, reviewerName: row.reviewer_name, updatedAt: row.updated_at });
  }
  return out;
}

/**
 * Load and filter. A failed read logs and returns an empty list: the
 * comments card then stays hidden and the rest of the page still renders.
 */
export async function loadTraineeReviewComments(
  supabase: SupabaseClient,
  sessionId: string,
  sealedLabels: readonly string[] = [],
): Promise<TraineeReviewComment[]> {
  const { data, error } = await supabase.rpc("my_session_review_comments", {
    p_session_id: sessionId,
  });
  if (error) {
    console.warn("[supervisor-reviews] my_session_review_comments failed", {
      sessionId,
      error: error.message,
    });
    return [];
  }
  return traineeVisibleComments((data ?? []) as ReviewCommentRow[], sealedLabels);
}
