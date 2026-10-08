import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bytesToBase64,
  createSegmentTracker,
  liveTranscriptProtocols,
  LIVE_TRANSCRIPT_WS_URL,
  parseLiveTranscriptEvent,
  toPcm16At24k,
} from "@/lib/voice/live-transcript-protocol";
import { createLiveTranscriber, hedgedTranscribe } from "@/lib/voice/live-transcriber";

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

describe("live transcript protocol", () => {
  it("connects to the transcription intent with the ephemeral key as a subprotocol", () => {
    expect(LIVE_TRANSCRIPT_WS_URL).toBe("wss://api.openai.com/v1/realtime?intent=transcription");
    expect(liveTranscriptProtocols("ek_abc")).toEqual(["realtime", "openai-insecure-api-key.ek_abc"]);
  });

  it("converts 48 kHz float frames to 24 kHz little-endian pcm16", () => {
    const pcm = toPcm16At24k(new Float32Array([1, 1, -1, -1, 0, 0.5]), 48000);
    expect(pcm.length).toBe(6); // 3 samples × 2 bytes
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(0x7fff);
    expect(view.getInt16(2, true)).toBe(-0x8000);
    expect(view.getInt16(4, true)).toBe(Math.trunc(0.25 * 0x7fff));
  });

  it("upsamples 16 kHz input and base64-encodes", () => {
    const pcm = toPcm16At24k(new Float32Array(160), 16000);
    expect(pcm.length).toBe(240 * 2);
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe("aGk=");
  });

  it("parses only the events it acts on", () => {
    expect(parseLiveTranscriptEvent('{"type":"input_audio_buffer.committed","item_id":"i1"}')).toEqual({
      type: "input_audio_buffer.committed",
      item_id: "i1",
    });
    expect(
      parseLiveTranscriptEvent({
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "i1",
        transcript: " مرحبا ",
      }),
    ).toMatchObject({ transcript: " مرحبا " });
    expect(parseLiveTranscriptEvent('{"type":"session.created"}')).toBeNull();
    expect(parseLiveTranscriptEvent("not json")).toBeNull();
  });

  it("joins a capture's segments in commit order, whatever order transcripts arrive", async () => {
    const t = createSegmentTracker();
    t.add("c1");
    t.handle({ type: "input_audio_buffer.committed", item_id: "a" });
    t.add("c2");
    t.handle({ type: "input_audio_buffer.committed", item_id: "b" });
    t.handle({ type: "conversation.item.input_audio_transcription.completed", item_id: "b", transcript: "sleeping lately?" });
    t.handle({ type: "conversation.item.input_audio_transcription.completed", item_id: "a", transcript: "How have you been" });
    await expect(t.transcript()).resolves.toEqual({ ok: true, text: "How have you been sleeping lately?" });
  });

  it("treats an empty commit as an empty segment, other errors as failure", async () => {
    const t = createSegmentTracker();
    t.add("c1");
    t.handle({ type: "error", error: { code: "input_audio_buffer_commit_empty", event_id: "c1" } });
    await expect(t.transcript()).resolves.toEqual({ ok: true, text: "" });
    t.add("c2");
    t.handle({ type: "error", error: { code: "server_error", event_id: "c2" } });
    await expect(t.transcript()).resolves.toMatchObject({ ok: false });
  });
});

class FakeSocket {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  listeners: Record<string, Array<(e: { data?: unknown }) => void>> = {};
  constructor(
    public url: string,
    public protocols: string[],
  ) {}
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    this.readyState = 3;
  }
  addEventListener(type: string, fn: (e: { data?: unknown }) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  fire(type: string, data?: unknown) {
    if (type === "open") this.readyState = 1;
    for (const fn of this.listeners[type] ?? []) fn({ data: data === undefined ? undefined : JSON.stringify(data) });
  }
  ofType(type: string) {
    return this.sent.filter((e) => e.type === type);
  }
}

function setup(token: { clientSecret: string; url: string } | null = { clientSecret: "ek_1", url: LIVE_TRANSCRIPT_WS_URL }) {
  const sockets: FakeSocket[] = [];
  const fetchToken = vi.fn(async () => token);
  const lt = createLiveTranscriber({
    locale: "ar",
    fetchToken,
    openSocket: (url, protocols) => {
      const s = new FakeSocket(url, protocols);
      sockets.push(s);
      return s;
    },
    timeoutMs: 50,
  });
  return { lt, sockets, fetchToken };
}

const frame = () => new Float32Array(4096).fill(0.1);

