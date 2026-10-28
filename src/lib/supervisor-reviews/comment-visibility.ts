import { namesSealedDiagnosis } from "@/lib/ai/diagnosis-labels";
import { mentionsScore } from "@/lib/sessions/trainee-feedback";

/**
 * The rules that keep a supervisor comment from the trainee. Pure, so the
 * review form can warn as the supervisor types; the review route applies the
 * same rules on save (trainee-comments.ts).
 */

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/**
 * True when the comment contains `score` as a whole number (Arabic-Indic
 * digits count). my_session_review_comments() applies the same rule in SQL.
 */
export function citesAdjustedScore(comment: string, score: number): boolean {
  const western = comment.replace(ARABIC_DIGITS, (d) =>
    String((d.charCodeAt(0) - (d.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)) % 10),
  );
  return new RegExp(`(^|[^0-9])0*${Math.trunc(score)}([^0-9]|$)`).test(western);
}

/** Why a comment would not reach the trainee, or null when it would. */
export function commentHiddenReason(
  comment: string,
  opts: { citesReviewNumber?: boolean; sealedLabels?: readonly string[] } = {},
): "score" | "diagnosis" | null {
  if (opts.citesReviewNumber || mentionsScore(comment)) return "score";
  if (opts.sealedLabels?.length && namesSealedDiagnosis(comment, opts.sealedLabels)) {
    return "diagnosis";
  }
  return null;
}
