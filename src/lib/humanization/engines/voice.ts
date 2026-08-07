/**
 * Voice Engine (Humanization) — prosody + pause/breathing hints for TTS.
 */

import {
  voiceSettingsForPaceEnergy,
  browserSpeechRateForPace,
  type SpeechEnergy,
  type SpeechPace,
} from "@/lib/voice/prosody";
import type {
  BehaviorEngineOutput,
  EmotionEngineOutput,
  HumanizationBehaviorId,
  VoiceEngineOutput,
} from "@/lib/humanization/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function voiceTick(params: {
  emotion: EmotionEngineOutput;
  behavior: BehaviorEngineOutput;
  selected: HumanizationBehaviorId[];
  fatigue: number;
}): VoiceEngineOutput {
  const pace = params.behavior.speech_pace as SpeechPace;
  const energy = params.behavior.speech_energy as SpeechEnergy;
  const base = voiceSettingsForPaceEnergy(pace, energy);

  let stability = base.stability;
  let style = base.style ?? 0.25;
  let pause_before_ms = 350;
  let breathiness = 0.1;
  let tremor = 0.05;
  const directives: string[] = [];

  if (params.selected.includes("thinking_pause") || params.selected.includes("silence")) {
    pause_before_ms = Math.max(pause_before_ms, 1200);
    directives.push("hold silence before first word");
  }
  if (params.selected.includes("hesitation") || params.selected.includes("breathing")) {
    pause_before_ms = Math.max(pause_before_ms, 700);
    breathiness = 0.35;
    directives.push("audible breath / catch before speech");
  }
  if (params.selected.includes("crying") || params.selected.includes("be_emotional")) {
    stability = clamp(stability - 0.12, 0.15, 0.85);
    style = clamp(style + 0.15, 0, 0.7);
    tremor = 0.35;
    directives.push("unstable, tear-adjacent delivery");
  }
  if (params.selected.includes("laughter")) {
    style = clamp(style + 0.1, 0, 0.65);
    directives.push("brief nervous laugh colour");
  }
  if (params.selected.includes("fatigue") || params.fatigue > 0.55) {
    pause_before_ms = Math.max(pause_before_ms, 900);
    stability = clamp(stability + 0.08, 0.2, 0.9);
    directives.push("tired, low-energy delivery");
  }
  if (params.emotion.intensity >= 8) {
    stability = clamp(stability - 0.08, 0.15, 0.85);
    tremor = Math.max(tremor, 0.25);
  }
  if (pace === "pressured") {
    pause_before_ms = Math.min(pause_before_ms, 180);
    directives.push("pressured onset — minimal pre-pause");
  }

  const speech_rate = browserSpeechRateForPace(pace);

  return {
    stability,
    similarity_boost: base.similarity_boost,
    style,
    pause_before_ms: Math.round(pause_before_ms),
    speech_rate,
    breathiness_hint: breathiness,
    tremor_hint: tremor,
    directives,
  };
}
