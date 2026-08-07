/**
 * Voice Gateway — orchestrates mic → VAD → STT → model → TTS → speaker.
 * Presentation layer only; patient reply text comes from Patient Agent.
 */

import { createMicrophonePipeline } from "@/lib/realtime/microphone-pipeline";
import { createSpeakerPipeline } from "@/lib/realtime/speaker-pipeline";
import { createStreamingAudioManager } from "@/lib/realtime/streaming-audio";
import { createSilenceDetector } from "@/lib/realtime/silence-detection";
import { createVad } from "@/lib/realtime/vad";
import { createLatencyController } from "@/lib/realtime/latency-controller";
import { createReconnectController } from "@/lib/realtime/reconnect";
import {
  gatewayStateAfterInterrupt,
  planInterrupt,
} from "@/lib/realtime/interrupt-handling";
import { detectTurnPhase } from "@/lib/realtime/turn-detection";
import { adaptQuality, estimateNetworkFromRtt } from "@/lib/realtime/quality-adaptation";
import type {
  InterruptReason,
  TurnPhase,
  VoiceGatewayState,
} from "@/lib/realtime/types";

export type VoiceGateway = ReturnType<typeof createVoiceGateway>;

export function createVoiceGateway() {
  const mic = createMicrophonePipeline();
  const speaker = createSpeakerPipeline();
  const audio = createStreamingAudioManager();
  const silence = createSilenceDetector();
  const vad = createVad();
  const latency = createLatencyController();
  const reconnect = createReconnectController();

  let state: VoiceGatewayState = "idle";
  let turn: TurnPhase = "waiting";
  let rttMs = 120;

  const refreshTurn = (opts?: {
    therapistSpeaking?: boolean;
    patientStreaming?: boolean;
    patientSpeaking?: boolean;
    bargeIn?: boolean;
    paused?: boolean;
  }) => {
    const snap = silence.snapshot();
    turn = detectTurnPhase({
      therapistSpeaking: opts?.therapistSpeaking ?? snap.speaking,
      silenceAfterSpeechMs: snap.silenceMs,
      patientStreaming: opts?.patientStreaming ?? state === "streaming_tokens",
      patientSpeaking: opts?.patientSpeaking ?? state === "speaking",
      bargeIn: opts?.bargeIn ?? state === "interrupted",
      paused: opts?.paused ?? false,
    });
  };

  return {
    state: () => state,
    turn: () => turn,
    mic,
    speaker,
    audio,
    latency,
    reconnect,
    quality() {
      return adaptQuality(estimateNetworkFromRtt(rttMs));
    },
    setRtt(ms: number) {
      rttMs = ms;
    },
    armMic() {
      mic.beginPermissionRequest();
      mic.arm();
      state = "mic_arming";
    },
    startListening() {
      mic.startCapture();
      state = "listening";
      refreshTurn({ therapistSpeaking: false });
    },
    pushAudioEnergy(rms: number, dtMs: number) {
      const frame = vad.process(rms, dtMs);
      const sil = silence.push(rms, dtMs);
      if (frame.speaking) state = "vad_speech";
      else if (sil.silenceMs > 0 && sil.speechMs > 0) state = "silence_hold";
      refreshTurn({ therapistSpeaking: frame.speaking });
      latency.mark("vad_decision", dtMs, true);
      return { frame, silence: sil, turn };
    },
    beginTranscribe() {
      state = "transcribing";
      refreshTurn();
    },
    beginModelWait() {
      state = "awaiting_model";
      refreshTurn({ patientStreaming: false });
    },
    beginTokenStream() {
      state = "streaming_tokens";
      refreshTurn({ patientStreaming: true });
    },
    beginSynthesize() {
      state = "synthesizing";
    },
    beginSpeaking() {
      state = "speaking";
      speaker.beginPlay();
      refreshTurn({ patientSpeaking: true });
    },
    interrupt(reason: InterruptReason) {
      const plan = planInterrupt(reason);
      if (plan.abortPlayback) speaker.interrupt();
      if (plan.abortGeneration) audio.clear();
      state = gatewayStateAfterInterrupt(reason);
      refreshTurn({ bargeIn: reason === "therapist_barge_in" });
      return plan;
    },
    recover() {
      state = "recovering";
      const plan = reconnect.onDisconnect();
      return plan;
    },
    markConnected() {
      reconnect.onConnected();
      state = "idle";
    },
    reset() {
      silence.reset();
      vad.reset();
      audio.clear();
      mic.reset();
      state = "idle";
      turn = "waiting";
    },
  };
}
