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
 * - Required writer for `insert_system_message` / `insert_assistant_message`
 *   (EXECUTE revoked from authenticated; RPCs require service_role)
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
 * Message RPCs are service_role-only (Mission 20). Never fall back to the
 * authenticated client — that path enabled transcript forge via PostgREST.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is unset (caller must 500).
 */
export function messageRpcClient(
  _userClient?: SupabaseClient,
): SupabaseClient | null {
  return createServiceClient();
}
