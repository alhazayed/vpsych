/**
 * Phase 9.2 — ordered patient-speech audio queue (transport only).
 *
 * Text chunks → TTS → enqueue object URLs → HTMLAudioElement sequence.
 * First ready chunk plays without waiting for later chunks.
 *
 * Concurrency: at most {@link DEFAULT_TTS_IN_FLIGHT} synthesize calls in flight
 * so a long reply cannot stampede /api/voice/tts (rate limit 60/h/user).
 */

import {
  isStaleVoiceResult,
  type VoiceTurnId,
} from "@/lib/voice/turn-fence";

/** Max concurrent TTS fetches while earlier audio may still be playing. */
export const DEFAULT_TTS_IN_FLIGHT = 2;

export type SpeechQueueTurnGuard = {
  turnId: VoiceTurnId;
  isActive: (turnId: VoiceTurnId) => boolean;
};

export type SpeechQueuePlaybackPath =
  | "progressive_queue"
  | "legacy_blob"
  | "browser"
  | "interrupted";

export type SpeechQueueEvent =
  | { type: "tts_request_start"; chunkIndex: number; at: number }
  | { type: "tts_chunk_ready"; chunkIndex: number; at: number }
  | { type: "audio_queue_first_play"; at: number }
  | { type: "audio_chunk_play_start"; chunkIndex: number; at: number }
  | { type: "audio_chunk_play_end"; chunkIndex: number; at: number }
  | { type: "audio_queue_complete"; at: number }
  | {
      type: "tts_chunk_failed";
      chunkIndex: number;
      at: number;
      fatal: boolean;
    };

export type SpeechQueueMetrics = {
  /** Wall ms from queue start → first chunk object URL ready. */
  ttsFirstChunkReadyMs: number | null;
  /** Wall ms from queue start → first audio.play() resolved start. */
  ttsFirstAudioPlayMs: number | null;
  /** Wall ms spanning all TTS fetches (start of first → last chunk ready/fail). */
  ttsTotalGenerationMs: number | null;
  /** Sum of played HTMLAudioElement durations (approximate via wall play spans). */
  totalPatientAudioDurationMs: number | null;
  chunkCount: number;
  chunksPlayed: number;
  playbackPath: SpeechQueuePlaybackPath;
};

export type SynthesizeChunkResult =
  | { ok: true; objectUrl: string }
  | { ok: false; reason: "interrupted" | "failed" };

export type PlayQueuedSpeechParams = {
  chunks: string[];
  /** Injected TTS — returns a blob object URL for one chunk. */
  synthesizeChunk: (
    text: string,
    chunkIndex: number,
    signal: AbortSignal,
  ) => Promise<SynthesizeChunkResult>;
  signal?: AbortSignal;
  turn?: SpeechQueueTurnGuard;
  audioRef?: { current: HTMLAudioElement | null };
  /** Bounded TTS concurrency (default {@link DEFAULT_TTS_IN_FLIGHT}). */
  maxInFlight?: number;
  onEvent?: (event: SpeechQueueEvent) => void;
  handlers?: {
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
  };
  /**
   * Optional Audio constructor for tests (defaults to global HTMLAudioElement).
   */
  createAudio?: (src: string) => HTMLAudioElement;
  now?: () => number;
};

export type PlayQueuedSpeechResult = {
  mode: "elevenlabs" | "interrupted";
  playbackPath: SpeechQueuePlaybackPath;
  metrics: SpeechQueueMetrics;
};

type Slot = {
  index: number;
  text: string;
  objectUrl: string | null;
  failed: boolean;
  ready: Promise<void>;
  resolveReady: () => void;
};

function isStale(
  turn: SpeechQueueTurnGuard | undefined,
  signal?: AbortSignal,
): boolean {
  if (!turn) return Boolean(signal?.aborted);
  return isStaleVoiceResult({
    turnId: turn.turnId,
    isActive: turn.isActive,
    signal,
  });
}

function revoke(url: string | null | undefined) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

function emptyMetrics(
  chunkCount: number,
  playbackPath: SpeechQueuePlaybackPath,
): SpeechQueueMetrics {
  return {
    ttsFirstChunkReadyMs: null,
    ttsFirstAudioPlayMs: null,
    ttsTotalGenerationMs: null,
    totalPatientAudioDurationMs: null,
    chunkCount,
    chunksPlayed: 0,
    playbackPath,
  };
}

