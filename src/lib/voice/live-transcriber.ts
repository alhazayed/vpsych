/**
 * Live transcriber (browser): one transcription-only OpenAI Realtime socket
 * per Therapy Room, fed with the therapist's microphone frames while a
 * capture is open. See live-transcript-protocol.ts for the protocol.
 *
 * Never on the critical path for correctness: if the socket is not open, a
 * segment fails or is slow, `transcribe()` returns `null` and the caller uses
 * the classic /api/voice/transcribe upload of the same audio.
 */

import {
  bytesToBase64,
  createSegmentTracker,
  liveTranscriptProtocols,
  parseLiveTranscriptEvent,
  toPcm16At24k,
  type SegmentTracker,
} from "@/lib/voice/live-transcript-protocol";

export type LiveTranscriber = {
  /** New capture: drop buffered audio and earlier segments. */
  startCapture: () => void;
  /** A microphone frame of the open capture. */
  pushFrame: (samples: Float32Array, sampleRate: number) => void;
  /**
   * Commit the audio since the last commit and resolve with the whole
   * capture's transcript, or null when live transcription can't provide it
   * (the caller falls back to uploading the audio).
   */
  transcribe: () => Promise<{ transcript: string; ms: number } | null>;
  close: () => void;
};

type SocketLike = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  addEventListener: (type: string, fn: (event: { data?: unknown }) => void) => void;
};

export type LiveTranscriberOptions = {
  locale: string;
  /** POST /api/voice/live-transcript (injectable for tests). */
  fetchToken?: (locale: string) => Promise<{ clientSecret: string; url: string } | null>;
  openSocket?: (url: string, protocols: string[]) => SocketLike;
  now?: () => number;
  /** Per-transcribe wait before falling back. */
  timeoutMs?: number;
  onEvent?: (event: string, facts?: Record<string, string | number>) => void;
};

const OPEN = 1;
/** Audio kept while the socket connects (24 kHz pcm16 ≈ 48 KB/s). */
const MAX_PENDING_CHUNKS = 400;
/** Stop asking for tokens after this many failed connections. */
const MAX_CONNECT_FAILURES = 3;

async function defaultFetchToken(locale: string) {
  const res = await fetch("/api/voice/live-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    clientSecret?: unknown;
    url?: unknown;
  } | null;
  if (typeof data?.clientSecret !== "string" || typeof data.url !== "string") {
    return null;
  }
  return { clientSecret: data.clientSecret, url: data.url };
}

