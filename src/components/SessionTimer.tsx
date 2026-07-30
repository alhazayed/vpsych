"use client";

import { formatTimer } from "@/lib/session-timer";

export function SessionTimer({
  remaining,
  warningThreshold = 300,
}: {
  remaining: number;
  warningThreshold?: number;
}) {
  const urgent = remaining <= warningThreshold;
  return (
    <div
      className={`font-mono text-2xl tabular-nums tracking-wider ${
        urgent ? "text-[var(--warn)]" : "text-[var(--ink)]"
      }`}
      aria-live="polite"
      aria-label={`Time remaining ${formatTimer(remaining)}`}
    >
      {formatTimer(remaining)}
    </div>
  );
}
