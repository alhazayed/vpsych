/**
 * Voice Engine — prosody mapping for ElevenLabs.
 */

import type {
  EmotionEngineOutput,
  BehaviorEngineOutput,
  VoiceEngineOutput,
} from "@/lib/hce/types";

export function voiceTick(
  emotion: EmotionEngineOutput,
  behavior: BehaviorEngineOutput,
): VoiceEngineOutput {
  const intensity = emotion.intensity;
  let stability = 0.45;
  const similarity_boost = 0.75;
  let style = 0.2;
  let pause_before_ms = 0;

  if (emotion.primary_affect === "sad" || emotion.primary_affect === "numb") {
    stability = 0.35;
    style = 0.1;
    pause_before_ms = 400;
  }
  if (emotion.primary_affect === "anxious") {
    stability = 0.3;
    style = 0.35;
  }
  if (emotion.primary_affect === "ashamed") {
    stability = 0.4;
    pause_before_ms = 600;
  }
  if (behavior.speech_pace === "slow") {
    pause_before_ms += 200;
    stability -= 0.05;
  }
  if (intensity > 7) {
    style = Math.min(0.5, style + 0.1);
  }
  if (behavior.cooperation < 35) {
    stability = Math.min(stability, 0.32);
  }

  stability = clamp(stability, 0.2, 0.65);
  style = clamp(style, 0, 0.5);

  const directives = [
    `stability ${stability.toFixed(2)}`,
    `pace ${behavior.speech_pace}`,
    emotion.directives.join("; "),
  ].filter(Boolean);

  return {
    stability,
    similarity_boost,
    style,
    pause_before_ms,
    directives,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
