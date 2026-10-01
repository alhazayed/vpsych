/**
 * Lightweight energy-based Voice Activity Detection for hands-free turns.
 *
 * Two-stage endpoint (clinical wait bias):
 *   Stage 1 — quiet ≥ endpointInitialMs → endpoint *candidate* (keep listening)
 *   Stage 2 — quiet ≥ initial + confirm → *commit* turn (finish capture → STT)
 * Therapist speech during confirmation cancels the candidate and continues
 * the same capture turn.
 *
 * - Web Audio + getUserMedia with echoCancellation / noiseSuppression / AGC
 * - Mic graph muted (gain 0) so ScriptProcessor never feeds speakers
 * - No audio retained beyond the in-memory WAV for the current STT upload
 */

import {
  BARGE_IN_AUDIO_CONSTRAINTS,
  HANDS_FREE_AUDIO_CONSTRAINTS,
} from "./audio-constraints";
import {
  endpointCommitSilenceMs,
  resolveTurnTakingConfig,
  type TurnTakingConfig,
} from "./turn-taking-config";

export type VadController = {
  /**
   * Resolves when the turn ends naturally (confirmed silence, max duration,
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
  /** True while Stage-1 candidate is pending Stage-2 confirmation. */
  isEndpointPending: () => boolean;
};

