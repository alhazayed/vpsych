/**
 * Nonverbal presentation sync — maps humanization / NBE / CVP hints
 * into realtime nonverbal channels without owning Emotion/CBE stores.
 */

import type { NonverbalPresentation } from "@/lib/realtime/types";

export type NonverbalSyncInput = {
  eyeContact?: number;
  hesitationMs?: number;
  pauseBeforeMs?: number;
  thinkingDelayMs?: number;
  avoidance?: number;
  bodyOrientation?: number;
  speechRate?: number;
  speechVolume?: number;
  speechRhythm?: NonverbalPresentation["speechRhythm"];
  emotionalCongruence?: number;
  voiceHints?: {
    pause_before_ms?: number;
    speech_rate?: number;
    speech_pace?: string;
    speech_energy?: string;
  } | null;
};

export function buildNonverbalPresentation(
  input: NonverbalSyncInput = {},
): NonverbalPresentation {
  const pace = input.voiceHints?.speech_pace;
  const energy = input.voiceHints?.speech_energy;
  const speechRate =
    input.speechRate ??
    input.voiceHints?.speech_rate ??
    (pace === "slow" ? 0.85 : pace === "fast" ? 1.15 : 1);

  const speechVolume =
    input.speechVolume ??
    (energy === "low" ? 0.7 : energy === "high" ? 1.1 : 1);

  let speechRhythm: NonverbalPresentation["speechRhythm"] =
    input.speechRhythm ?? "even";
  if (pace === "slow") speechRhythm = "halting";
  if (pace === "fast") speechRhythm = "rushed";
  if (energy === "low" && pace === "slow") speechRhythm = "monotone";

  return {
    eyeContact: clamp01(input.eyeContact ?? 0.6),
    hesitationMs: Math.max(
      0,
      input.hesitationMs ?? input.voiceHints?.pause_before_ms ?? 0,
    ),
    pauseMs: Math.max(0, input.pauseBeforeMs ?? input.voiceHints?.pause_before_ms ?? 0),
    thinkingDelayMs: Math.max(0, input.thinkingDelayMs ?? 350),
    avoidance: clamp01(input.avoidance ?? 0),
    bodyOrientation: clamp01(input.bodyOrientation ?? 0.7),
    speechRate,
    speechVolume,
    speechRhythm,
    emotionalCongruence: clamp01(input.emotionalCongruence ?? 0.75),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
