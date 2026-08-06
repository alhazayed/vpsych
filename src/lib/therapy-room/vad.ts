/**
 * Lightweight energy-based Voice Activity Detection for hands-free turns.
 *
 * Production notes:
 * - Uses Web Audio + getUserMedia with echoCancellation / noiseSuppression / AGC
 * - Silence after speech ends the turn (default 850 ms — in the 700–1000 budget)
 * - Short intra-sentence pauses below silenceMs are ignored
 * - Mic graph is muted (gain 0) so ScriptProcessor never feeds speakers
 * - No audio is stored — samples discarded after RMS / WAV encode for STT upload
 */

import { BARGE_IN_AUDIO_CONSTRAINTS } from "./audio-constraints";
import { HANDS_FREE_PERF_BUDGETS } from "./conversation-telemetry";
import { acquireHandsFreeMicrophone } from "./prime-mic";

export type VadController = {
  /**
   * Resolves when the turn ends naturally (silence after speech, max duration,
   * or patient-interrupt check) — or when stop()/cancel() is invoked.
   */
  done: Promise<Blob | null>;
  /** Force-end the turn and keep captured audio. */
  stop: () => Promise<Blob | null>;
  /** Abort without keeping audio. */
  cancel: () => void;
  /** True while speech energy is above threshold. */
  isSpeaking: () => boolean;
  /** Milliseconds of continuous speech detected so far. */
  speechMs: () => number;
};

export type HandsFreeVadOptions = {
  /** Silence duration (ms) after speech that ends the turn. */
  silenceMs?: number;
  /** Absolute max recording length. */
  maxMs?: number;
  /** RMS threshold (0–1) to count as speech. */
  speechThreshold?: number;
  /** Hysteresis floor — below this, count as silence (avoids flicker). */
  silenceThreshold?: number;
  /** Minimum speech duration before silence can end the turn. */
  minSpeechMs?: number;
  /**
   * Require this much continuous silence *before* first speech to avoid
   * capturing room noise as a turn. Not applied after speech has started.
   */
  prerollMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onInterruptCheck?: (speechMs: number) => boolean;
  /** Optional pre-acquired stream (shared mic for barge-in → listen). */
  stream?: MediaStream;
  /** When true, do not stop tracks on finish (caller owns the stream). */
  retainStream?: boolean;
};

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

export function rms(input: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const v = input[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, input.length));
}

/**
 * Clamp silence timeout into the production budget (700–1000 ms).
 */
export function resolveSilenceMs(requested?: number): number {
  const fallback = HANDS_FREE_PERF_BUDGETS.defaultSilenceMs;
  if (requested == null || !Number.isFinite(requested)) return fallback;
  return Math.min(
    HANDS_FREE_PERF_BUDGETS.silenceDetectMsMax,
    Math.max(HANDS_FREE_PERF_BUDGETS.silenceDetectMsMin, requested),
  );
}

/**
 * Pure VAD frame decision — unit-tested without Web Audio.
 * Returns whether the turn should end after this frame.
 *
 * Speech start uses speechThreshold. End-of-turn silence uses the same
 * speechThreshold (level below it accumulates quiet time) so hysteresis
 * never traps the turn in a mid-band forever. silenceThreshold is reserved
 * for callers that want a stricter "definitely quiet" check.
 */
export function evaluateVadFrame(input: {
  level: number;
  speaking: boolean;
  speechThreshold: number;
  silenceThreshold: number;
  totalSpeechMs: number;
  minSpeechMs: number;
  quietForMs: number;
  silenceMs: number;
  elapsedMs: number;
  maxMs: number;
}): {
  nowSpeaking: boolean;
  speechStarted: boolean;
  speechEnded: boolean;
  shouldFinish: boolean;
  keepAudio: boolean;
} {
  let nowSpeaking = input.speaking;
  let speechStarted = false;
  let speechEnded = false;
  let shouldFinish = false;
  let keepAudio = false;

  if (input.level >= input.speechThreshold) {
    if (!nowSpeaking) {
      nowSpeaking = true;
      speechStarted = true;
    }
  } else if (nowSpeaking) {
    // Quiet relative to speechThreshold. silenceThreshold remains available for
    // future stricter hysteresis; short pauses are gated by quietForMs.
    if (
      input.totalSpeechMs >= input.minSpeechMs &&
      input.quietForMs >= input.silenceMs &&
      input.level < Math.max(input.silenceThreshold, input.speechThreshold)
    ) {
      nowSpeaking = false;
      speechEnded = true;
      shouldFinish = true;
      keepAudio = true;
    }
  }

  if (!shouldFinish && input.elapsedMs >= input.maxMs) {
    speechEnded = nowSpeaking || input.totalSpeechMs >= input.minSpeechMs;
    shouldFinish = true;
    keepAudio = input.totalSpeechMs >= input.minSpeechMs;
    nowSpeaking = false;
  }

  return { nowSpeaking, speechStarted, speechEnded, shouldFinish, keepAudio };
}

/**
 * Start hands-free listening. Resolves the turn when silence follows speech,
 * max duration hits, or onInterruptCheck returns true (patient interruption).
 */
