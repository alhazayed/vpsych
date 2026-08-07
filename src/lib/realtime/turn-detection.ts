/**
 * Turn Detection — maps VAD/silence into conversational turn phases.
 */

import type { TurnPhase } from "@/lib/realtime/types";

export type TurnDetectorInput = {
  therapistSpeaking: boolean;
  silenceAfterSpeechMs: number;
  silenceBudgetMs?: number;
  patientStreaming: boolean;
  patientSpeaking: boolean;
  bargeIn: boolean;
  paused: boolean;
};

export function detectTurnPhase(input: TurnDetectorInput): TurnPhase {
  if (input.paused) return "paused";
  if (input.bargeIn) return "barge_in";
  if (input.patientSpeaking) return "patient_speaking";
  if (input.patientStreaming) return "patient_streaming";
  if (input.therapistSpeaking) return "therapist_speaking";
  const budget = input.silenceBudgetMs ?? 850;
  if (input.silenceAfterSpeechMs >= budget) return "patient_thinking";
  if (input.silenceAfterSpeechMs > 0) return "therapist_silence";
  return "waiting";
}

export function shouldCommitTherapistTurn(input: {
  speechMs: number;
  silenceMs: number;
  minSpeechMs?: number;
  silenceBudgetMs?: number;
}): boolean {
  const minSpeech = input.minSpeechMs ?? 250;
  const silenceBudget = input.silenceBudgetMs ?? 850;
  return input.speechMs >= minSpeech && input.silenceMs >= silenceBudget;
}
