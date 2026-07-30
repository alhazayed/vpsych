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
