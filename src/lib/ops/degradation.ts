/**
 * Alert when a user-facing path silently degrades. These paths return a
 * working response (persona reply, heuristic report, text without audio),
 * so they never throw and would otherwise never reach error tracking.
 *
 * Tags only: never pass transcript text, prompts or provider detail.
 */

import * as Sentry from "@sentry/nextjs";

export type Degradation =
  | "patient_persona_fallback"
  | "assessment_heuristic_fallback"
  | "tts_provider_failed"
  | "tts_voice_substituted"
  | "tts_voice_lookup_failed";

export function reportDegradation(
  event: Degradation,
  tags: Record<string, string | null | undefined> = {},
): void {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value) clean[key] = value;
  }
  Sentry.captureMessage(`degraded: ${event}`, {
    level: "warning",
    fingerprint: ["degraded", event, clean.code ?? clean.errorKind ?? ""],
    tags: { degradation: event, ...clean },
  });
}

/**
 * A read or write failed and the code stopped safely (503, error page, skipped
 * save) instead of carrying on with empty data. Logged to the console with
 * ids, but console output never reaches Sentry (it can carry model output),
 * so the failures that matter are sent here as tags only.
 */
export type HandledFailure =
  | "session_transcript_unavailable"
  | "conversation_history_unavailable"
  | "case_unavailable"
  | "case_memory_read_failed"
  | "patient_memory_load_failed"
  | "personality_read_failed"
  | "learner_profile_read_failed"
  | "profile_read_failed";

export function reportFailure(
  event: HandledFailure,
  tags: Record<string, string | null | undefined> = {},
): void {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (value) clean[key] = value;
  }
  Sentry.captureMessage(`failed: ${event}`, {
    level: "error",
    fingerprint: ["failed", event, clean.code ?? ""],
    tags: { failure: event, ...clean },
  });
}
