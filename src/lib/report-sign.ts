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

/**
 * Canonical payload for insert_assistant_message / insert_system_message.
 * Must match PostgreSQL: sessionId || E'\n' || content || E'\n' || role
 */
export function buildMessageSignaturePayload(params: {
  sessionId: string;
  content: string;
  role: "assistant" | "system";
}) {
  return `${params.sessionId}\n${params.content}\n${params.role}`;
}

/** HMAC-SHA256 hex for non-service_role callers of message RPCs (Phase 8.2 / CQG-011). */
export function signSessionMessage(params: {
  sessionId: string;
  content: string;
  role: "assistant" | "system";
  key?: string | null;
}) {
  const key = params.key ?? getReportWriteKey();
  if (!key) {
    throw new Error(
      "REPORT_WRITE_KEY is required to sign session messages when SUPABASE_SERVICE_ROLE_KEY is unset",
    );
  }
  const payload = buildMessageSignaturePayload(params);
  return createHmac("sha256", key).update(payload).digest("hex");
}

export type MessageRpcRole = "assistant" | "system";

export type MessageRpcArgs = {
  p_session_id: string;
  p_content: string;
  p_sig?: string;
};

/**
 * Build RPC args for message inserts.
 * - With service role: p_sig omitted (DB bypasses HMAC).
 * - Without service role: requires REPORT_WRITE_KEY and attaches p_sig.
 */
export function buildSignedMessageRpcArgs(params: {
  sessionId: string;
  content: string;
  role: MessageRpcRole;
  usingServiceRole: boolean;
  key?: string | null;
}): { ok: true; args: MessageRpcArgs } | { ok: false; error: string } {
  const base: MessageRpcArgs = {
    p_session_id: params.sessionId,
    p_content: params.content,
  };
  if (params.usingServiceRole) {
    return { ok: true, args: base };
  }
  try {
    const p_sig = signSessionMessage({
      sessionId: params.sessionId,
      content: params.content,
      role: params.role,
      key: params.key,
    });
    return { ok: true, args: { ...base, p_sig } };
  } catch {
    return {
      ok: false,
      error:
        "Message signing unavailable. Configure REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    };
  }
}
