import { describe, expect, it } from "vitest";
import {
  canStreamPatientAudio,
  pumpAudioStream,
  type MediaSourceLike,
  type SourceBufferLike,
} from "@/lib/voice/stream-playback";

type Listener = () => void;

function fakeSourceBuffer(opts: { failOnAppend?: number } = {}) {
  const listeners: Record<string, Set<Listener>> = {
    updateend: new Set(),
    error: new Set(),
  };
  const appended: number[][] = [];
  let calls = 0;
  const sb: SourceBufferLike = {
    updating: false,
    appendBuffer(data) {
      calls += 1;
      const n = calls;
      appended.push(Array.from(data));
      queueMicrotask(() => {
        const type = opts.failOnAppend === n ? "error" : "updateend";
        for (const cb of [...listeners[type]!]) cb();
      });
    },
    addEventListener(type, cb) {
      listeners[type]!.add(cb);
    },
    removeEventListener(type, cb) {
      listeners[type]!.delete(cb);
    },
  };
  return { sb, appended };
}

function fakeMediaSource(sb: SourceBufferLike, open = false) {
  let onOpen: Listener | null = null;
  const ended: Array<string | undefined> = [];
  const ms: MediaSourceLike & { open(): void; ended: typeof ended } = {
    readyState: open ? "open" : "closed",
    addSourceBuffer: () => sb,
    endOfStream(error) {
      ended.push(error);
      ms.readyState = "ended";
    },
    addEventListener(_type, cb) {
      onOpen = cb;
    },
    open() {
      ms.readyState = "open";
      onOpen?.();
    },
    ended,
  };
  return ms;
}

function bodyOf(chunks: number[][]): ReadableStream<Uint8Array<ArrayBuffer>> {
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      for (const c of chunks) controller.enqueue(new Uint8Array(c));
      controller.close();
    },
  });
}

describe("canStreamPatientAudio", () => {
  it("uses MediaSource when it can play audio/mpeg", () => {
    expect(
      canStreamPatientAudio({
        mediaSource: { isTypeSupported: (m) => m === "audio/mpeg" },
      }),
    ).toBe(true);
  });

  it("falls back to the whole-clip download otherwise", () => {
    expect(canStreamPatientAudio({ mediaSource: null })).toBe(false);
    expect(
      canStreamPatientAudio({ mediaSource: { isTypeSupported: () => false } }),
    ).toBe(false);
  });

  it("can be switched off with NEXT_PUBLIC_VOICE_STREAM_PLAYBACK=false", () => {
    expect(
      canStreamPatientAudio({
        flag: "false",
        mediaSource: { isTypeSupported: () => true },
      }),
    ).toBe(false);
  });
});

describe("pumpAudioStream", () => {
  it("appends every chunk in order once the source opens, then ends the stream", async () => {
    const { sb, appended } = fakeSourceBuffer();
    const ms = fakeMediaSource(sb);
    let t = 0;
    const handle = pumpAudioStream({
      body: bodyOf([[1, 2], [3], [4, 5, 6]]),
      mediaSource: ms,
      now: () => (t += 10),
    });
    // Nothing is appended before an <audio> element opens the source.
    await Promise.resolve();
    expect(appended).toEqual([]);
    ms.open();
    const clip = await handle.fullClip;
    expect(appended).toEqual([[1, 2], [3], [4, 5, 6]]);
    expect(ms.ended).toEqual([undefined]);
    expect(handle.isComplete()).toBe(true);
    expect(handle.failed()).toBe(false);
    expect(handle.lastDataAt()).toBeGreaterThan(0);
    expect(clip?.size).toBe(6);
    expect(clip?.type).toBe("audio/mpeg");
  });

  it("keeps the whole clip when MediaSource fails, so it can still be played", async () => {
    const { sb, appended } = fakeSourceBuffer({ failOnAppend: 2 });
    const ms = fakeMediaSource(sb, true);
    const handle = pumpAudioStream({
      body: bodyOf([[1], [2], [3]]),
      mediaSource: ms,
    });
    const clip = await handle.fullClip;
    expect(handle.failed()).toBe(true);
    expect(ms.ended).toEqual(["decode"]);
    // Appending stopped at the failure, but every byte was still collected.
    expect(appended).toEqual([[1], [2]]);
    expect(clip?.size).toBe(3);
  });

  it("stops reading on cancel (barge-in) and yields no clip", async () => {
    const { sb } = fakeSourceBuffer();
    const ms = fakeMediaSource(sb, true);
    let pull = 0;
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
      pull(controller) {
        pull += 1;
        if (pull > 100) controller.close();
        else controller.enqueue(new Uint8Array([pull]));
      },
    });
    const handle = pumpAudioStream({ body, mediaSource: ms });
    handle.cancel();
    handle.cancel();
    expect(await handle.fullClip).toBeNull();
    expect(pull).toBeLessThan(100);
  });
});
