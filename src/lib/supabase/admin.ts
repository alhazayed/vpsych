import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged server client (service role). Prefer HMAC-signed
 * `create_session_report` RPC via `REPORT_WRITE_KEY` when possible.
 *
 * Allowed call sites: Route Handlers / Server Actions only.
 * Allowed tables today: `session_reports` privileged insert/update in
 * `POST /api/sessions/[id]/end`. Do not expand without an architecture review.
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
