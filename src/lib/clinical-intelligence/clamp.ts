/** Clamp helpers for Clinical Intelligence continua (0–100). */

export function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function clampDelta(
  current: number,
  delta: number,
  min = 0,
  max = 100,
): number {
  return Math.max(min, Math.min(max, current + delta));
}
