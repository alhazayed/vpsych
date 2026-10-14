import { MAX_SESSION_SECONDS } from "@/lib/types";

export function remainingSeconds(
  startedAt: string,
  maxDurationSec = MAX_SESSION_SECONDS,
) {
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000,
  );
  return Math.max(0, maxDurationSec - elapsed);
}

export function formatTimer(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/** Minutes-left marks at which the room warns that the session will end. */
export const TIME_WARNING_MINUTES = [5, 1] as const;

/**
 * The warning to give now, if any: the smallest mark (in minutes) that
 * `remaining` has reached but `lastWarned` has not. A session that opens
 * already past a mark warns once, with the nearest mark, not with each one.
 */
export function dueTimeWarning(
  remaining: number,
  lastWarned: number | null,
): number | null {
  if (remaining <= 0) return null;
  let due: number | null = null;
  for (const minutes of TIME_WARNING_MINUTES) {
    if (remaining <= minutes * 60 && (lastWarned === null || minutes < lastWarned)) {
      due = minutes;
    }
  }
  return due;
}
