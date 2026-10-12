/**
 * Daily patient-voice allowance per account (`/api/voice/tts`).
 *
 * The TTS route's hourly buckets (60 full replies, 360 sentence chunks) still
 * let one account synthesize about 290,000 characters an hour, around the
 * clock. This caps what an account can spend on ElevenLabs in a day: about
 * three hours of patient speech, well above a heavy training day. Full
 * replies, sentence chunks and voice previews all count. Past it the route
 * answers 429 `TTS_DAILY_LIMIT` and the client speaks with the browser voice.
 *
 * Exact across server instances when Upstash is configured; otherwise each
 * instance keeps its own count (see `lib/rate-limit.ts`).
 */

import { rateLimit, type RateLimitResult } from "@/lib/rate-limit";

export const TTS_DAILY_CHARS = 150_000;
export const TTS_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const TTS_DAILY_LIMIT_CODE = "TTS_DAILY_LIMIT";

/** Charge `text` against the account's daily allowance. */
export function chargeDailyTtsChars(
  userId: string,
  text: string,
): Promise<RateLimitResult> {
  return rateLimit(
    `tts-chars:${userId}`,
    TTS_DAILY_CHARS,
    TTS_DAILY_WINDOW_MS,
    Math.max(1, text.length),
  );
}
