/**
 * Progressive patient audio — start playing ElevenLabs speech while the rest
 * of the clip is still being synthesized.
 *
 * The TTS route already streams audio/mpeg from ElevenLabs, but the client
 * used to wait for the whole body before playing, so the trainee heard
 * nothing until the last sentence was synthesized. Here the response body is
 * fed into a MediaSource as it arrives; the <audio> element starts on the
 * first chunk. The bytes are the same single request, so voice, settings and
 * Arabic pronunciation are unchanged.
 *
 * Only used where the browser's MediaSource can play audio/mpeg (Chrome,
 * Edge, Firefox, desktop Safari). Everywhere else, or with
 * NEXT_PUBLIC_VOICE_STREAM_PLAYBACK=false, the whole clip is downloaded first
 * as before. The bytes are also kept, so a MediaSource failure can still play
 * the complete clip instead of dropping to the browser voice.
 */

export const STREAM_AUDIO_MIME = "audio/mpeg";

/** Minimal MediaSource surface used here (real one in browsers, fake in tests). */
export type MediaSourceLike = {
  readyState: string;
  addSourceBuffer(mime: string): SourceBufferLike;
  endOfStream(error?: "decode" | "network"): void;
  addEventListener(type: "sourceopen", cb: () => void, opts?: { once?: boolean }): void;
};

export type SourceBufferLike = {
  updating: boolean;
  appendBuffer(data: Uint8Array<ArrayBuffer>): void;
  addEventListener(type: "updateend" | "error", cb: () => void): void;
  removeEventListener(type: "updateend" | "error", cb: () => void): void;
};

/** Live state of one streamed clip, read by the player and its watchdog. */
export type AudioStreamHandle = {
  /** performance.now() of the last chunk received (0 before the first). */
  lastDataAt(): number;
  /** True once every byte has been appended and the stream was closed. */
  isComplete(): boolean;
  /** True when the MediaSource path failed (decode / append error). */
  failed(): boolean;
  /** Resolves with the complete clip once the body has been read. */
  fullClip: Promise<Blob | null>;
  /** Stop reading (barge-in / stale turn). Safe to call more than once. */
  cancel(): void;
};

/** Is progressive playback available and enabled in this browser? */
export function canStreamPatientAudio(
  env: {
    flag?: string;
    mediaSource?: { isTypeSupported?: (mime: string) => boolean } | null;
  } = {
    flag: process.env.NEXT_PUBLIC_VOICE_STREAM_PLAYBACK,
    mediaSource:
      typeof window !== "undefined" && "MediaSource" in window
        ? window.MediaSource
        : null,
  },
): boolean {
  if (env.flag?.trim().toLowerCase() === "false") return false;
  const ms = env.mediaSource;
  if (!ms || typeof ms.isTypeSupported !== "function") return false;
  try {
    return ms.isTypeSupported(STREAM_AUDIO_MIME);
  } catch {
    return false;
  }
}

function appendOnce(sb: SourceBufferLike, chunk: Uint8Array<ArrayBuffer>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      sb.removeEventListener("updateend", done);
      sb.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      sb.removeEventListener("updateend", done);
      sb.removeEventListener("error", fail);
      reject(new Error("append_failed"));
    };
    sb.addEventListener("updateend", done);
    sb.addEventListener("error", fail);
    try {
      sb.appendBuffer(chunk);
    } catch (err) {
      sb.removeEventListener("updateend", done);
      sb.removeEventListener("error", fail);
      reject(err instanceof Error ? err : new Error("append_failed"));
    }
  });
}

/**
 * Pipe a streamed audio body into `mediaSource`. Appends start once the
 * MediaSource opens (when an <audio> element is pointed at it). Every chunk is
 * kept so `fullClip` can replay the whole clip if MediaSource fails.
 */
export function pumpAudioStream(params: {
  body: ReadableStream<Uint8Array<ArrayBuffer>>;
  mediaSource: MediaSourceLike;
  mime?: string;
  now?: () => number;
}): AudioStreamHandle {
  const mime = params.mime ?? STREAM_AUDIO_MIME;
  const now = params.now ?? (() => performance.now());
  const reader = params.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let lastDataAt = 0;
  let complete = false;
  let failed = false;
  let cancelled = false;

  // The MediaSource side: appends wait for "sourceopen" and run strictly in
  // order. A failure here stops appending but never stops reading — the
  // complete clip is still collected for the blob fallback.
  let sourceBuffer: SourceBufferLike | null = null;
  let appendChain: Promise<void> = new Promise<void>((resolve) => {
    if (params.mediaSource.readyState === "open") resolve();
    else params.mediaSource.addEventListener("sourceopen", () => resolve(), { once: true });
  }).then(() => {
    if (cancelled) return;
    sourceBuffer = params.mediaSource.addSourceBuffer(mime);
  });
  const markFailed = () => {
    if (failed || cancelled) return;
    failed = true;
    try {
      if (params.mediaSource.readyState === "open") {
        params.mediaSource.endOfStream("decode");
      }
    } catch {
      /* ignore */
    }
  };
  appendChain = appendChain.catch(markFailed);
  const enqueue = (chunk: Uint8Array<ArrayBuffer>) => {
    appendChain = appendChain.then(async () => {
      if (failed || cancelled || !sourceBuffer) return;
      try {
        await appendOnce(sourceBuffer, chunk);
      } catch {
        markFailed();
      }
    });
  };

  const fullClip = (async (): Promise<Blob | null> => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelled) return null;
        if (value && value.byteLength > 0) {
          chunks.push(value);
          lastDataAt = now();
          enqueue(value);
        }
      }
    } catch {
      if (cancelled) return null;
      // Network cut mid-clip: play what arrived; the blob below is partial.
    }
    if (cancelled) return null;
    await appendChain;
    if (!failed && !cancelled) {
      try {
        if (params.mediaSource.readyState === "open") {
          params.mediaSource.endOfStream();
        }
      } catch {
        /* ignore */
      }
    }
    complete = true;
    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: mime });
  })();

  return {
    lastDataAt: () => lastDataAt,
    isComplete: () => complete,
    failed: () => failed,
    fullClip,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      void reader.cancel().catch(() => undefined);
    },
  };
}
