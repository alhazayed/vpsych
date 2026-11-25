/**
 * Patient-voice allowance per therapy course (`/api/voice/tts`).
 *
 * The daily allowance (`tts-budget.ts`) caps what one account spends in a day,
 * but a course of 8 sessions could still use it every day. This caps a whole
 * course: once `COURSE_VOICE_CHARS` characters of patient speech have been
 * spoken in it, the route answers 429 `TTS_COURSE_LIMIT` and the client
 * speaks with the browser voice. The session itself carries on as before.
 *
 * The count lives on `therapy_courses.voice_chars_used` and is charged
 * atomically by the `charge_course_voice` database function, so it is exact
 * across server instances and survives restarts.
 *
 * Which course: the trainee's most recently started active session that
 * belongs to a therapy course. The server works this out itself, so a client
 * cannot dodge the cap by leaving a field out. Requests with no such session
 * (voice previews, standalone sessions, skill tests, ladder levels) are only
 * covered by the daily allowance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const COURSE_VOICE_CHARS = 100_000;
export const TTS_COURSE_LIMIT_CODE = "TTS_COURSE_LIMIT";

export type CourseVoiceCharge =
  /** Charged to a course, or no course session is active. */
  | { ok: true; courseId: string | null }
  /** The course's allowance would be exceeded. */
  | { ok: false; courseId: string }
  /**
   * The count could not be read or written (for example before the database
   * migration is applied). The route lets the voice through and reports it:
   * the daily allowance still applies.
   */
  | { ok: true; courseId: string | null; unavailable: string };

/** Charge `text` to the trainee's active therapy course, if there is one. */
export async function chargeCourseVoiceChars(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  cap: number = COURSE_VOICE_CHARS,
): Promise<CourseVoiceCharge> {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("therapy_course_id")
    .eq("therapist_id", userId)
    .eq("status", "active")
    .not("therapy_course_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionError) {
    return { ok: true, courseId: null, unavailable: sessionError.code ?? "session_read" };
  }
  const courseId = session?.therapy_course_id ?? null;
  if (!courseId) return { ok: true, courseId: null };

  const chars = Math.min(10_000, Math.max(1, text.length));
  const { data, error } = await supabase.rpc("charge_course_voice", {
    p_course_id: courseId,
    p_chars: chars,
    p_cap: cap,
  });
  if (error) {
    return { ok: true, courseId, unavailable: error.code ?? "charge_failed" };
  }
  if (data === true) return { ok: true, courseId };
  return { ok: false, courseId };
}
