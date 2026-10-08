/**
 * Live transcript — pure pieces of the OpenAI Realtime transcription protocol
 * (no sockets, no timers), so they are unit-tested in node.
 *
 * The Therapy Room streams the therapist's microphone audio into a
 * transcription-only Realtime session while they speak. At each pause the
 * buffered audio is committed; OpenAI transcribes just that stretch and
 * replies with `…input_audio_transcription.completed`. A capture's transcript
 * is its committed segments joined in order, so at the final pause only the
 * last few words still need transcribing. Same STT model as
 * /api/voice/transcribe, which stays the fallback.
 */

/** Browser WebSocket endpoint for transcription-only Realtime sessions. */
export const LIVE_TRANSCRIPT_WS_URL =
  "wss://api.openai.com/v1/realtime?intent=transcription";

/** Server switch: `VOICE_LIVE_TRANSCRIPT=false` turns the token route off. */
export function isLiveTranscriptEnabled(): boolean {
  return process.env.VOICE_LIVE_TRANSCRIPT?.trim().toLowerCase() !== "false";
}

/** Sample rate the session's `audio/pcm` input format requires. */
export const LIVE_TRANSCRIPT_SAMPLE_RATE = 24000;

/** WebSocket subprotocols carrying the ephemeral `ek_…` credential. */
export function liveTranscriptProtocols(clientSecret: string): string[] {
  return ["realtime", `openai-insecure-api-key.${clientSecret}`];
}

/**
 * Float32 mono frames at `fromRate` → 16-bit little-endian PCM at 24 kHz.
 * Box-averages when downsampling (48 kHz → 24 kHz averages pairs), linear
 * interpolation otherwise.
 */
export function toPcm16At24k(samples: Float32Array, fromRate: number): Uint8Array {
  const ratio = fromRate / LIVE_TRANSCRIPT_SAMPLE_RATE;
  const outLen = Math.max(0, Math.floor(samples.length / ratio));
  const out = new Uint8Array(outLen * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < outLen; i++) {
    let v: number;
    if (ratio >= 1) {
      const start = Math.floor(i * ratio);
      const end = Math.max(start + 1, Math.min(samples.length, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += samples[j] ?? 0;
      v = sum / (end - start);
    } else {
      const pos = i * ratio;
      const j = Math.floor(pos);
      const frac = pos - j;
      const a = samples[j] ?? 0;
      const b = samples[j + 1] ?? a;
      v = a + (b - a) * frac;
    }
    const s = Math.max(-1, Math.min(1, v));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/** Server events this client acts on; everything else is ignored. */
export type LiveTranscriptServerEvent =
  | { type: "input_audio_buffer.committed"; item_id: string }
  | {
      type: "conversation.item.input_audio_transcription.completed";
      item_id: string;
      transcript: string;
    }
  | {
      type: "conversation.item.input_audio_transcription.failed";
      item_id: string;
    }
  | {
      type: "error";
      error?: { code?: string | null; event_id?: string | null };
    };

export function parseLiveTranscriptEvent(raw: unknown): LiveTranscriptServerEvent | null {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const e = data as Record<string, unknown>;
  switch (e.type) {
    case "input_audio_buffer.committed":
    case "conversation.item.input_audio_transcription.failed":
      return typeof e.item_id === "string"
        ? ({ type: e.type, item_id: e.item_id } as LiveTranscriptServerEvent)
        : null;
    case "conversation.item.input_audio_transcription.completed":
      return typeof e.item_id === "string"
        ? {
            type: e.type,
            item_id: e.item_id,
            transcript: typeof e.transcript === "string" ? e.transcript : "",
          }
        : null;
    case "error": {
      const err = (e.error ?? {}) as Record<string, unknown>;
      return {
        type: "error",
        error: {
          code: typeof err.code === "string" ? err.code : null,
          event_id: typeof err.event_id === "string" ? err.event_id : null,
        },
      };
    }
    default:
      return null;
  }
}

export type SegmentResult = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Segments of ONE capture, in commit order. A commit is sent with an
 * `event_id`; OpenAI answers `committed` (in order) with the item id, then the
 * transcript for that item. An empty buffer is answered by an `error` naming
 * the commit's event id — that segment is simply empty.
 */
export function createSegmentTracker() {
  type Segment = {
    eventId: string;
    itemId: string | null;
    result: SegmentResult | null;
    waiters: Array<(r: SegmentResult) => void>;
  };
  const segments: Segment[] = [];

  const settle = (seg: Segment, result: SegmentResult) => {
    if (seg.result) return;
    seg.result = result;
    for (const w of seg.waiters.splice(0)) w(result);
  };

  return {
    /** Registers a commit about to be sent. */
    add(eventId: string) {
      segments.push({ eventId, itemId: null, result: null, waiters: [] });
    },
    handle(event: LiveTranscriptServerEvent) {
      if (event.type === "input_audio_buffer.committed") {
        const seg = segments.find((s) => s.itemId == null && !s.result);
        if (seg) seg.itemId = event.item_id;
        return;
      }
      if (event.type === "error") {
        const seg = segments.find((s) => s.eventId === event.error?.event_id);
        if (!seg) return;
        if (event.error?.code === "input_audio_buffer_commit_empty") {
          settle(seg, { ok: true, text: "" });
        } else {
          settle(seg, { ok: false, reason: event.error?.code ?? "error" });
        }
        return;
      }
      const seg = segments.find((s) => s.itemId === event.item_id);
      if (!seg) return;
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        settle(seg, { ok: true, text: event.transcript.trim() });
      } else {
        settle(seg, { ok: false, reason: "transcription_failed" });
      }
    },
    /** All segments so far, joined; fails if any segment failed. */
    transcript(): Promise<SegmentResult> {
      const waits = segments.map(
        (seg) =>
          new Promise<SegmentResult>((resolve) => {
            if (seg.result) resolve(seg.result);
            else seg.waiters.push(resolve);
          }),
      );
      return Promise.all(waits).then((results) => {
        const failed = results.find((r) => !r.ok);
        if (failed) return failed;
        const text = results
          .map((r) => (r.ok ? r.text : ""))
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return { ok: true, text };
      });
    },
    /** Fails every unfinished segment (socket lost). */
    failAll(reason: string) {
      for (const seg of segments) settle(seg, { ok: false, reason });
    },
    size: () => segments.length,
  };
}

export type SegmentTracker = ReturnType<typeof createSegmentTracker>;
