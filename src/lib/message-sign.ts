import { createHmac } from "crypto";
import { getReportWriteKey } from "@/lib/report-sign";

export type MessageWriteRole = "assistant" | "system";

/** Canonical payload for insert_*_message HMAC (must match SQL). */
export function buildMessageSignaturePayload(params: {
  sessionId: string;
  content: string;
  role: MessageWriteRole;
}) {
  return `${params.sessionId}\n${params.content}\n${params.role}`;
}

/**
 * Sign an assistant/system message write for authenticated RPC fallback
 * (CQG-011). Uses REPORT_WRITE_KEY — same vault secret as create_session_report.
 */
export function signSessionMessage(params: {
  sessionId: string;
  content: string;
  role: MessageWriteRole;
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

/**
 * Build RPC args for insert_assistant_message / insert_system_message.
 * When using the user client (no service role), attach HMAC. Service role
 * callers may omit the signature.
 */
export function messageRpcArgs(params: {
  sessionId: string;
  content: string;
  role: MessageWriteRole;
  /** True when the writer is the service-role client. */
  serviceRole: boolean;
}) {
  const base = {
    p_session_id: params.sessionId,
    p_content: params.content,
  };
  if (params.serviceRole) {
    return base;
  }
  return {
    ...base,
    p_sig: signSessionMessage({
      sessionId: params.sessionId,
      content: params.content,
      role: params.role,
    }),
  };
}