/**
 * Play ordered speech chunks with bounded parallel TTS preparation.
 */
export async function playQueuedSpeech(
  params: PlayQueuedSpeechParams,
): Promise<PlayQueuedSpeechResult> {
  const chunks = params.chunks.filter((c) => c.trim().length > 0);
  const now = params.now ?? (() => performance.now());
  const startedAt = now();
  const maxInFlight = Math.max(
    1,
    Math.min(4, params.maxInFlight ?? DEFAULT_TTS_IN_FLIGHT),
  );
  const emit = (event: SpeechQueueEvent) => {
    try {
      params.onEvent?.(event);
    } catch {
      /* telemetry must never break audio */
    }
  };

  if (chunks.length === 0 || isStale(params.turn, params.signal)) {
    params.handlers?.onerror?.();
    return {
      mode: "interrupted",
      playbackPath: "interrupted",
      metrics: emptyMetrics(chunks.length, "interrupted"),
    };
  }

  const abort = new AbortController();
  const onOuterAbort = () => abort.abort();
  params.signal?.addEventListener("abort", onOuterAbort, { once: true });

  const slots: Slot[] = chunks.map((text, index) => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((r) => {
      resolveReady = r;
    });
    return {
      index,
      text,
      objectUrl: null,
      failed: false,
      ready,
      resolveReady,
    };
  });

  let nextFetch = 0;
  let inFlight = 0;
  let cancelled = false;
  let firstChunkReadyAt: number | null = null;
  let firstPlayAt: number | null = null;
  let lastTtsDoneAt: number | null = null;
  let playWallMs = 0;
  let chunksPlayed = 0;
  let firstChunkFatal = false;

  const cleanupAllUrls = () => {
    for (const slot of slots) {
      revoke(slot.objectUrl);
      slot.objectUrl = null;
    }
    if (params.audioRef) params.audioRef.current = null;
  };

  const cancelQueue = () => {
    cancelled = true;
    abort.abort();
    cleanupAllUrls();
    for (const slot of slots) slot.resolveReady();
  };

  const pumpFetch = () => {
    while (
      !cancelled &&
      !abort.signal.aborted &&
      !isStale(params.turn, params.signal) &&
      inFlight < maxInFlight &&
      nextFetch < slots.length
    ) {
      const idx = nextFetch++;
      const slot = slots[idx]!;
      inFlight += 1;
      emit({ type: "tts_request_start", chunkIndex: idx, at: now() });

      void (async () => {
        try {
          if (cancelled || abort.signal.aborted || isStale(params.turn, params.signal)) {
            slot.failed = true;
            return;
          }
          const result = await params.synthesizeChunk(
            slot.text,
            idx,
            abort.signal,
          );
          if (
            cancelled ||
            abort.signal.aborted ||
            isStale(params.turn, params.signal)
          ) {
            if (result.ok) revoke(result.objectUrl);
            slot.failed = true;
            return;
          }
          if (!result.ok) {
            slot.failed = true;
            if (result.reason === "interrupted") {
              cancelQueue();
            } else if (idx === 0) {
              firstChunkFatal = true;
            }
            emit({
              type: "tts_chunk_failed",
              chunkIndex: idx,
              at: now(),
              fatal: idx === 0,
            });
            return;
          }
          slot.objectUrl = result.objectUrl;
          const t = now();
          lastTtsDoneAt = t;
          if (firstChunkReadyAt == null) firstChunkReadyAt = t;
          emit({ type: "tts_chunk_ready", chunkIndex: idx, at: t });
        } catch {
          slot.failed = true;
          if (idx === 0) firstChunkFatal = true;
          emit({
            type: "tts_chunk_failed",
            chunkIndex: idx,
            at: now(),
            fatal: idx === 0,
          });
        } finally {
          inFlight -= 1;
          slot.resolveReady();
          if (!cancelled && !abort.signal.aborted) pumpFetch();
        }
      })();
    }
  };

  const createAudio =
    params.createAudio ?? ((src: string) => new Audio(src));

  const playSlot = (slot: Slot): Promise<"ok" | "interrupted" | "failed"> => {
    if (cancelled || abort.signal.aborted || isStale(params.turn, params.signal)) {
      return Promise.resolve("interrupted");
    }
    if (slot.failed || !slot.objectUrl) {
      return Promise.resolve(slot.index === 0 ? "failed" : "failed");
    }

    const url = slot.objectUrl;
    const audio = createAudio(url);
    if (params.audioRef) params.audioRef.current = audio;

    return new Promise((resolve) => {
      let settled = false;
      const playStarted = now();

      const finish = (outcome: "ok" | "interrupted" | "failed") => {
        if (settled) return;
        settled = true;
        abort.signal.removeEventListener("abort", onAbort);
        try {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        } catch {
          /* ignore */
        }
        revoke(url);
        slot.objectUrl = null;
        if (params.audioRef?.current === audio) {
          params.audioRef.current = null;
        }
        if (outcome === "ok") {
          playWallMs += Math.max(0, now() - playStarted);
          chunksPlayed += 1;
          emit({
            type: "audio_chunk_play_end",
            chunkIndex: slot.index,
            at: now(),
          });
        }
        resolve(outcome);
      };

      const onAbort = () => finish("interrupted");

      audio.onended = () => {
        if (isStale(params.turn, params.signal) || abort.signal.aborted) {
          finish("interrupted");
          return;
        }
        finish("ok");
      };
      audio.onerror = () => finish("failed");

      abort.signal.addEventListener("abort", onAbort, { once: true });

      const tPlay = now();
      if (firstPlayAt == null) {
        firstPlayAt = tPlay;
        emit({ type: "audio_queue_first_play", at: tPlay });
        params.handlers?.onstart?.();
      }
      emit({
        type: "audio_chunk_play_start",
        chunkIndex: slot.index,
        at: tPlay,
      });

      void audio.play().catch(() => finish("failed"));
    });
  };

  pumpFetch();

  let mode: "elevenlabs" | "interrupted" = "elevenlabs";
  let playbackPath: SpeechQueuePlaybackPath = "progressive_queue";

  try {
    for (let i = 0; i < slots.length; i++) {
      if (cancelled || abort.signal.aborted || isStale(params.turn, params.signal)) {
        mode = "interrupted";
        playbackPath = "interrupted";
        break;
      }

      const slot = slots[i]!;
      await slot.ready;

      if (cancelled || abort.signal.aborted || isStale(params.turn, params.signal)) {
        mode = "interrupted";
        playbackPath = "interrupted";
        break;
      }

      if (slot.failed || !slot.objectUrl) {
        if (i === 0 || firstChunkFatal) {
          mode = "interrupted";
          playbackPath = "interrupted";
          params.handlers?.onerror?.();
          cancelQueue();
          break;
        }
        // Mid-utterance failure: stop without replaying earlier chunks.
        emit({
          type: "tts_chunk_failed",
          chunkIndex: i,
          at: now(),
          fatal: false,
        });
        params.handlers?.onerror?.();
        cancelQueue();
        mode = "elevenlabs";
        playbackPath = "progressive_queue";
        break;
      }

      // Keep the pipeline filled while this chunk plays.
      pumpFetch();

      const outcome = await playSlot(slot);
      if (outcome === "interrupted") {
        mode = "interrupted";
        playbackPath = "interrupted";
        cancelQueue();
        break;
      }
      if (outcome === "failed") {
        if (i === 0) {
          mode = "interrupted";
          playbackPath = "interrupted";
          params.handlers?.onerror?.();
          cancelQueue();
          break;
        }
        params.handlers?.onerror?.();
        cancelQueue();
        break;
      }
    }

    if (mode === "elevenlabs" && playbackPath === "progressive_queue") {
      emit({ type: "audio_queue_complete", at: now() });
      params.handlers?.onend?.();
    } else if (mode === "interrupted") {
      params.handlers?.onerror?.();
    }
  } finally {
    params.signal?.removeEventListener("abort", onOuterAbort);
    cleanupAllUrls();
  }

  const metrics: SpeechQueueMetrics = {
    ttsFirstChunkReadyMs:
      firstChunkReadyAt != null
        ? Math.max(0, Math.round(firstChunkReadyAt - startedAt))
        : null,
    ttsFirstAudioPlayMs:
      firstPlayAt != null
        ? Math.max(0, Math.round(firstPlayAt - startedAt))
        : null,
    ttsTotalGenerationMs:
      lastTtsDoneAt != null
        ? Math.max(0, Math.round(lastTtsDoneAt - startedAt))
        : null,
    totalPatientAudioDurationMs:
      chunksPlayed > 0 ? Math.max(0, Math.round(playWallMs)) : null,
    chunkCount: chunks.length,
    chunksPlayed,
    playbackPath,
  };

  return { mode, playbackPath, metrics };
}
