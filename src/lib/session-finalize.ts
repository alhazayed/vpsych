/**
 * Whether the learner complete page should try to finalize (assess + persist)
 * a finished session's report. Pure; the caller still checks
 * `session_has_report` before acting.
 */
export function shouldOfferReportFinalize(input: {
  status: string;
  therapistId: string;
  viewerId: string;
  roles: ReadonlyArray<string>;
}): boolean {
  if (input.status === "active") return false;
  if (input.therapistId !== input.viewerId) return false;
  return input.roles.includes("user");
}
