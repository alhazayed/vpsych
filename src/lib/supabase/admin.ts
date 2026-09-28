import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  buildSignedMessageRpcArgs,
  type MessageRpcArgs,
  type MessageRpcRole,
} from "@/lib/report-sign";

/**
 * Privileged server client (service role). Prefer HMAC-signed
 * `create_session_report` RPC via `REPORT_WRITE_KEY` when possible.
 *
 * Allowed call sites: Route Handlers / Server Actions only.
 * Allowed uses today:
 * - `session_reports` privileged insert/update in `POST /api/sessions/[id]/end`
 * - Optional writer for `insert_system_message` / `insert_assistant_message`
 *   (ownership checks still run in the SECURITY DEFINER RPCs; non-service
 *   callers must pass HMAC p_sig — Phase 8.2 / CQG-011)
 * - Optional writer for Mission 4 `patient_long_term_memory` upsert on session end
 *   (falls back to the authenticated client; RLS enforces therapist ownership)
 * - Scheduled `GET /api/cron/expire-sessions` batch expiry (CRON_SECRET gated)
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Prefer service role for message RPCs when configured; otherwise use the
 * authenticated request client. When falling back to the user client, callers
 * MUST attach a valid HMAC `p_sig` (see `prepareMessageRpc`).
 */
export function messageRpcClient(
  userClient: SupabaseClient,
): SupabaseClient {
  return createServiceClient() ?? userClient;
}

export type PreparedMessageRpc =
  | {
      ok: true;
      client: SupabaseClient;
      args: MessageRpcArgs;
      usingServiceRole: boolean;
    }
  | { ok: false; error: string };

/**
 * Resolve writer client + signed RPC args for assistant/system inserts.
 * Browser never receives the signing key; only Route Handlers call this.
 */
export function prepareMessageRpc(
  userClient: SupabaseClient,
  params: {
    sessionId: string;
    content: string;
    role: MessageRpcRole;
    /** Phase 9.1S — required when role is assistant (atomic tip identity). */
    userMessageId?: string | null;
  },
): PreparedMessageRpc {
  const service = createServiceClient();
  const usingServiceRole = Boolean(service);
  const client = service ?? userClient;
  const signed = buildSignedMessageRpcArgs({
    sessionId: params.sessionId,
    content: params.content,
    role: params.role,
    usingServiceRole,
    userMessageId: params.userMessageId,
  });
  if (!signed.ok) return signed;
  return {
    ok: true,
    client,
    args: signed.args,
    usingServiceRole,
  };
}

/** True when a PostgREST/RPC error represents a superseded tip (Phase 9.1S). */
export function isAssistantPersistSupersededError(
  error: { message?: string | null; code?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "");
  if (/turn superseded/i.test(msg)) return true;
  // Postgres RAISE EXCEPTION default SQLSTATE P0001 surfaces as code P0001 / 22P02 variants.
  if (error.code === "P0001" && /superseded/i.test(msg)) return true;
  return false;
}
