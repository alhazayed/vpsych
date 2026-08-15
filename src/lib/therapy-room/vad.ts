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

import {
  BARGE_IN_AUDIO_CONSTRAINTS,
  HANDS_FREE_AUDIO_CONSTRAINTS,
} from "./audio-constraints";
import { HANDS_FREE_PERF_BUDGETS } from "./conversation-telemetry";
import {
  createTurnController,
  DEFAULT_TURN_CONFIG,
  type TurnState,
} from "@/lib/voice/turn-controller";

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
  /** Current turn-taking state (LISTENING → … → CONFIRMED_END). */
  turnState: () => TurnState;
};

export type HandsFreeVadOptions = {
  /**
   * Silence duration (ms) after speech that moves the turn into POSSIBLE_END.
   * This no longer ends the turn on its own — see `confirmEndSilenceMs`.
   */
  silenceMs?: number;
  /**
   * Additional continuous silence required to confirm the therapist actually
   * finished. Speech arriving inside this window returns the floor to them.
   */
  confirmEndSilenceMs?: number;
  /** Fired when the turn enters POSSIBLE_END (not yet committed). */
  onPossibleEnd?: () => void;
  /** Fired when speech resumes and cancels a pending POSSIBLE_END. */
  onSpeechResumed?: () => void;
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
  const minSpeechMs = options.minSpeechMs ?? 400;

  const ownsStream = !options.stream;
  const stream =
    options.stream ??
    (await navigator.mediaDevices.getUserMedia({
      audio: HANDS_FREE_AUDIO_CONSTRAINTS,
    }));

  const audioContext = new AudioContext();
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

  // Two-stage end-of-turn: the energy detector proposes POSSIBLE_END, the
  // controller decides whether the therapist actually finished.
  const controller = createTurnController({
    possibleEndSilenceMs: silenceMs,
    confirmEndSilenceMs:
      options.confirmEndSilenceMs ?? DEFAULT_TURN_CONFIG.confirmEndSilenceMs,
    minSpeechMs,
    maxTurnMs: maxMs,
  });

  let stopped = false;
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
    const isSpeech = level >= speechThreshold;

    const transition = controller.observe({ speaking: isSpeech, nowMs: now });

    if (transition.changed) {
      if (transition.to === "USER_SPEAKING") {
        if (transition.reason === "speech_started") options.onSpeechStart?.();
        else if (transition.reason === "speech_resumed") {
          options.onSpeechResumed?.();
        }
      } else if (transition.to === "POSSIBLE_END") {
        options.onPossibleEnd?.();
      }
    }

    if (isSpeech && options.onInterruptCheck?.(controller.getSpeechMs())) {
      options.onSpeechEnd?.();
      void finish(true);
      return;
    }

    if (controller.getState() === "CONFIRMED_END") {
      options.onSpeechEnd?.();
      void finish(true);
      return;
    }

    if (now - startedAt >= maxMs) {
      options.onSpeechEnd?.();
      void finish(controller.getSpeechMs() >= minSpeechMs);
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
    isSpeaking: () => controller.getState() === "USER_SPEAKING",
    speechMs: () => controller.getSpeechMs(),
    turnState: () => controller.getState(),
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
  /**
   * Refractory period after a fire before the monitor re-arms. Without this the
   * monitor latched permanently after one detection, so a false positive
   * disabled barge-in for the rest of the patient turn.
   */
  rearmAfterMs?: number;
  /**
   * Ignore the first moments after start. Patient audio is ramping up and the
   * browser's echo canceller has not converged yet, which is when speaker
   * bleed is most likely to be misread as therapist speech.
   */
  graceMs?: number;
}): Promise<() => void> {
  const threshold = opts.threshold ?? 0.02;
  const minSpeechMs = opts.minSpeechMs ?? 280;
  const rearmAfterMs = opts.rearmAfterMs ?? 1200;
  const graceMs = opts.graceMs ?? 250;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: BARGE_IN_AUDIO_CONSTRAINTS,
    });
  } catch {
    return () => undefined;
  }

  const audioContext = new AudioContext();
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
  let lastFiredAt: number | null = null;
  const monitorStartedAt = Date.now();

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const now = Date.now();

    if (now - monitorStartedAt < graceMs) return;
    // Refractory: armed again once rearmAfterMs has elapsed since the last fire.
    if (lastFiredAt != null && now - lastFiredAt < rearmAfterMs) {
      speechStart = null;
      return;
    }

    const level = rms(event.inputBuffer.getChannelData(0));
    if (level >= threshold) {
      if (speechStart == null) speechStart = now;
      else if (now - speechStart >= minSpeechMs) {
        lastFiredAt = now;
        speechStart = null;
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
