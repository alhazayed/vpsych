/**
 * Playback watchdog for the patient clip.
 *
 * An <audio> element can report "playing" and then never fire "ended" or
 * "error": the browser paused it on an audio-device change (a Bluetooth
 * headset switching profile when the barge-in mic opens), or its clock
 * stopped. Without a watchdog the Therapy Room then sits on "Avatar
 * speaking…" forever. This module only decides; the caller samples the
 * element and acts on the verdict.
 */

/** No forward progress for this long while playing counts as a stall. */
export const PLAYBACK_STALL_MS = 4000;
/** Allowance past the clip's own length before it counts as overrun. */
export const PLAYBACK_OVERRUN_GRACE_MS = 4000;
/** Hard ceiling when the clip length is unknown (streamed / Infinity). */
export const PLAYBACK_MAX_MS = 90_000;
/** How often the caller samples the element. */
export const PLAYBACK_WATCHDOG_INTERVAL_MS = 500;

export type PlaybackSample = {
  /** performance.now() of this sample. */
  now: number;
  /** performance.now() when "playing" first fired. */
  startedAt: number;
  /** performance.now() when currentTime last moved forward. */
  lastProgressAt: number;
  /** Clip length in seconds (NaN / Infinity when unknown). */
  duration: number;
  playbackRate: number;
};

export type PlaybackVerdict = "ok" | "stalled" | "overrun";

export function playbackVerdict(sample: PlaybackSample): PlaybackVerdict {
  const { now, startedAt, lastProgressAt, duration } = sample;
  if (now - lastProgressAt >= PLAYBACK_STALL_MS) return "stalled";
  const rate =
    Number.isFinite(sample.playbackRate) && sample.playbackRate > 0
      ? sample.playbackRate
      : 1;
  const budgetMs =
    Number.isFinite(duration) && duration > 0
      ? Math.min(PLAYBACK_MAX_MS, (duration * 1000) / rate + PLAYBACK_OVERRUN_GRACE_MS)
      : PLAYBACK_MAX_MS;
  if (now - startedAt >= budgetMs) return "overrun";
  return "ok";
}
