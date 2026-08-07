import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Privileged server client (service role). Prefer HMAC-signed
 * `create_session_report` RPC via `REPORT_WRITE_KEY` when possible.
 *
 * Allowed call sites: Route Handlers / Server Actions only.
 * Allowed uses today:
 * - `session_reports` privileged insert/update in `POST /api/sessions/[id]/end`
 * - Optional writer for `insert_system_message` / `insert_assistant_message`
 *   (ownership checks still run in the SECURITY DEFINER RPCs)
 * - Optional writer for Mission 4 `patient_long_term_memory` upsert on session end
 *   (falls back to the authenticated client; RLS enforces therapist ownership)
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
 * authenticated request client. Session message RPCs enforce ownership /
 * active-session / turn-order in the function body, and authenticated EXECUTE
 * is intentionally granted for this fallback (see restore_session_message_rpc_grants).
 */
export function messageRpcClient(
  userClient: SupabaseClient,
): SupabaseClient {
  return createServiceClient() ?? userClient;
}
