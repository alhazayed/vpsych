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
   * Take ownership of `stream` (stop its tracks on finish). Used when the
   * barge-in monitor hands its live microphone over so capture has no gap.
   */
  adoptStream?: boolean;
  /**
   * Audio captured BEFORE this VAD started (barge-in monitor ring buffer).
   * Seeds the capture so the first words of an interruption ("طيب بس…")
   * reach STT, and starts the VAD in the speaking state. A function is
   * drained on the first audio callback, so the monitor keeps capturing
   * until this VAD is live (no gap at the handoff).
   */
  preroll?: VadPreroll | ((firstFrameStartedAt: number) => VadPreroll);
  /**
   * Human Conversation Fidelity — two-stage endpointing. When set, silence ≥
   * silenceMs does NOT end the turn: `onPause` receives a snapshot for
   * speculative STT and the mic stays open. Renewed speech fires `onResume`.
   * The turn ends via controller.stop(), `maxSilenceMs`, or `maxMs`.
   */
  twoStage?: {
    onPause: (info: {
      wav: Blob;
      speechMs: number;
      /** Date.now()-based timestamp of the last voiced frame. */
      silenceStartedAt: number;
    }) => void;
    onResume: () => void;
    /**
     * Voiced audio during a pending pause that is not yet a confirmed resume
     * (true), or that died out before confirmation (false).
     */
    onActivity?: (active: boolean) => void;
    /** Hard ceiling of trailing silence before auto-commit. */
    maxSilenceMs: number;
    /** Continuous voiced time required to count as resumed speech. */
    resumeMinMs?: number;
  };
};

/** Pre-roll handed from the barge-in monitor to the capture VAD. */
export type VadPreroll = {
  frames: Float32Array[];
  sampleRate: number;
  /** Date.now()-based onset of the therapist speech that triggered barge-in. */
  speechOnsetAt: number;
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

/** Linear resample (pre-roll may come from a context with another rate). */
function resampleLinear(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || buffer.length === 0) return buffer;
  const newLen = Math.max(1, Math.round((buffer.length * toRate) / fromRate));
  const out = new Float32Array(newLen);
  const ratio = (buffer.length - 1) / Math.max(1, newLen - 1);
  for (let i = 0; i < newLen; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(buffer.length - 1, lo + 1);
    const frac = pos - lo;
    out[i] = (buffer[lo] ?? 0) * (1 - frac) + (buffer[hi] ?? 0) * frac;
  }
  return out;
}

/** Merge captured frames → 16 kHz mono WAV (OpenAI STT-friendly). */
export function encodeCapturedFrames(
  frames: Float32Array[],
  sampleRate: number,
): Blob {
  let length = 0;
  for (const c of frames) length += c.length;
  const merged = new Float32Array(length);
  let offset = 0;
  for (const c of frames) {
    merged.set(c, offset);
    offset += c.length;
  }
  return encodeWav(downsample(merged, sampleRate, 16000), 16000);
}

/**
 * Bounded ring of recent mic frames (barge-in pre-roll). Pure — no Web Audio.
 * Keeps at most `maxSamples` samples, dropping the oldest whole frames.
 */
