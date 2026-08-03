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
 * - Optional writer for ACE competency upserts + CGE remediation/attempts
 *   when learner RLS denies UPDATE (ownership still enforced in app logic)
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
 * Prefer service role for learner-progress writes when configured; otherwise
 * use the authenticated request client (may fail under hardened RLS).
 */
export function privilegedWriter(
  userClient: SupabaseClient,
): SupabaseClient {
  return createServiceClient() ?? userClient;
}