describe("live transcriber", () => {
  afterEach(() => vi.useRealTimers());

  it("streams frames, buffering them until the socket opens", async () => {
    const { lt, sockets, fetchToken } = setup();
    lt.startCapture();
    lt.pushFrame(frame(), 48000);
    await flush();
    expect(fetchToken).toHaveBeenCalledWith("ar");
    const ws = sockets[0]!;
    expect(ws.protocols).toEqual(["realtime", "openai-insecure-api-key.ek_1"]);
    expect(ws.ofType("input_audio_buffer.append")).toHaveLength(0);
    ws.fire("open");
    lt.pushFrame(frame(), 48000);
    expect(ws.ofType("input_audio_buffer.append")).toHaveLength(2);
  });

  it("commits at a pause and returns the transcript of every segment so far", async () => {
    const { lt, sockets } = setup();
    lt.startCapture();
    await flush();
    const ws = sockets[0]!;
    ws.fire("open");
    lt.pushFrame(frame(), 48000);

    const first = lt.transcribe();
    const c1 = ws.ofType("input_audio_buffer.commit")[0]!;
    ws.fire("message", { type: "input_audio_buffer.committed", item_id: "a" });
    ws.fire("message", { type: "conversation.item.input_audio_transcription.completed", item_id: "a", transcript: "أنا من فترة" });
    await expect(first).resolves.toMatchObject({ transcript: "أنا من فترة" });
    expect(c1.event_id).toBeTruthy();

    // Therapist resumed; the next pause commits only the new audio.
    lt.pushFrame(frame(), 48000);
    const second = lt.transcribe();
    expect(ws.ofType("input_audio_buffer.commit")).toHaveLength(2);
    ws.fire("message", { type: "input_audio_buffer.committed", item_id: "b" });
    ws.fire("message", { type: "conversation.item.input_audio_transcription.completed", item_id: "b", transcript: "ما بنام منيح." });
    await expect(second).resolves.toMatchObject({ transcript: "أنا من فترة ما بنام منيح." });
  });

  it("a new capture clears the server buffer and forgets old segments", async () => {
    const { lt, sockets } = setup();
    lt.startCapture();
    await flush();
    const ws = sockets[0]!;
    ws.fire("open");
    lt.pushFrame(frame(), 48000);
    void lt.transcribe();
    ws.fire("message", { type: "input_audio_buffer.committed", item_id: "a" });
    lt.startCapture();
    expect(ws.ofType("input_audio_buffer.clear")).toHaveLength(1);
    lt.pushFrame(frame(), 48000);
    const next = lt.transcribe();
    ws.fire("message", { type: "conversation.item.input_audio_transcription.completed", item_id: "a", transcript: "old" });
    ws.fire("message", { type: "input_audio_buffer.committed", item_id: "c" });
    ws.fire("message", { type: "conversation.item.input_audio_transcription.completed", item_id: "c", transcript: "new" });
    await expect(next).resolves.toMatchObject({ transcript: "new" });
  });

  it("returns null (fallback) when the socket is not open, a segment is late, or the socket drops", async () => {
    const { lt, sockets } = setup();
    lt.startCapture();
    lt.pushFrame(frame(), 48000);
    await expect(lt.transcribe()).resolves.toBeNull(); // still connecting
    await flush();
    const ws = sockets[0]!;
    ws.fire("open");
    lt.startCapture();
    lt.pushFrame(frame(), 48000);
    await expect(lt.transcribe()).resolves.toBeNull(); // no transcript within timeout
    lt.startCapture();
    lt.pushFrame(frame(), 48000);
    const dropped = lt.transcribe();
    ws.fire("close");
    await expect(dropped).resolves.toBeNull();
  });

  it("stays on the upload path when the token route is off", async () => {
    const { lt, sockets } = setup(null);
    lt.startCapture();
    await flush();
    lt.pushFrame(frame(), 48000);
    expect(sockets).toHaveLength(0);
    await expect(lt.transcribe()).resolves.toBeNull();
  });
});

describe("hedged transcription", () => {
  const upload = (text: string, ok = true, ms = 0) => () =>
    new Promise<{ ok: boolean; transcript: string }>((r) => setTimeout(() => r({ ok, transcript: text }), ms));

  it("uses the live transcript when it is quick, without uploading", async () => {
    const up = vi.fn(upload("upload"));
    const r = await hedgedTranscribe({ live: Promise.resolve({ transcript: "live", ms: 300 }), upload: up, hedgeAfterMs: 50 });
    expect(r).toEqual({ source: "live", transcript: "live", ms: 300 });
    expect(up).not.toHaveBeenCalled();
  });

  it("uploads right away when live is unavailable", async () => {
    const r = await hedgedTranscribe({ live: Promise.resolve(null), upload: upload("upload"), hedgeAfterMs: 1000 });
    expect(r).toEqual({ source: "upload", result: { ok: true, transcript: "upload" } });
  });

  it("starts the upload when live is slow and takes the first usable answer", async () => {
    const slowLive = new Promise<{ transcript: string; ms: number }>((r) => setTimeout(() => r({ transcript: "live", ms: 400 }), 200));
    const fastUpload = await hedgedTranscribe({ live: slowLive, upload: upload("upload", true, 10), hedgeAfterMs: 20 });
    expect(fastUpload.source).toBe("upload");

    const liveSoon = new Promise<{ transcript: string; ms: number }>((r) => setTimeout(() => r({ transcript: "live", ms: 60 }), 40));
    const r = await hedgedTranscribe({ live: liveSoon, upload: upload("upload", false, 5), hedgeAfterMs: 20 });
    expect(r).toEqual({ source: "live", transcript: "live", ms: 60 });
  });
});
