/**
 * Server-side writes and reads for the training ladder.
 *
 * Attempts are created only by `start_training_ladder_attempt`, a SECURITY
 * DEFINER RPC that checks the session, the patient and the unlocked level in
 * the database. The service role calls it directly; otherwise the call carries
 * an HMAC (same `report_write_key` as the message RPCs), so a browser cannot
 * create or move an attempt. Grading happens in a database trigger when the
 * session's report is written; nothing here sets a score or a result.
 */
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReportWriteKey } from "@/lib/report-sign";
import { createServiceClient } from "@/lib/supabase/admin";
import type { LadderLevel } from "@/lib/training-ladder/levels";
import type { LadderAttemptRow } from "@/lib/training-ladder/progress";

/** Must match the payload built inside start_training_ladder_attempt. */
export function buildLadderAttemptSignaturePayload(params: {
  sessionId: string;
  patientKey: string;
  level: LadderLevel;
}): string {
  return `${params.sessionId}\n${params.patientKey}\n${params.level}`;
}

export function signLadderAttempt(params: {
  sessionId: string;
  patientKey: string;
  level: LadderLevel;
  key: string;
}): string {
  return createHmac("sha256", params.key)
    .update(buildLadderAttemptSignaturePayload(params))
    .digest("hex");
}

export const LADDER_LEVEL_LOCKED_MESSAGE =
  "This level is still locked. Clear the previous level first.";

export type StartLadderAttemptResult =
  | { ok: true }
  | { ok: false; status: 403 | 500 | 503; code: string; error: string };

export async function startLadderAttempt(
  userClient: SupabaseClient,
  params: { sessionId: string; patientKey: string; level: LadderLevel },
): Promise<StartLadderAttemptResult> {
  const service = createServiceClient();
  const args: Record<string, unknown> = {
    p_session_id: params.sessionId,
    p_patient_key: params.patientKey,
    p_level: params.level,
  };
  if (!service) {
    const key = getReportWriteKey();
    if (!key) {
      return {
        ok: false,
        status: 503,
        code: "ladder_unavailable",
        error: "The training program is not available right now.",
      };
    }
    args.p_sig = signLadderAttempt({ ...params, key });
  }
  const { error } = await (service ?? userClient).rpc(
    "start_training_ladder_attempt",
    args,
  );
  if (!error) return { ok: true };
  if (/level is locked/i.test(error.message)) {
    return {
      ok: false,
      status: 403,
      code: "ladder_level_locked",
      error: LADDER_LEVEL_LOCKED_MESSAGE,
    };
  }
  console.warn("[training-ladder] attempt start failed", {
    sessionId: params.sessionId,
    error: error.message,
  });
  return {
    ok: false,
    status: 500,
    code: "ladder_attempt_failed",
    error: "Could not start this level. Please try again.",
  };
}

export const LADDER_ATTEMPT_COLUMNS =
  "id, session_id, patient_key, level, status, score, created_at, sessions(status)";

type RawAttempt = Omit<LadderAttemptRow, "session_status" | "score"> & {
  score: number | string | null;
  sessions?: { status?: string | null } | { status?: string | null }[] | null;
};

export function normalizeLadderAttempt(raw: RawAttempt): LadderAttemptRow {
  const embedded = Array.isArray(raw.sessions) ? raw.sessions[0] : raw.sessions;
  const score =
    raw.score === null || raw.score === undefined ? null : Number(raw.score);
  return {
    id: raw.id,
    session_id: raw.session_id,
    patient_key: raw.patient_key,
    level: raw.level,
    status: raw.status,
    score: Number.isFinite(score) ? score : null,
    created_at: raw.created_at,
    session_status: embedded?.status ?? null,
  };
}

/**
 * The trainee's own attempts (RLS: owner or admin). `available: false` when
 * the ladder tables are not migrated yet, so pages can say so instead of
 * showing an empty program.
 */
export async function loadLadderAttempts(
  supabase: SupabaseClient,
  params: { therapistId: string; patientKey?: string },
): Promise<
  | { available: true; attempts: LadderAttemptRow[] }
  | { available: false }
> {
  let query = supabase
    .from("training_ladder_attempts")
    .select(LADDER_ATTEMPT_COLUMNS)
    .eq("therapist_id", params.therapistId)
    .order("created_at", { ascending: true });
  if (params.patientKey) query = query.eq("patient_key", params.patientKey);
  const { data, error } = await query;
  if (error) {
    console.warn("[training-ladder] attempts load failed", {
      error: error.message,
    });
    return { available: false };
  }
  return {
    available: true,
    attempts: ((data ?? []) as unknown as RawAttempt[]).map(
      normalizeLadderAttempt,
    ),
  };
}
