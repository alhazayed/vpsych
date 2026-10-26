/**
 * Maps failed review and link API responses to localized message keys. The
 * routes answer in English; the screens choose their EN/AR copy by the
 * response `code` (or status).
 *
 * Client components import this file directly: the barrel also exports the
 * server-side loader.
 */
import type { ReviewValidationError } from "./validation";

/** Keys under `supervisorReviews.errors`. */
export type ReviewErrorKey =
  | "commentTooLong"
  | "scoreInvalid"
  | "commentRequired"
  | "reviewEmpty"
  | "forbidden"
  | "notFound"
  | "signedOut"
  | "rateLimited"
  | "failed";

const CODE_KEYS: Record<ReviewValidationError | "review_forbidden" | "review_not_found", ReviewErrorKey> = {
  comment_invalid: "failed",
  comment_too_long: "commentTooLong",
  score_invalid: "scoreInvalid",
  comment_required: "commentRequired",
  flag_invalid: "failed",
  review_empty: "reviewEmpty",
  review_forbidden: "forbidden",
  review_not_found: "notFound",
};

export function reviewErrorKey(status: number, code?: string | null): ReviewErrorKey {
  if (code && Object.hasOwn(CODE_KEYS, code)) return CODE_KEYS[code as keyof typeof CODE_KEYS];
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  return "failed";
}

/** Keys under `supervisorReviews.links`. */
export type LinkErrorKey =
  | "mfaRequired"
  | "notSupervisor"
  | "notApplied"
  | "rateLimited"
  | "changeFailed";

export function linkErrorKey(status: number, code?: string | null): LinkErrorKey {
  if (code === "MFA_REQUIRED") return "mfaRequired";
  if (code === "NOT_SUPERVISOR") return "notSupervisor";
  if (code === "LINK_NOT_UPDATED" || status === 409) return "notApplied";
  if (status === 429) return "rateLimited";
  return "changeFailed";
}
