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
  /**
   * Audio already captured while the therapist started speaking (barge-in).
   * Seeds the recording and starts the turn in the speaking state.
   */
  preroll?: { samples: Float32Array; sampleRate: number; speechMs: number };
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

  // A passed stream is adopted (stopped on finish) unless the caller retains it.
  const ownsStream = !options.stream || !options.retainStream;
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

  let stopped = false;
  let speaking = false;
  let speechStartedAt: number | null = null;
  let lastSpeechAt: number | null = null;
  let totalSpeechMs = 0;
  let settle: ((blob: Blob | null) => void) | null = null;
  const startedAt = Date.now();

  if (options.preroll && options.preroll.samples.length > 0) {
    chunks.push(
      downsample(
        options.preroll.samples,
        options.preroll.sampleRate,
        audioContext.sampleRate,
      ),
    );
    speaking = true;
    speechStartedAt = startedAt - Math.max(0, options.preroll.speechMs);
    lastSpeechAt = startedAt;
    totalSpeechMs = startedAt - speechStartedAt;
  }

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
  if (speaking) options.onSpeechStart?.();

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
 * Pure barge-in decision — unit-tested without Web Audio.
 *
 * The patient's own voice leaks back into the mic (speakers → room → mic) and
 * echo cancellation removes only part of it on many devices. A fixed level
 * threshold either misses the therapist or aborts the patient's clip on its
 * own echo. So the detector first calibrates the residual echo floor while
 * the patient is talking, then fires only on sustained speech clearly louder
 * than that floor. Brief dips between syllables do not reset the run.
 */
export type BargeInDetectorOptions = {
  /** Absolute RMS floor (0–1) below which nothing counts as speech. */
  threshold?: number;
  /** Continuous speech needed before firing. */
  minSpeechMs?: number;
  /** Listen-only window at start used to learn the echo floor. */
  calibrationMs?: number;
  /** Speech must be this many times louder than the echo floor. */
  echoRatio?: number;
  /** Dips shorter than this inside a run keep the run alive. */
  gapToleranceMs?: number;
};

export const BARGE_IN_DEFAULTS = {
  threshold: 0.02,
  minSpeechMs: 300,
  calibrationMs: 450,
  echoRatio: 2.5,
  gapToleranceMs: 150,
} as const;

export function createBargeInDetector(options: BargeInDetectorOptions = {}) {
  const threshold = options.threshold ?? BARGE_IN_DEFAULTS.threshold;
  const minSpeechMs = options.minSpeechMs ?? BARGE_IN_DEFAULTS.minSpeechMs;
  const calibrationMs = options.calibrationMs ?? BARGE_IN_DEFAULTS.calibrationMs;
  const echoRatio = options.echoRatio ?? BARGE_IN_DEFAULTS.echoRatio;
  const gapToleranceMs =
    options.gapToleranceMs ?? BARGE_IN_DEFAULTS.gapToleranceMs;

  let startedAt: number | null = null;
  const calibration: number[] = [];
  let floor = 0;
  let runStart: number | null = null;
  let lastLoudAt: number | null = null;
  let fired = false;

  const trigger = () => Math.max(threshold, floor * echoRatio);

  return {
    /** Feed one frame's RMS level; returns true once, when barge-in fires. */
    push(level: number, now: number): boolean {
      if (fired) return false;
      if (startedAt == null) startedAt = now;

      if (now - startedAt < calibrationMs) {
        calibration.push(level);
        return false;
      }
      if (calibration.length > 0) {
        // 90th percentile: the echo's loud syllables, not its average.
        const sorted = [...calibration].sort((a, b) => a - b);
        floor = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!;
        calibration.length = 0;
      }

      if (level >= trigger()) {
        if (runStart == null) runStart = now;
        lastLoudAt = now;
        if (now - runStart >= minSpeechMs) {
          fired = true;
          return true;
        }
        return false;
      }

      if (runStart != null && lastLoudAt != null && now - lastLoudAt <= gapToleranceMs) {
        return false;
      }
      runStart = null;
      lastLoudAt = null;
      // Track a drifting echo floor (louder patient passage, volume change).
      floor = floor * 0.95 + level * 0.05;
      return false;
    },
    /** Speech duration of the current run (ms), 0 when none. */
    runMs(now: number): number {
      return runStart == null ? 0 : now - runStart;
    },
    echoFloor: () => floor,
  };
}

/**
 * What the barge-in monitor hands to the next listen turn: the still-open mic
 * stream plus the audio captured while the therapist started talking, so the
 * first words are not lost to the mic re-open gap.
 */
export type BargeInHandoff = {
  stream: MediaStream;
  preroll: Float32Array;
  sampleRate: number;
  speechMs: number;
  /** Stop the stream if nobody adopts it. Idempotent. */
  release: () => void;
};

/** How much audio before the fire point is kept for the next turn. */
const BARGE_IN_PREROLL_MS = 1500;
/** Audio kept before the detected speech run (word onsets are quiet). */
const BARGE_IN_LEAD_IN_MS = 250;

/**
 * Monitor mic for barge-in while the patient is speaking.
 * Returns a stop function. Audio is kept only in a short in-memory ring
 * buffer that is handed to the next listen turn on fire, never stored.
 */
export async function startBargeInMonitor(
  opts: BargeInDetectorOptions & {
    onBargeIn: (handoff: BargeInHandoff) => void;
  },
): Promise<() => void> {
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
  const detector = createBargeInDetector(opts);
  const ring: Float32Array[] = [];
  const maxRingSamples = Math.ceil(
    (audioContext.sampleRate * BARGE_IN_PREROLL_MS) / 1000,
  );
  let ringSamples = 0;
  let stopped = false;
  let handedOff = false;

  const teardownGraph = () => {
    try {
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
    } catch {
      /* ignore */
    }
    void audioContext.close();
  };

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    ring.push(new Float32Array(input));
    ringSamples += input.length;
    while (ring.length > 1 && ringSamples - ring[0]!.length >= maxRingSamples) {
      ringSamples -= ring.shift()!.length;
    }
    const now = Date.now();
    const speechMs = detector.runMs(now);
    if (!detector.push(rms(input), now)) return;

    stopped = true;
    handedOff = true;
    const sampleRate = audioContext.sampleRate;
    teardownGraph();
    // Keep only the therapist's run plus a short lead-in: older ring audio is
    // mostly patient echo and would be transcribed as the therapist's words.
    const runMs = Math.max(speechMs, detector.runMs(now));
    const keep = Math.min(
      ringSamples,
      Math.ceil((sampleRate * (runMs + BARGE_IN_LEAD_IN_MS)) / 1000),
    );
    const all = new Float32Array(ringSamples);
    let offset = 0;
    for (const c of ring) {
      all.set(c, offset);
      offset += c.length;
    }
    const preroll = all.slice(ringSamples - keep);
    let released = false;
    opts.onBargeIn({
      stream,
      preroll,
      sampleRate,
      speechMs: runMs,
      release: () => {
        if (released) return;
        released = true;
        stream.getTracks().forEach((t) => t.stop());
      },
    });
  };

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioContext.destination);

  return () => {
    if (handedOff) return; // the stream now belongs to the handoff
    if (stopped) return;
    stopped = true;
    teardownGraph();
    stream.getTracks().forEach((t) => t.stop());
  };
}
