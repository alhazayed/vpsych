/**
 * Request validation for supervisor report reviews. Mirrors the checks in
 * migration 20261026051005 so a bad request gets a clear code before the
 * database refuses it.
 */

export const MAX_REVIEW_COMMENT = 4000;

export type ReviewInput = {
  comment: string | null;
  adjustedOverall: number | null;
  flagged: boolean;
};

export type ReviewValidationError =
  | "comment_invalid"
  | "comment_too_long"
  | "score_invalid"
  | "comment_required"
  | "flag_invalid"
  | "review_empty";

export const REVIEW_VALIDATION_CODES: readonly ReviewValidationError[] = [
  "comment_invalid",
  "comment_too_long",
  "score_invalid",
  "comment_required",
  "flag_invalid",
  "review_empty",
];

export function validateReviewInput(
  body: unknown,
): { ok: true; value: ReviewInput } | { ok: false; error: ReviewValidationError } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  let comment: string | null = null;
  if (raw.comment !== undefined && raw.comment !== null) {
    if (typeof raw.comment !== "string") return { ok: false, error: "comment_invalid" };
    const trimmed = raw.comment.trim();
    if (trimmed.length > MAX_REVIEW_COMMENT) return { ok: false, error: "comment_too_long" };
    comment = trimmed.length ? trimmed : null;
  }

  let adjustedOverall: number | null = null;
  const score = raw.adjustedOverall;
  if (score !== undefined && score !== null && score !== "") {
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100
    ) {
      return { ok: false, error: "score_invalid" };
    }
    adjustedOverall = score;
  }

  if (raw.flagged !== undefined && typeof raw.flagged !== "boolean") {
    return { ok: false, error: "flag_invalid" };
  }
  const flagged = raw.flagged === true;

  // A changed score must say why.
  if (adjustedOverall !== null && comment === null) {
    return { ok: false, error: "comment_required" };
  }
  if (comment === null && adjustedOverall === null && !flagged) {
    return { ok: false, error: "review_empty" };
  }
  return { ok: true, value: { comment, adjustedOverall, flagged } };
}
