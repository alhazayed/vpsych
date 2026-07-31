import { createHmac } from "crypto";

export function getReportWriteKey(): string | null {
  const key = process.env.REPORT_WRITE_KEY?.trim() || "";
  return key || null;
}

/** Canonical payload must match public.create_session_report HMAC input. */
export function buildReportSignaturePayload(params: {
  sessionId: string;
  narrative: string;
  scoresJson: string;
  excerptsJson: string;
}) {
  return `${params.sessionId}\n${params.narrative}\n${params.scoresJson}\n${params.excerptsJson}`;
}

export function signSessionReport(params: {
  sessionId: string;
  narrative: string;
  scoresJson: string;
  excerptsJson: string;
  key?: string | null;
}) {
  const key = params.key ?? getReportWriteKey();
  if (!key) {
    throw new Error(
      "REPORT_WRITE_KEY is required to sign session reports (or set SUPABASE_SERVICE_ROLE_KEY for direct inserts)",
    );
  }
  const payload = buildReportSignaturePayload(params);
  return createHmac("sha256", key).update(payload).digest("hex");
}
