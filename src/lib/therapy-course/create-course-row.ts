/**
 * Creates the `therapy_courses` row for POST /api/sessions.
 *
 * A session that continues a course is built from the course row, so the
 * course must be one the server wrote. Signed-in trainees cannot insert
 * courses directly: the database accepts one only through
 * `create_signed_therapy_course`, a SECURITY DEFINER RPC that checks an HMAC
 * over the exact row text (vault `report_write_key`, the same key as
 * `create_signed_session`).
 *
 * With `REPORT_WRITE_KEY` the request's own client calls the RPC with a
 * signature, so every per-user check in the database still runs. Without it
 * the service role calls the RPC unsigned.
 */
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReportWriteKey } from "@/lib/report-sign";
import { createServiceClient } from "@/lib/supabase/admin";

/** Must match the payload built inside create_signed_therapy_course. */
export function buildCourseRowSignaturePayload(rowText: string): string {
  return `therapy_course\n${rowText}`;
}

export function signCourseRow(rowText: string, key: string): string {
  return createHmac("sha256", key)
    .update(buildCourseRowSignaturePayload(rowText))
    .digest("hex");
}

export type CreateCourseRowResult = {
  id: string | null;
  error: { message: string; code?: string } | null;
};

/** PostgREST: the function is not in its schema cache (migration not applied). */
function isMissingRpc(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function public\.create_signed_therapy_course/i.test(
      error.message ?? "",
    )
  );
}

export async function createCourseRow(
  userClient: SupabaseClient,
  row: Record<string, unknown>,
): Promise<CreateCourseRowResult> {
  const key = getReportWriteKey();
  const service = key ? null : createServiceClient();
  if (!key && !service) {
    return {
      id: null,
      error: {
        message:
          "Course signing unavailable. Configure REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY.",
      },
    };
  }

  const rowText = JSON.stringify(row);
  const args: Record<string, unknown> = { p_row: rowText };
  if (key) args.p_sig = signCourseRow(rowText, key);

  const { data, error } = await (service ?? userClient).rpc(
    "create_signed_therapy_course",
    args,
  );
  if (error && isMissingRpc(error)) {
    // Until migration 20261102080000 is applied the database still takes the
    // direct insert (no insert guard on therapy_courses yet).
    const direct = await userClient
      .from("therapy_courses")
      .insert(row)
      .select("id")
      .single();
    return {
      id: (direct.data as { id?: string } | null)?.id ?? null,
      error: direct.error,
    };
  }
  if (error) return { id: null, error };
  if (typeof data !== "string" || !data) {
    return {
      id: null,
      error: { message: "create_signed_therapy_course returned no id" },
    };
  }
  return { id: data, error: null };
}
