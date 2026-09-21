import type { TherapySession } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpirableSession = Pick<
  TherapySession,
  "id" | "status" | "started_at" | "max_duration_sec" | "ended_at"
>;

/** True when an active therapy session has exceeded its max duration. */
export function isSessionTimedOut(
  startedAt: string,
  maxDurationSec: number,
  nowMs: number = Date.now(),
): boolean {
  const elapsed = Math.floor(
    (nowMs - new Date(startedAt).getTime()) / 1000,
  );
  return elapsed >= maxDurationSec;
}

/**
 * If the session is still marked active but the timer has elapsed, mark it
 * expired. Returns true when a row was updated. Idempotent for finished rows.
 */
export async function expireStaleSession(
  supabase: SupabaseClient,
  session: ExpirableSession,
  now: Date = new Date(),
): Promise<boolean> {
  if (session.status !== "active") return false;
  if (
    !isSessionTimedOut(
      session.started_at,
      session.max_duration_sec,
      now.getTime(),
    )
  ) {
    return false;
  }

  // ended_at should reflect when the max duration was reached, not "now",
  // so reports and admin review see the correct wall-clock end.
  const endedAt = new Date(
    new Date(session.started_at).getTime() + session.max_duration_sec * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "expired",
      ended_at: endedAt,
    })
    .eq("id", session.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[session-expiry] failed to expire session:", error.message);
    return false;
  }
  return Boolean(data?.id);
}

/**
 * Expire every timed-out active session visible to the caller.
 * Platform admins see all sessions (RLS); used on the admin sessions list
 * so abandoned rooms are not shown as indefinitely "active".
 * Caps work per call to keep page loads bounded.
 *
 * Semantics: wall-clock from `started_at` vs `max_duration_sec` only.
 * No heartbeat/last-activity — this matches product max-duration rules and
 * does not terminate a still-open session before its configured limit.
 * Does NOT generate assessment reports (same as historical passive expiry).
 */
export async function expireStaleSessionsVisible(
  supabase: SupabaseClient,
  now: Date = new Date(),
  limit = 100,
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, status, started_at, max_duration_sec, ended_at")
    .eq("status", "active")
    .order("started_at", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) return 0;

  let expired = 0;
  for (const row of rows as ExpirableSession[]) {
    if (await expireStaleSession(supabase, row, now)) expired += 1;
  }
  return expired;
}

/**
 * Batch expiry for scheduled maintenance (cron).
 * Uses the same wall-clock rule as `expireStaleSession`.
 * Prefer service-role client so RLS does not hide rows; safe to re-run.
 */
export async function expireStaleSessionsBatch(
  supabase: SupabaseClient,
  now: Date = new Date(),
  limit = 200,
): Promise<{ scanned: number; expired: number }> {
  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, status, started_at, max_duration_sec, ended_at")
    .eq("status", "active")
    .order("started_at", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) return { scanned: 0, expired: 0 };

  let expired = 0;
  for (const row of rows as ExpirableSession[]) {
    if (await expireStaleSession(supabase, row, now)) expired += 1;
  }
  return { scanned: rows.length, expired };
}

/**
 * Expire every owned active session whose timer has elapsed.
 * Used on the therapist sessions list so abandoned rooms do not linger as "active".
 */
export async function expireStaleSessionsForTherapist(
  supabase: SupabaseClient,
  therapistId: string,
  now: Date = new Date(),
): Promise<number> {
  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, status, started_at, max_duration_sec, ended_at")
    .eq("therapist_id", therapistId)
    .eq("status", "active");

  if (error || !rows?.length) return 0;

  let expired = 0;
  for (const row of rows as ExpirableSession[]) {
    if (await expireStaleSession(supabase, row, now)) expired += 1;
  }
  return expired;
}