export function createFrameRing(maxSamples: number): {
  /** `endedAt` = Date.now() when the frame was delivered (end of frame). */
  push: (frame: Float32Array, endedAt?: number) => void;
  snapshot: () => Float32Array[];
  /** Frames that ended at or before `cutoff` (handoff de-duplication). */
  snapshotUntil: (cutoff: number) => Float32Array[];
  /** Frames ending within (from, until] — lead-in trimming + de-duplication. */
  snapshotBetween: (from: number, until: number) => Float32Array[];
  samples: () => number;
  /** Stop evicting (after a barge-in fires, keep everything until drained). */
  freeze: () => void;
} {
  const frames: Float32Array[] = [];
  const ends: number[] = [];
  let total = 0;
  let frozen = false;
  return {
    push(frame, endedAt = 0) {
      frames.push(frame);
      ends.push(endedAt);
      total += frame.length;
      while (
        !frozen &&
        frames.length > 1 &&
        total - frames[0]!.length >= maxSamples
      ) {
        total -= frames.shift()!.length;
        ends.shift();
      }
    },
    snapshot: () => [...frames],
    snapshotUntil: (cutoff) => frames.filter((_, i) => ends[i]! <= cutoff),
    snapshotBetween: (from, until) =>
      frames.filter((_, i) => ends[i]! > from && ends[i]! <= until),
    samples: () => total,
    freeze() {
      frozen = true;
    },
  };
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
 *
 * With `twoStage`, silence only reports a pause (speculative STT); the turn
 * resolves on stop(), `twoStage.maxSilenceMs`, or `maxMs`.
 */
export async function startHandsFreeVad(
  options: HandsFreeVadOptions = {},
): Promise<VadController> {
  const silenceMs = resolveSilenceMs(options.silenceMs);
  const maxMs = options.maxMs ?? 30000;
  const speechThreshold = options.speechThreshold ?? 0.015;
  const silenceThreshold = options.silenceThreshold ?? speechThreshold * 0.55;
  const minSpeechMs = options.minSpeechMs ?? 400;
  const twoStage = options.twoStage;
  const resumeMinMs = twoStage?.resumeMinMs ?? 150;

  const ownsStream = !options.stream || Boolean(options.adoptStream);
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
  /**
   * Index in `chunks` of the first voiced frame. Audio more than
   * SPEECH_LEAD_IN_MS before it is silence-before-speaking (the mic opens as
   * soon as the patient stops) and is not uploaded: STT latency grows with
   * clip length.
   */
  let firstVoicedChunk: number | null = null;
  /** Two-stage: a pause was reported and not yet resumed. */
  let pausePending = false;
  /** Two-stage: start of the current re-voicing run while pausePending. */
  let resumeRunStartedAt: number | null = null;
  let settle: ((blob: Blob | null) => void) | null = null;
  const startedAt = Date.now();

  // Barge-in pre-roll: the therapist is already mid-word.
  /** Frames to upload: from just before the first voiced frame. */
  const framesForUpload = (): Float32Array[] => {
    if (firstVoicedChunk == null || chunks.length === 0) return chunks;
    const frameMs = (chunks[firstVoicedChunk]!.length / audioContext.sampleRate) * 1000;
    const leadFrames = Math.ceil(SPEECH_LEAD_IN_MS / Math.max(1, frameMs));
    return chunks.slice(Math.max(0, firstVoicedChunk - leadFrames));
  };
  const seedPreroll = (preroll: VadPreroll) => {
    for (const frame of preroll.frames) {
      chunks.push(resampleLinear(frame, preroll.sampleRate, audioContext.sampleRate));
    }
    speechStartedAt = Math.min(Date.now(), preroll.speechOnsetAt);
    totalSpeechMs = Date.now() - speechStartedAt;
  };
  let pendingPrerollDrain: ((firstFrameStartedAt: number) => VadPreroll) | null =
    null;
  if (options.preroll) {
    speaking = true;
    lastSpeechAt = Date.now();
    if (typeof options.preroll === "function") {
      pendingPrerollDrain = options.preroll;
    } else {
      seedPreroll(options.preroll);
    }
    options.onSpeechStart?.();
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
    // Only stop tracks we acquired (or adopted). Shared streams stay open.
    if (ownsStream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    const sampleRate = audioContext.sampleRate;
    void audioContext.close();

    if (!keep || chunks.length === 0) {
      settle?.(null);
      return;
    }
    settle?.(encodeCapturedFrames(framesForUpload(), sampleRate));
  };

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    if (pendingPrerollDrain) {
      // Take the monitor's audio up to where this first buffer begins.
      const drain = pendingPrerollDrain;
      pendingPrerollDrain = null;
      const frameMs = (input.length / audioContext.sampleRate) * 1000;
      try {
        seedPreroll(drain(Date.now() - frameMs));
      } catch {
        /* pre-roll is best-effort; live capture continues */
      }
    }
    chunks.push(new Float32Array(input));

    const level = rms(input);
    const now = Date.now();
    const quietFor =
      speaking && lastSpeechAt != null ? now - lastSpeechAt : 0;

    if (twoStage && pausePending) {
      if (level >= speechThreshold) {
        if (resumeRunStartedAt == null) {
          resumeRunStartedAt = now;
          twoStage.onActivity?.(true);
        }
        // Count frame duration so a single long frame can qualify.
        const frameMs = (input.length / audioContext.sampleRate) * 1000;
        if (now - resumeRunStartedAt + frameMs >= resumeMinMs) {
          pausePending = false;
          resumeRunStartedAt = null;
          lastSpeechAt = now;
          twoStage.onResume();
        }
      } else {
        if (resumeRunStartedAt != null) twoStage.onActivity?.(false);
        resumeRunStartedAt = null;
        if (lastSpeechAt != null && now - lastSpeechAt >= twoStage.maxSilenceMs) {
          speaking = false;
          options.onSpeechEnd?.();
          void finish(true);
          return;
        }
      }
      if (now - startedAt >= maxMs) {
        options.onSpeechEnd?.();
        void finish(totalSpeechMs >= minSpeechMs);
      }
      return;
    }

    if (level >= speechThreshold) {
      if (!speaking) {
        speaking = true;
        speechStartedAt = now;
        if (firstVoicedChunk == null) firstVoicedChunk = chunks.length - 1;
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
        if (twoStage && decision.keepAudio && now - startedAt < maxMs) {
          // Stage 1: report the pause, keep listening.
          pausePending = true;
          resumeRunStartedAt = null;
          twoStage.onPause({
            wav: encodeCapturedFrames(framesForUpload(), audioContext.sampleRate),
            speechMs: totalSpeechMs,
            silenceStartedAt: lastSpeechAt,
          });
          return;
        }
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
      if (!stopped) options.onSpeechEnd?.();
      await finish(true);
      return done;
    },
    cancel() {
      void finish(false);
    },
    isSpeaking: () => speaking && !pausePending,
    speechMs: () => totalSpeechMs,
  };
}

/** Audio kept before the detected speech onset in a handoff pre-roll. */
const PREROLL_LEAD_MS = 300;

/** Audio kept before the first voiced frame of a capture (STT upload). */
const SPEECH_LEAD_IN_MS = 300;

/** Upper bound on post-detection capture held for an un-drained handoff. */
const HANDOFF_MAX_HOLD_MS = 5000;

/** Live microphone + pre-roll handed from the barge-in monitor to capture. */
export type BargeInHandoff = {
  stream: MediaStream;
  /**
   * Stop the monitor and return everything it captured (ring + audio since
   * detection), excluding frames that end after `cutoff` (Date.now()), which
   * the receiving VAD already has. Pass directly as `preroll`.
   */
  drain: (cutoff?: number) => VadPreroll;
  /** performance.now() when barge-in fired (for stop-latency telemetry). */
  detectedAt: number;
  /** ms from therapist speech onset to detection. */
  detectLatencyMs: number;
  /** Stop the tracks if nobody adopts the stream. Idempotent. */
  release: () => void;
};

/**
 * Monitor mic for barge-in while the patient is speaking.
 * Returns a stop function. No audio is retained beyond the in-memory
 * pre-roll ring (≤ prerollMs), which is discarded unless handed off.
 */
export async function startBargeInMonitor(opts: {
  /** `handoff` is present when `handoff: true` was requested. */
  onBargeIn: (handoff?: BargeInHandoff) => void;
  threshold?: number;
  /** Require this much continuous speech before firing. */
  minSpeechMs?: number;
  /**
   * Hand the live stream + pre-roll to the caller instead of stopping it,
   * so the capture VAD keeps the interruption's first words.
   */
  handoff?: boolean;
  /** Ring-buffer length kept for the handoff (default 1500 ms). */
  prerollMs?: number;
}): Promise<() => void> {
  const threshold = opts.threshold ?? 0.02;
  const minSpeechMs = opts.minSpeechMs ?? 280;
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
  const ring = opts.handoff
    ? createFrameRing(
        Math.round(((opts.prerollMs ?? 1500) / 1000) * audioContext.sampleRate),
      )
    : null;
  let stopped = false;
  let speechStart: number | null = null;
  let fired = false;
  let handedOff = false;

  const disconnect = () => {
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
    const now = Date.now();
    ring?.push(new Float32Array(input), now);
    // After firing with a handoff, keep capturing until drained (no gap).
    if (fired) return;
    const level = rms(input);
    if (level >= threshold) {
      if (speechStart == null) {
        // Frame onset ≈ start of this buffer.
        speechStart =
          now - Math.round((input.length / audioContext.sampleRate) * 1000);
      } else if (now - speechStart >= minSpeechMs) {
        fired = true;
        if (!ring) {
          opts.onBargeIn();
          return;
        }
        handedOff = true;
        ring.freeze();
        const onsetAt = speechStart;
        let released = false;
        let drained = false;
        const stopCapture = () => {
          if (stopped) return;
          stopped = true;
          disconnect();
        };
        // Never capture unboundedly if nobody drains or releases.
        const maxHold = setTimeout(stopCapture, HANDOFF_MAX_HOLD_MS);
        opts.onBargeIn({
          stream,
          drain: (cutoff = Date.now()) => {
            clearTimeout(maxHold);
            stopCapture();
            // Keep a short lead-in before the onset, not seconds of silence.
            const frames = drained
              ? []
              : ring.snapshotBetween(onsetAt - PREROLL_LEAD_MS, cutoff);
            drained = true;
            return {
              frames,
              sampleRate: audioContext.sampleRate,
              speechOnsetAt: onsetAt,
            };
          },
          detectedAt: performance.now(),
          detectLatencyMs: now - onsetAt,
          release: () => {
            clearTimeout(maxHold);
            stopCapture();
            if (released) return;
            released = true;
            stream.getTracks().forEach((t) => t.stop());
          },
        });
      }
    } else {
      speechStart = null;
    }
  };

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioContext.destination);

  return () => {
    if (handedOff) return; // stream now owned by the handoff receiver
    stopped = true;
    disconnect();
    stream.getTracks().forEach((t) => t.stop());
  };
}
