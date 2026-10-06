import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionMessage } from "@/lib/types";

/**
 * Heard vs generated patient text.
 *
 * When the therapist barges in, the patient reply is stored in full but only
 * its first part was spoken aloud. The client estimates how far playback got
 * and records it once as `session_messages.heard_chars`. Assessment then
 * judges only what the therapist could have heard. The stored transcript is
 * never rewritten.
 */

/** Average speaking rate used when only elapsed time is known (browser TTS). */
export const ESTIMATED_CHARS_PER_SECOND = 14;

export type PlaybackProgress =
  | { kind: "audio"; currentTime: number; duration: number }
  | { kind: "elapsed"; elapsedMs: number }
  | { kind: "not_started" };

/** Fraction (0–1) of `text` that had been spoken at the moment of interrupt. */
export function playbackFraction(text: string, progress: PlaybackProgress): number {
  if (progress.kind === "not_started") return 0;
  if (progress.kind === "audio") {
    const { currentTime, duration } = progress;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) {
      return 0;
    }
    return clamp01(currentTime / duration);
  }
  const length = text.length;
  if (length === 0 || !Number.isFinite(progress.elapsedMs)) return 0;
  const estimatedMs = (length / ESTIMATED_CHARS_PER_SECOND) * 1000;
  return clamp01(progress.elapsedMs / estimatedMs);
}

/**
 * Character offset heard so far. A word that had started is counted as heard,
 * so the offset snaps forward to the end of the word in progress.
 */
export function heardCharsFromFraction(text: string, fraction: number): number {
  const length = text.length;
  const raw = Math.round(clamp01(fraction) * length);
  if (raw <= 0) return 0;
  if (raw >= length) return length;
  if (/\s/.test(text[raw - 1] ?? "")) return raw;
  let end = raw;
  while (end < length && !/\s/.test(text[end] ?? "")) end += 1;
  return end;
}

const INTERRUPTED_MARKER = {
  en: "[the therapist interrupted here; the rest was not heard]",
  ar: "[قاطع المعالج المريض هنا؛ لم يُسمع باقي الكلام]",
} as const;

/** Patient text as the therapist heard it, with a marker where it was cut. */
export function applyHeardText(
  content: string,
  heardChars: number | null | undefined,
  language: "en" | "ar",
): string {
  if (heardChars == null || !Number.isFinite(heardChars)) return content;
  const cut = Math.max(0, Math.floor(heardChars));
  if (cut >= content.length) return content;
  const heard = content.slice(0, cut).trimEnd();
  const marker = INTERRUPTED_MARKER[language];
  return heard ? `${heard} … ${marker}` : marker;
}

export type AssessmentMessage = Pick<
  SessionMessage,
  "role" | "content" | "created_at" | "heard_chars"
>;

/** Replace interrupted patient replies with the part that was heard. */
export function withHeardText<T extends Pick<SessionMessage, "role" | "content"> & {
  heard_chars?: number | null;
}>(messages: T[], language: "en" | "ar"): T[] {
  return messages.map((m) =>
    m.role === "assistant" && m.heard_chars != null
      ? { ...m, content: applyHeardText(m.content, m.heard_chars, language) }
      : m,
  );
}

/**
 * Transcript rows for assessment, including `heard_chars`. Falls back to the
 * old column list when the column is not deployed yet, so a missing migration
 * never empties a report's transcript.
 */
export async function loadAssessmentMessages(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ data: AssessmentMessage[]; error: { message: string } | null }> {
  const withHeard = await supabase
    .from("session_messages")
    .select("role, content, created_at, heard_chars")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (!withHeard.error) {
    return { data: (withHeard.data ?? []) as AssessmentMessage[], error: null };
  }

  const plain = await supabase
    .from("session_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return {
    data: (plain.data ?? []) as AssessmentMessage[],
    error: plain.error ? { message: plain.error.message } : null,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