export function createLiveTranscriber(opts: LiveTranscriberOptions): LiveTranscriber {
  const fetchToken = opts.fetchToken ?? defaultFetchToken;
  const openSocket =
    opts.openSocket ?? ((url, protocols) => new WebSocket(url, protocols) as SocketLike);
  const now = opts.now ?? (() => performance.now());
  const timeoutMs = opts.timeoutMs ?? 8000;
  const emit = (event: string, facts?: Record<string, string | number>) => {
    try {
      opts.onEvent?.(event, facts);
    } catch {
      /* telemetry never breaks the turn */
    }
  };

  let socket: SocketLike | null = null;
  let connecting = false;
  let closed = false;
  let disabled = false;
  let failures = 0;
  let pending: string[] = [];
  let tracker: SegmentTracker = createSegmentTracker();
  /** Audio was appended since the last commit. */
  let dirty = false;
  /** The open capture lost audio (socket dropped / overflow): don't use it. */
  let captureBroken = false;
  let seq = 0;

  const send = (event: Record<string, unknown>) => {
    socket?.send(JSON.stringify(event));
  };

  const connect = async () => {
    if (closed || disabled || connecting || socket) return;
    connecting = true;
    try {
      const token = await fetchToken(opts.locale);
      if (!token) {
        // Off (404) or not configured: classic STT for this room.
        disabled = true;
        emit("live_stt_unavailable");
        return;
      }
      if (closed) return;
      const ws = openSocket(token.url, liveTranscriptProtocols(token.clientSecret));
      socket = ws;
      ws.addEventListener("open", () => {
        failures = 0;
        emit("live_stt_open");
        for (const chunk of pending) send({ type: "input_audio_buffer.append", audio: chunk });
        pending = [];
      });
      ws.addEventListener("message", (event) => {
        const parsed = parseLiveTranscriptEvent(event.data);
        if (parsed) tracker.handle(parsed);
      });
      const lost = () => {
        if (socket !== ws) return;
        socket = null;
        captureBroken = true;
        tracker.failAll("socket_closed");
        if (!closed) {
          failures += 1;
          if (failures >= MAX_CONNECT_FAILURES) disabled = true;
          emit("live_stt_closed", { failures });
        }
      };
      ws.addEventListener("close", lost);
      ws.addEventListener("error", lost);
    } catch {
      failures += 1;
      if (failures >= MAX_CONNECT_FAILURES) disabled = true;
    } finally {
      connecting = false;
    }
  };

  return {
    startCapture() {
      if (closed) return;
      tracker.failAll("superseded");
      tracker = createSegmentTracker();
      pending = [];
      dirty = false;
      captureBroken = false;
      if (socket?.readyState === OPEN) send({ type: "input_audio_buffer.clear" });
      else void connect();
    },

    pushFrame(samples, sampleRate) {
      if (closed || disabled || captureBroken) return;
      const chunk = bytesToBase64(toPcm16At24k(samples, sampleRate));
      if (!chunk) return;
      dirty = true;
      if (socket?.readyState === OPEN) {
        send({ type: "input_audio_buffer.append", audio: chunk });
      } else if (pending.length < MAX_PENDING_CHUNKS) {
        pending.push(chunk);
      } else {
        captureBroken = true;
      }
    },

    async transcribe() {
      if (closed || disabled || captureBroken || socket?.readyState !== OPEN) {
        return null;
      }
      const started = now();
      if (dirty) {
        const eventId = `vp_commit_${++seq}`;
        tracker.add(eventId);
        send({ type: "input_audio_buffer.commit", event_id: eventId });
        dirty = false;
      }
      if (tracker.size() === 0) return null;
      const mine = tracker;
      const result = await Promise.race([
        mine.transcript(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (!result || !result.ok || mine !== tracker) {
        // Don't reuse a capture whose segments are late or lost.
        if (mine === tracker) captureBroken = true;
        emit("live_stt_fallback", {
          reason: !result ? "timeout" : !result.ok ? result.reason : "superseded",
        });
        return null;
      }
      const ms = Math.round(now() - started);
      return { transcript: result.text, ms };
    },

    close() {
      closed = true;
      tracker.failAll("closed");
      pending = [];
      const ws = socket;
      socket = null;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    },
  };
}

export type HedgedTranscript<T> =
  | { source: "live"; transcript: string; ms: number }
  | { source: "upload"; result: T };

/**
 * Live transcript with the upload as a hedge: if the live result is not back
 * after `hedgeAfterMs` (or live is unavailable), the classic upload starts
 * too, and the first usable answer wins. A slow socket therefore costs at
 * most `hedgeAfterMs` over the old path, never a full live timeout.
 */
export async function hedgedTranscribe<T extends { ok: boolean }>(params: {
  live: Promise<{ transcript: string; ms: number } | null> | null;
  upload: () => Promise<T>;
  hedgeAfterMs: number;
}): Promise<HedgedTranscript<T>> {
  const { live } = params;
  if (!live) return { source: "upload", result: await params.upload() };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<"slow">((resolve) => {
    timer = setTimeout(() => resolve("slow"), params.hedgeAfterMs);
  });
  const first = await Promise.race([live, slow]);
  clearTimeout(timer);
  if (first && first !== "slow") {
    return { source: "live", transcript: first.transcript, ms: first.ms };
  }
  if (first === null) return { source: "upload", result: await params.upload() };

  // Slow: start the upload and take whichever usable answer comes first.
  const upload = params.upload();
  type Answer = HedgedTranscript<T> | null;
  const liveWins: Promise<Answer> = live.then((r) =>
    r ? { source: "live", transcript: r.transcript, ms: r.ms } : null,
  );
  const uploadWins: Promise<Answer> = upload.then((r) =>
    r.ok ? { source: "upload", result: r } : null,
  );
  const winner = await Promise.race<Answer>([
    liveWins.then((r) => r ?? uploadWins),
    uploadWins.then((r) => r ?? liveWins),
  ]);
  return winner ?? { source: "upload", result: await upload };
}
