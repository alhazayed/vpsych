/**
 * Bounded progressive TTS queue for one patient draft attempt.
 *
 * Sentences arrive while the LLM is still streaming; each becomes a TTS chunk
 * synthesized through the existing /api/voice/tts (ElevenLabs) route and
 * played strictly in order.
 *
 * Bounds:
 *   - at most `maxConcurrent` (default 2) synthesis requests in flight;
 *   - at most `maxQueued` (default 6) chunks pending (not yet finished
 *     playing). Further sentences are appended to the last chunk whose
 *     synthesis has not started, or held until a slot frees — text is never
 *     dropped or reordered.
 *
 * Abort (barge-in, regeneration, new turn, session end) cancels every
 * in-flight synthesis, stops the playing chunk, revokes every object URL, and
 * turns all late callbacks into no-ops. A queue never plays once `isCurrent()`
 * is false, so audio from a stale turn cannot resume.
 *
 * DOM-free: synthesis / playback / URL revocation are injected so the queue
 * is unit-testable; `browserSpeechChunkDeps` wires the browser defaults.
 */

import { synthesizeSpeech, speakWithBrowser } from "@/lib/voice/client";
import type { SessionSpeechLocale } from "@/lib/voice/pipeline-types";

export type SpeechChunkAudio =
  | { kind: "audio"; url: string }
  /** ElevenLabs unavailable for this chunk — speak it with browser TTS. */
  | { kind: "browser" };

