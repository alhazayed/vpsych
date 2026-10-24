import { describe, expect, it, vi } from "vitest";
import { createSessionMic } from "./vad";

type FakeTrack = { readyState: "live" | "ended"; stop: () => void };

function fakeStream() {
  const track: FakeTrack = {
    readyState: "live",
    stop: vi.fn(() => {
      track.readyState = "ended";
    }),
  };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track };
}

describe("createSessionMic", () => {
  it("opens the mic once and reuses it across turns", async () => {
    const { stream } = fakeStream();
    const open = vi.fn(async () => stream);
    const mic = createSessionMic(open);
    expect(await mic.acquire()).toBe(stream);
    expect(await mic.acquire()).toBe(stream);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("shares one open between callers asking at the same time", async () => {
    const { stream } = fakeStream();
    const open = vi.fn(async () => stream);
    const mic = createSessionMic(open);
    const [a, b] = await Promise.all([mic.acquire(), mic.acquire()]);
    expect(a).toBe(b);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("opens a fresh stream when the OS ended the track", async () => {
    const first = fakeStream();
    const second = fakeStream();
    const open = vi
      .fn<() => Promise<MediaStream>>()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    const mic = createSessionMic(open);
    await mic.acquire();
    first.track.readyState = "ended";
    expect(await mic.acquire()).toBe(second.stream);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("close() stops the tracks and the next acquire reopens", async () => {
    const first = fakeStream();
    const second = fakeStream();
    const open = vi
      .fn<() => Promise<MediaStream>>()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    const mic = createSessionMic(open);
    await mic.acquire();
    mic.close();
    expect(first.track.stop).toHaveBeenCalled();
    expect(await mic.acquire()).toBe(second.stream);
  });

  it("does not keep a stream that finished opening after close()", async () => {
    const { stream, track } = fakeStream();
    let resolve!: (s: MediaStream) => void;
    const open = vi.fn(
      () => new Promise<MediaStream>((r) => (resolve = r)),
    );
    const mic = createSessionMic(open);
    const pending = mic.acquire();
    mic.close();
    resolve(stream);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(track.stop).toHaveBeenCalled();
  });

  it("passes an open failure through and retries next time", async () => {
    const { stream } = fakeStream();
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const open = vi
      .fn<() => Promise<MediaStream>>()
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce(stream);
    const mic = createSessionMic(open);
    await expect(mic.acquire()).rejects.toBe(denied);
    expect(await mic.acquire()).toBe(stream);
  });
});