export type HandsFreeVadOptions = {
  /** Stage-1 silence (ms) after speech → endpoint candidate. */
  silenceMs?: number;
  /** Stage-2 additional silence (ms) to confirm end-of-turn. */
  confirmMs?: number;
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
  /** Stage-1: silence candidate raised (still listening / recording). */
  onEndpointCandidate?: (quietMs: number) => void;
  /** Therapist resumed during Stage-2 — candidate cleared. */
  onEndpointCancelled?: (quietMs: number) => void;
  /** Stage-2 confirmed — about to finish capture. */
  onEndpointConfirmed?: (quietMs: number) => void;
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
 * Clamp Stage-1 silence into the clinical initial window.
 * @deprecated Prefer resolveTurnTakingConfig(); kept for barrel / test compat.
 */
export function resolveSilenceMs(requested?: number): number {
  const cfg = resolveTurnTakingConfig(
    requested != null && Number.isFinite(requested)
      ? { endpointInitialMs: requested }
      : undefined,
  );
  return cfg.endpointInitialMs;
}

export type VadFrameDecision = {
  nowSpeaking: boolean;
  speechStarted: boolean;
  speechEnded: boolean;
  shouldFinish: boolean;
  keepAudio: boolean;
  /** Stage-1 candidate active after this frame. */
  endpointCandidate: boolean;
  /** Candidate was cleared because speech resumed. */
  endpointCancelled: boolean;
  /** Stage-2 confirmed — commit the turn. */
  endpointConfirmed: boolean;
};

/**
 * Pure two-stage VAD frame decision — unit-tested without Web Audio.
 *
 * Stage 1 (candidate): quietForMs ≥ silenceMs (initial)
 * Stage 2 (commit):    quietForMs ≥ silenceMs + confirmMs
 * Speech during candidate → cancel and continue the same turn.
 */
export function evaluateVadFrame(input: {
  level: number;
  speaking: boolean;
  speechThreshold: number;
  silenceThreshold: number;
  totalSpeechMs: number;
  minSpeechMs: number;
  quietForMs: number;
  /** Stage-1 silence (ms). */
  silenceMs: number;
  /** Stage-2 additional silence (ms). Default 0 = legacy single-stage. */
  confirmMs?: number;
  /** Whether Stage-1 candidate is already pending. */
  endpointCandidate?: boolean;
  elapsedMs: number;
  maxMs: number;
  /** Optional absolute max quiet (initial+confirm). */
  maxQuietMs?: number;
}): VadFrameDecision {
  let nowSpeaking = input.speaking;
  let speechStarted = false;
  let speechEnded = false;
  let shouldFinish = false;
  let keepAudio = false;
  let endpointCandidate = Boolean(input.endpointCandidate);
  let endpointCancelled = false;
  let endpointConfirmed = false;

  const confirmMs = Math.max(0, input.confirmMs ?? 0);
  const commitQuiet = Math.min(
    input.maxQuietMs ?? input.silenceMs + confirmMs,
    input.silenceMs + confirmMs,
  );

  if (input.level >= input.speechThreshold) {
    if (endpointCandidate) {
      endpointCandidate = false;
      endpointCancelled = true;
    }
    if (!nowSpeaking) {
      nowSpeaking = true;
      speechStarted = true;
    }
  } else if (nowSpeaking || endpointCandidate) {
    // Quiet relative to speechThreshold. Short pauses gated by quietForMs.
    const quietEnoughForCandidate =
      input.totalSpeechMs >= input.minSpeechMs &&
      input.quietForMs >= input.silenceMs &&
      input.level < Math.max(input.silenceThreshold, input.speechThreshold);

    const quietEnoughToCommit =
      input.totalSpeechMs >= input.minSpeechMs &&
      input.quietForMs >= commitQuiet &&
      input.level < Math.max(input.silenceThreshold, input.speechThreshold);

    if (quietEnoughToCommit) {
      nowSpeaking = false;
      speechEnded = true;
      shouldFinish = true;
      keepAudio = true;
      endpointCandidate = true;
      endpointConfirmed = true;
    } else if (quietEnoughForCandidate) {
      // Stage-1: raise / hold candidate — do NOT finish yet when confirmMs > 0.
      if (confirmMs <= 0) {
        // Legacy single-stage: candidate == commit.
        nowSpeaking = false;
        speechEnded = true;
        shouldFinish = true;
        keepAudio = true;
        endpointCandidate = true;
        endpointConfirmed = true;
      } else {
        if (!endpointCandidate) {
          endpointCandidate = true;
          speechEnded = true; // energy speech ended; turn not committed
        }
        nowSpeaking = false;
      }
    }
  }

  if (!shouldFinish && input.elapsedMs >= input.maxMs) {
    speechEnded = nowSpeaking || input.totalSpeechMs >= input.minSpeechMs;
    shouldFinish = true;
    keepAudio = input.totalSpeechMs >= input.minSpeechMs;
    nowSpeaking = false;
    if (keepAudio) {
      endpointConfirmed = true;
      endpointCandidate = true;
    }
  }

  return {
    nowSpeaking,
    speechStarted,
    speechEnded,
    shouldFinish,
    keepAudio,
    endpointCandidate,
    endpointCancelled,
    endpointConfirmed,
  };
}

/**
 * Start hands-free listening. Resolves only after Stage-2 confirmation
 * (or max duration / patient-interrupt), never on a short mid-sentence pause.
 */
export async function startHandsFreeVad(
  options: HandsFreeVadOptions = {},
): Promise<VadController> {
  const baseCfg: Partial<TurnTakingConfig> = {};
  if (options.silenceMs != null) baseCfg.endpointInitialMs = options.silenceMs;
  if (options.confirmMs != null) baseCfg.endpointConfirmMs = options.confirmMs;
  if (options.minSpeechMs != null) baseCfg.minSpeechMs = options.minSpeechMs;
  if (options.maxMs != null) baseCfg.maxCaptureMs = options.maxMs;

  const cfg = resolveTurnTakingConfig(baseCfg);
  const silenceMs = cfg.endpointInitialMs;
  const confirmMs = cfg.endpointConfirmMs;
  const commitQuiet = endpointCommitSilenceMs(cfg);
  const maxMs = options.maxMs ?? cfg.maxCaptureMs;
  const speechThreshold =
    options.speechThreshold ?? cfg.speechRmsThreshold;
  const silenceThreshold =
    options.silenceThreshold ?? speechThreshold * 0.55;
  const minSpeechMs = options.minSpeechMs ?? cfg.minSpeechMs;

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

  let stopped = false;
  let speaking = false;
  let endpointCandidate = false;
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
      lastSpeechAt != null && (speaking || endpointCandidate)
        ? now - lastSpeechAt
        : 0;

    if (level >= speechThreshold) {
      if (endpointCandidate) {
        options.onEndpointCancelled?.(quietFor);
        endpointCandidate = false;
      }
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
    } else if (speaking || endpointCandidate) {
      const decision = evaluateVadFrame({
        level,
        speaking,
        speechThreshold,
        silenceThreshold,
        totalSpeechMs,
        minSpeechMs,
        quietForMs: quietFor,
        silenceMs,
        confirmMs,
        endpointCandidate,
        elapsedMs: now - startedAt,
        maxMs,
        maxQuietMs: commitQuiet,
      });

      if (decision.endpointCancelled) {
        options.onEndpointCancelled?.(quietFor);
      }
      if (
        decision.endpointCandidate &&
        !endpointCandidate &&
        !decision.shouldFinish
      ) {
        options.onEndpointCandidate?.(quietFor);
      }
      if (decision.endpointConfirmed) {
        options.onEndpointConfirmed?.(quietFor);
      }

      speaking = decision.nowSpeaking;
      endpointCandidate = decision.endpointCandidate;

      if (decision.speechEnded && !decision.shouldFinish) {
        // Energy speech ended at Stage-1; turn still open.
        options.onSpeechEnd?.();
      }

      if (decision.shouldFinish) {
        if (!decision.speechEnded) {
          options.onSpeechEnd?.();
        }
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
    isEndpointPending: () => endpointCandidate,
  };
}

/**
 * Monitor mic for barge-in while the patient is speaking (or while STT/GPT
 * is in flight). Returns a stop function. No audio is retained.
 */
export async function startBargeInMonitor(opts: {
  onBargeIn: () => void;
  threshold?: number;
  /** Require this much continuous speech before firing. */
  minSpeechMs?: number;
}): Promise<() => void> {
  const cfg = resolveTurnTakingConfig();
  const threshold = opts.threshold ?? cfg.bargeInRmsThreshold;
  const minSpeechMs = opts.minSpeechMs ?? cfg.bargeInMinSpeechMs;
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
