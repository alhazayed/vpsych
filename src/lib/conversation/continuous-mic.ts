/**
 * Continuous microphone capture with local VAD analysis.
 * Audio is held in memory only for the current utterance — never logged or persisted by HFTE.
 */

import {
  VoiceActivityDetector,
  type VadConfig,
} from "@/lib/conversation/vad";
import type { VadEvent, VadFrameResult } from "@/lib/conversation/types";

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downsample(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLen = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    result[i] = buffer[Math.floor(i * ratio)] ?? 0;
  }
  return result;
}

export type WaveformSample = {
  energy: number;
  clipping: boolean;
  isSpeech: boolean;
  isNoise: boolean;
};

export type ContinuousMicHandlers = {
  onVadEvent?: (event: VadEvent) => void;
  onFrame?: (analysis: VadFrameResult, wave: WaveformSample) => void;
  onUtterance?: (wav: Blob, meta: { durationMs: number; confidence: number }) => void;
};

export type ContinuousMicSession = {
  stop: () => void;
  pauseCapture: () => void;
  resumeCapture: () => void;
  setInterruptMode: (enabled: boolean) => void;
  updateVadConfig: (patch: Partial<VadConfig>) => void;
  /** Drop buffered utterance audio without emitting. */
  discardBuffer: () => void;
};

/**
 * Open mic for hands-free listening. Caller must stop() on unmount / pause / end.
 * No audio is written to disk or sent until onUtterance (ephemeral WAV for STT).
 */
export async function startContinuousMic(
  handlers: ContinuousMicHandlers,
  vadConfig?: Partial<VadConfig>,
): Promise<ContinuousMicSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const vad = new VoiceActivityDetector({
    ...vadConfig,
    sampleRate: 16000,
  });

  let capturing = true;
  let recordingUtterance = false;
  const chunks: Float32Array[] = [];
  let nativeChunks: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    if (!capturing) return;
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input);
    const frameMs = (copy.length / audioContext.sampleRate) * 1000;
    const down = downsample(copy, audioContext.sampleRate, 16000);
    const { events, analysis } = vad.process(down, frameMs * (down.length / copy.length || 1));

    handlers.onFrame?.(analysis, {
      energy: analysis.energy,
      clipping: analysis.clipping,
      isSpeech: analysis.isSpeech,
      isNoise: !analysis.isSpeech && analysis.flatness > 0.65 && analysis.energy > 0.01,
    });

    for (const ev of events) {
      handlers.onVadEvent?.(ev);
      if (ev.type === "speech_start" || ev.type === "interruption") {
        recordingUtterance = true;
        nativeChunks = [];
        chunks.length = 0;
      }
      if (ev.type === "speech_end") {
        recordingUtterance = false;
        // Prefer native-rate buffer for quality, then downsample for STT.
        let length = 0;
        for (const c of nativeChunks) length += c.length;
        if (length > 0) {
          const merged = new Float32Array(length);
          let offset = 0;
          for (const c of nativeChunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const stt = downsample(merged, audioContext.sampleRate, 16000);
          const wav = encodeWav(stt, 16000);
          handlers.onUtterance?.(wav, {
            durationMs: ev.durationMs,
            confidence: ev.confidence,
          });
        }
        nativeChunks = [];
        chunks.length = 0;
        vad.reset();
      }
    }

    if (recordingUtterance) {
      nativeChunks.push(copy);
      chunks.push(down);
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  function cleanup() {
    capturing = false;
    try {
      processor.disconnect();
      source.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void audioContext.close();
  }

  return {
    stop() {
      cleanup();
    },
    pauseCapture() {
      capturing = false;
      recordingUtterance = false;
      nativeChunks = [];
      chunks.length = 0;
      vad.reset();
    },
    resumeCapture() {
      capturing = true;
      vad.reset();
    },
    setInterruptMode(enabled: boolean) {
      vad.setInterruptMode(enabled);
    },
    updateVadConfig(patch) {
      vad.updateConfig(patch);
    },
    discardBuffer() {
      recordingUtterance = false;
      nativeChunks = [];
      chunks.length = 0;
      vad.reset();
    },
  };
}
