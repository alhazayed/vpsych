/**
 * Maps a failed POST /api/sessions response to a localized message key under
 * `session.start`. Server error strings are English and may be generic, so the
 * learner-facing copy is chosen by status instead of echoing them.
 */
export type SessionStartErrorKey =
  | "signedOut"
  | "rateLimited"
  | "patientUnavailable"
  | "failed";

export function sessionStartErrorKey(status: number): SessionStartErrorKey {
  if (status === 401) return "signedOut";
  if (status === 429) return "rateLimited";
  if (status === 404 || status === 409 || status === 422) return "patientUnavailable";
  return "failed";
}
