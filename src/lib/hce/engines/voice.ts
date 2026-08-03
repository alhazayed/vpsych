/**
 * Voice Engine — emotion vector → prosody (Layer 2).
 */

import type {
  DeliveryTag,
  EmotionEngineOutput,
  BehaviorEngineOutput,
  VoiceEngineOutput,
} from "@/lib/hce/types";

export function voiceTick(
  emotion: EmotionEngineOutput,
  behavior: BehaviorEngineOutput,
  timingPauseMs: number,
  speechRate: number,
  deliveryTags: DeliveryTag[] = [],
): VoiceEngineOutput {
  const v = emotion.vector;
  let stability = 0.45;
  let style = 0.2;
  let tremor_hint = 0;
  let breathiness_hint = 0;
  let volume_hint = 1;

  if (v.sadness > 60) {
    stability = 0.32;
    style = 0.08;
    breathiness_hint = 0.3;
    volume_hint = 0.85;
  }
  if (v.anxiety > 55) {
    stability = 0.28;
    style = 0.38;
    tremor_hint = 0.25;
    volume_hint = 0.9;
  }
  if (v.anger > 45) {
    style = Math.min(0.45, style + 0.15);
    stability = Math.max(0.25, stability - 0.08);
  }
  let localRate = speechRate;
  if (v.fatigue > 65) {
    stability = 0.35;
    localRate *= 0.88;
    volume_hint = 0.8;
  }
  if (v.hope > 55) {
    style = Math.min(0.35, style + 0.1);
    stability = Math.min(0.5, stability + 0.05);
  }

  if (behavior.speech_pace === "slow") {
    stability -= 0.05;
  }
  if (behavior.cooperation < 35) {
    stability = Math.min(stability, 0.3);
    volume_hint = 0.75;
  }

  if (deliveryTags.includes("whisper")) volume_hint = 0.55;
  if (deliveryTags.includes("cry")) {
    tremor_hint = 0.4;
    breathiness_hint = 0.5;
  }
  if (deliveryTags.includes("hesitation")) tremor_hint = Math.max(tremor_hint, 0.15);

  stability = clamp(stability, 0.18, 0.65);
  style = clamp(style, 0, 0.55);
  tremor_hint = clamp(tremor_hint, 0, 0.6);
  breathiness_hint = clamp(breathiness_hint, 0, 0.7);

  const directives = [
    `stability ${stability.toFixed(2)}`,
    `style ${style.toFixed(2)}`,
    `sadness ${v.sadness}% anxiety ${v.anxiety}%`,
    `pace ${behavior.speech_pace}`,
    `rate ${localRate.toFixed(2)}`,
  ];

  return {
    stability,
    similarity_boost: 0.75,
    style,
    pause_before_ms: timingPauseMs,
    speech_rate: localRate,
    volume_hint,
    tremor_hint,
    breathiness_hint,
    directives,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
