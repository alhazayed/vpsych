/**
 * Creates the `sessions` row for POST /api/sessions.
 *
 * Signed-in trainees cannot insert sessions directly: the database accepts a
 * trainee's session only through `create_signed_session`, a SECURITY DEFINER
 * RPC that checks an HMAC over the exact row text (vault `report_write_key`,
 * the same key as the message RPCs). So a browser holding the trainee's token
 * cannot create a session with a patient it wrote itself.
 *
 * With `REPORT_WRITE_KEY` the request's own client calls the RPC with a
 * signature, so every per-user check in the database still runs. Without it
 * the service role calls the RPC unsigned.
 */
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReportWriteKey } from "@/lib/report-sign";
import { createServiceClient } from "@/lib/supabase/admin";

/** Must match the payload built inside create_signed_session. */
export function buildSessionRowSignaturePayload(rowText: string): string {
  return `session\n${rowText}`;
}

export function signSessionRow(rowText: string, key: string): string {
  return createHmac("sha256", key)
    .update(buildSessionRowSignaturePayload(rowText))
    .digest("hex");
}

export type CreateSessionRowResult = {
  data: { id: string } | null;
  error: { message: string; code?: string } | null;
};

/** PostgREST: the function is not in its schema cache (migration not applied). */
function isMissingRpc(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function public\.create_signed_session/i.test(
      error.message ?? "",
    )
  );
}

export async function createSessionRow(
  userClient: SupabaseClient,
  row: Record<string, unknown>,
): Promise<CreateSessionRowResult> {
  const key = getReportWriteKey();
  const service = key ? null : createServiceClient();
  if (!key && !service) {
    return {
      data: null,
      error: {
        message:
          "Session signing unavailable. Configure REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY.",
      },
    };
  }

  const rowText = JSON.stringify(row);
  const args: Record<string, unknown> = { p_row: rowText };
  if (key) args.p_sig = signSessionRow(rowText, key);

  const { data, error } = await (service ?? userClient).rpc(
    "create_signed_session",
    args,
  );
  if (error && isMissingRpc(error)) {
    // Until migration 20261101170000 is applied the database still takes the
    // direct insert (its guard does not ask for a signature yet).
    return userClient.from("sessions").insert(row).select("id").single();
  }
  if (error) return { data: null, error };
  if (typeof data !== "string" || !data) {
    return { data: null, error: { message: "create_signed_session returned no id" } };
  }
  return { data: { id: data }, error: null };
}
