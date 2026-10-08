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
  | "tts_provider_failed";

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
