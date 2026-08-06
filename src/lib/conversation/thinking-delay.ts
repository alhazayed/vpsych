import type { PmeUxCues } from "@/lib/conversation/types";

export type ThinkingDelayConfig = {
  minMs: number;
  maxMs: number;
  /** User preference scale (0.5–2). */
  scale: number;
};

export const DEFAULT_THINKING_DELAY: ThinkingDelayConfig = {
  minMs: 700,
  maxMs: 1800,
  scale: 1,
};

/**
 * Deterministic natural latency from PME UX cues — not random wall-clock.
 * Uses diagnosis / emotion / hesitation / confidence / alliance when present.
 */
export function computeThinkingDelayMs(
  cues: PmeUxCues,
  config: Partial<ThinkingDelayConfig> = {},
): number {
  const minMs = config.minMs ?? DEFAULT_THINKING_DELAY.minMs;
  const maxMs = config.maxMs ?? DEFAULT_THINKING_DELAY.maxMs;
  const scale = Math.min(2, Math.max(0.5, config.scale ?? 1));

  let t = (minMs + maxMs) / 2;

  switch (cues.pace) {
    case "slow":
      t += 280;
      break;
    case "measured":
      t += 80;
      break;
    case "fast":
    case "pressured":
      t -= 220;
      break;
    case "variable":
      t += 40;
      break;
    default:
      break;
  }

  switch (cues.energy) {
    case "low":
      t += 180;
      break;
    case "high":
      t -= 100;
      break;
    case "labile":
      t += 60;
      break;
    default:
      break;
  }

  switch (cues.severity) {
    case "severe":
      t += 200;
      break;
    case "moderate":
      t += 80;
      break;
    case "mild":
      t -= 40;
      break;
    case "subclinical":
      t -= 80;
      break;
    default:
      break;
  }

  const hesitation = cues.hesitation ?? 0.35;
  t += hesitation * 320;

  const confidence = cues.confidence ?? 0.55;
  t += (1 - confidence) * 240;

  const alliance = cues.alliance ?? 0.5;
  // Early / low alliance → more guarded pauses.
  t += (1 - alliance) * 160;

  const emotion = (cues.emotion ?? "").toLowerCase();
  if (
    emotion.includes("grief") ||
    emotion.includes("sad") ||
    emotion.includes("tear")
  ) {
    t += 200;
  } else if (
    emotion.includes("anx") ||
    emotion.includes("panic") ||
    emotion.includes("fear")
  ) {
    t += 120;
  } else if (emotion.includes("irrit") || emotion.includes("anger")) {
    t -= 80;
  }

  const category = (cues.disorderCategory ?? "").toLowerCase();
  if (category === "mood") t += 60;
  if (category === "psychosis") t += 140;
  if (category === "trauma") t += 100;

  t *= scale;
  return Math.round(Math.min(maxMs * scale, Math.max(minMs * Math.min(scale, 1), t)));
}

export function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