export async function startHandsFreeVad(
  options: HandsFreeVadOptions = {},
): Promise<VadController> {
  const silenceMs = resolveSilenceMs(options.silenceMs);
  const maxMs = options.maxMs ?? 30000;
  const speechThreshold = options.speechThreshold ?? 0.015;
  const silenceThreshold = options.silenceThreshold ?? speechThreshold * 0.55;
  const minSpeechMs = options.minSpeechMs ?? 400;

  const { stream, ownsStream } = await acquireHandsFreeMicrophone(
    options.stream ?? null,
  );

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    if (ownsStream) stream.getTracks().forEach((t) => t.stop());
    throw new DOMException("AudioContext unavailable", "NotSupportedError");
  }

  const audioContext = new AudioCtx();
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      /* autoplay policies — continue; onaudioprocess may still fire */
    }
  }

  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  // Mute output path — never route mic to speakers (prevents feedback).
  const mute = audioContext.createGain();
  mute.gain.value = 0;

  const chunks: Float32Array[] = [];

  let stopped = false;
  let speaking = false;
  let speechStartedAt: number | null = null;
  let lastSpeechAt: number | null = null;
  let totalSpeechMs = 0;
  let settle: ((blob: Blob | null) => void) | null = null;
  const startedAt = Date.now();

  const finish = async (keep: boolean) => {
    if (stopped) return;
    stopped = true;
    try {
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
    } catch {
      /* ignore */
    }
    // Only stop tracks we acquired. Shared streams stay open for the caller.
    if (ownsStream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    const sampleRate = audioContext.sampleRate;
    void audioContext.close();

    if (!keep || chunks.length === 0) {
      settle?.(null);
      return;
    }

    let length = 0;
    for (const c of chunks) length += c.length;
    const merged = new Float32Array(length);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const down = downsample(merged, sampleRate, 16000);
    settle?.(encodeWav(down, 16000));
  };

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));

    const level = rms(input);
    const now = Date.now();
    const quietFor =
      speaking && lastSpeechAt != null ? now - lastSpeechAt : 0;

    if (level >= speechThreshold) {
      if (!speaking) {
        speaking = true;
        speechStartedAt = now;
        options.onSpeechStart?.();
      }
      lastSpeechAt = now;
      if (speechStartedAt != null) {
        totalSpeechMs = now - speechStartedAt;
      }
      if (options.onInterruptCheck?.(totalSpeechMs)) {
        options.onSpeechEnd?.();
        void finish(true);
        return;
      }
    } else if (speaking && lastSpeechAt != null) {
      const decision = evaluateVadFrame({
        level,
        speaking: true,
        speechThreshold,
        silenceThreshold,
        totalSpeechMs,
        minSpeechMs,
        quietForMs: quietFor,
        silenceMs,
        elapsedMs: now - startedAt,
        maxMs,
      });
      if (decision.shouldFinish) {
        speaking = false;
        options.onSpeechEnd?.();
        void finish(decision.keepAudio);
        return;
      }
    }

    if (now - startedAt >= maxMs) {
      options.onSpeechEnd?.();
      void finish(totalSpeechMs >= minSpeechMs);
    }
  };

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioContext.destination);

  const done = new Promise<Blob | null>((resolve) => {
    settle = resolve;
  });

  return {
    done,
    async stop() {
      await finish(true);
      return done;
    },
    cancel() {
      void finish(false);
    },
    isSpeaking: () => speaking,
    speechMs: () => totalSpeechMs,
  };
}

/**
 * Monitor mic for barge-in while the patient is speaking.
 * Returns a stop function. No audio is retained.
 */
export async function startBargeInMonitor(opts: {
  onBargeIn: () => void;
  threshold?: number;
  /** Require this much continuous speech before firing. */
  minSpeechMs?: number;
}): Promise<() => void> {
  const threshold = opts.threshold ?? 0.02;
  const minSpeechMs = opts.minSpeechMs ?? 280;
  let stream: MediaStream;
  try {
    // Prefer barge-in constraints; fall back via shared acquirer.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: BARGE_IN_AUDIO_CONSTRAINTS,
    });
  } catch {
    try {
      const acquired = await acquireHandsFreeMicrophone();
      stream = acquired.stream;
    } catch {
      return () => undefined;
    }
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    stream.getTracks().forEach((t) => t.stop());
    return () => undefined;
  }
  const audioContext = new AudioCtx();
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      /* ignore */
    }
  }
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(2048, 1, 1);
  const mute = audioContext.createGain();
  mute.gain.value = 0;
  let stopped = false;
  let speechStart: number | null = null;
  let fired = false;

  processor.onaudioprocess = (event) => {
    if (stopped || fired) return;
    const level = rms(event.inputBuffer.getChannelData(0));
    const now = Date.now();
    if (level >= threshold) {
      if (speechStart == null) speechStart = now;
      else if (now - speechStart >= minSpeechMs) {
        fired = true;
        opts.onBargeIn();
      }
    } else {
      speechStart = null;
    }
  };

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioContext.destination);

  return () => {
    stopped = true;
    try {
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void audioContext.close();
  };
}