export type ProgressiveSpeechDeps = {
  synthesize: (text: string, signal: AbortSignal) => Promise<SpeechChunkAudio>;
  /** Resolve when the chunk finished playing, failed, or `signal` aborted. */
  play: (
    audio: SpeechChunkAudio,
    text: string,
    signal: AbortSignal,
  ) => Promise<void>;
  revoke: (url: string) => void;
  /** Turn fence; nothing plays once this returns false. */
  isCurrent: () => boolean;
  /** Abortable wait (thinking pause before first audio). */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export type ProgressiveSpeechOptions = {
  maxConcurrent?: number;
  maxQueued?: number;
  /** Merged chunks never exceed this (TTS route progressive cap). Default 400. */
  maxChunkChars?: number;
  /** Humanization thinking pause before the first chunk plays. */
  pauseBeforeMs?: number;
  onPlaybackStart?: () => void;
  /** Fires once: all enqueued text played after `close()`, or aborted. */
  onSettled?: (outcome: "completed" | "aborted") => void;
};

type ChunkState = "waiting" | "synthesizing" | "ready" | "playing" | "done";

type Chunk = {
  index: number;
  text: string;
  state: ChunkState;
  audio?: SpeechChunkAudio;
};

export type ProgressiveSpeechQueue = {
  /** Add a sentence. Returns false when the queue is closed or aborted. */
  enqueue: (text: string) => boolean;
  /** No more text for this attempt; settle after the last chunk plays. */
  close: () => void;
  /** Stop everything now (barge-in / regeneration / stale turn). */
  abort: () => void;
  settled: Promise<"completed" | "aborted">;
  stats: () => {
    chunks: number;
    pending: number;
    inFlight: number;
    maxInFlight: number;
    played: number;
    aborted: boolean;
  };
};

const defaultWait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted || ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

export function createProgressiveSpeechQueue(
  deps: ProgressiveSpeechDeps,
  opts: ProgressiveSpeechOptions = {},
): ProgressiveSpeechQueue {
  const maxConcurrent = Math.max(1, opts.maxConcurrent ?? 2);
  const maxQueued = Math.max(1, opts.maxQueued ?? 6);
  const maxChunkChars = Math.max(1, opts.maxChunkChars ?? 400);
  const wait = deps.wait ?? defaultWait;
  const controller = new AbortController();
  const chunks: Chunk[] = [];
  /** Sentences waiting for a free chunk slot, in order. */
  let overflow: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let playing = false;
  let played = 0;
  let closed = false;
  let aborted = false;
  let startedPlayback = false;
  let settle!: (outcome: "completed" | "aborted") => void;
  let isSettled = false;
  const settled = new Promise<"completed" | "aborted">((resolve) => {
    settle = (outcome) => {
      if (isSettled) return;
      isSettled = true;
      opts.onSettled?.(outcome);
      resolve(outcome);
    };
  });

  const live = () => !aborted && deps.isCurrent();
  const pendingCount = () => chunks.filter((c) => c.state !== "done").length;

  const releaseAudio = (chunk: Chunk) => {
    if (chunk.audio?.kind === "audio") deps.revoke(chunk.audio.url);
    chunk.audio = undefined;
  };

  const abort = () => {
    if (aborted) return;
    aborted = true;
    controller.abort();
    for (const chunk of chunks) {
      // The playing chunk's URL is revoked when its play() settles.
      if (chunk.state === "ready") releaseAudio(chunk);
      if (chunk.state !== "playing") chunk.state = "done";
    }
    overflow = [];
    settle("aborted");
  };

  const pushChunk = (text: string) => {
    chunks.push({ index: chunks.length, text, state: "waiting" });
  };

  const synthesize = (chunk: Chunk) => {
    chunk.state = "synthesizing";
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    deps
      .synthesize(chunk.text, controller.signal)
      .catch((): SpeechChunkAudio => ({ kind: "browser" }))
      .then((audio) => {
        inFlight -= 1;
        if (!live()) {
          if (audio.kind === "audio") deps.revoke(audio.url);
          return;
        }
        chunk.audio = audio;
        chunk.state = "ready";
        pump();
      });
  };

  const playChunk = async (chunk: Chunk) => {
    playing = true;
    chunk.state = "playing";
    try {
      if (!startedPlayback && (opts.pauseBeforeMs ?? 0) > 0) {
        await wait(Math.min(6000, opts.pauseBeforeMs ?? 0), controller.signal);
      }
      if (live() && chunk.audio) {
        if (!startedPlayback) {
          startedPlayback = true;
          opts.onPlaybackStart?.();
        }
        await deps.play(chunk.audio, chunk.text, controller.signal);
      }
    } catch {
      /* a failed chunk must not stall the queue */
    } finally {
      releaseAudio(chunk);
      chunk.state = "done";
      played += 1;
      playing = false;
      pump();
    }
  };

  function pump() {
    if (!live()) {
      if (!aborted) abort();
      return;
    }
    while (overflow.length > 0 && pendingCount() < maxQueued) {
      // Pack as many held sentences as fit one chunk; always at least one.
      let text = overflow.shift()!;
      while (
        overflow.length > 0 &&
        text.length + 1 + overflow[0]!.length <= maxChunkChars
      ) {
        text = `${text} ${overflow.shift()!}`;
      }
      pushChunk(text);
    }
    for (const chunk of chunks) {
      if (inFlight >= maxConcurrent) break;
      if (chunk.state === "waiting") synthesize(chunk);
    }
    if (!playing) {
      const next = chunks.find((c) => c.state !== "done");
      if (next?.state === "ready") void playChunk(next);
    }
    if (closed && !playing && overflow.length === 0 && pendingCount() === 0) {
      settle("completed");
    }
  }

  return {
    enqueue(text) {
      const t = text.trim();
      if (!t || closed || !live()) return false;
      if (overflow.length === 0 && pendingCount() < maxQueued) {
        pushChunk(t);
      } else {
        // Waiting chunks are always a suffix (synthesis starts in order), so
        // the last chunk is the only one text may be appended to in order.
        const last = chunks[chunks.length - 1];
        if (
          overflow.length === 0 &&
          last?.state === "waiting" &&
          last.text.length + 1 + t.length <= maxChunkChars
        ) {
          last.text = `${last.text} ${t}`;
        } else {
          overflow.push(t);
        }
      }
      pump();
      return true;
    },
    close() {
      if (closed) return;
      closed = true;
      pump();
    },
    abort,
    settled,
    stats: () => ({
      chunks: chunks.length,
      pending: pendingCount(),
      inFlight,
      maxInFlight,
      played,
      aborted,
    }),
  };
}

/**
 * Browser wiring: ElevenLabs via /api/voice/tts (progressive budget), browser
 * speech synthesis for a chunk whose TTS failed, and an <audio> element per
 * chunk tracked in `audioRef` so the classic `stopPlayback` also silences it.
 */
export function browserSpeechChunkDeps(params: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
  stability?: number | null;
  style?: number | null;
  audioRef: { current: HTMLAudioElement | null };
  isCurrent: () => boolean;
}): ProgressiveSpeechDeps {
  return {
    isCurrent: params.isCurrent,
    revoke: (url) => URL.revokeObjectURL(url),
    async synthesize(text, signal) {
      const result = await synthesizeSpeech({
        text,
        locale: params.locale,
        voiceId: params.voiceId,
        voiceIdAr: params.voiceIdAr,
        voiceProfileId: params.voiceProfileId,
        avatarId: params.avatarId,
        speechPace: params.speechPace,
        speechEnergy: params.speechEnergy,
        disorderSlug: params.disorderSlug,
        stability: params.stability,
        style: params.style,
        progressive: true,
        signal,
      });
      if (result.mode === "elevenlabs" && result.objectUrl) {
        return { kind: "audio", url: result.objectUrl };
      }
      return { kind: "browser" };
    },
    play(audio, text, signal) {
      return new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          signal.removeEventListener("abort", onAbort);
          if (el && params.audioRef.current === el) {
            params.audioRef.current = null;
          }
          resolve();
        };
        let el: HTMLAudioElement | null = null;
        const onAbort = () => {
          if (el) {
            try {
              el.pause();
              el.removeAttribute("src");
              el.load();
            } catch {
              /* ignore */
            }
          } else {
            window.speechSynthesis?.cancel();
          }
          finish();
        };
        signal.addEventListener("abort", onAbort, { once: true });

        if (audio.kind === "browser") {
          speakWithBrowser(
            text,
            params.locale,
            { onend: finish, onerror: finish },
            params.speechPace,
          );
          return;
        }
        el = new Audio(audio.url);
        params.audioRef.current = el;
        el.onended = finish;
        el.onerror = finish;
        void el.play().catch(finish);
      });
    },
  };
}
