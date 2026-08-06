import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireHandsFreeMicrophone,
  mediaStreamIsLive,
  stashPrimedMicrophone,
  takePrimedMicrophone,
} from "./prime-mic";
import { HANDS_FREE_AUDIO_CONSTRAINTS } from "./audio-constraints";

function fakeTrack(state: MediaStreamTrackState = "live"): MediaStreamTrack {
  return {
    readyState: state,
    stop: vi.fn(),
    kind: "audio",
  } as unknown as MediaStreamTrack;
}

function fakeStream(state: MediaStreamTrackState = "live"): MediaStream {
  const track = fakeTrack(state);
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
}

describe("prime-mic", () => {
  afterEach(() => {
    takePrimedMicrophone()?.getTracks().forEach((t) => t.stop());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses ideal constraints so Safari does not see exact booleans", () => {
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.echoCancellation).toEqual({
      ideal: true,
    });
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.channelCount).toEqual({ ideal: 1 });
  });

  it("detects live vs ended streams", () => {
    expect(mediaStreamIsLive(fakeStream("live"))).toBe(true);
    expect(mediaStreamIsLive(fakeStream("ended"))).toBe(false);
  });

  it("falls back to {audio:true} when preferred constraints fail", async () => {
    const preferred = fakeStream();
    const fallback = fakeStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("overconstrained", "OverconstrainedError"))
      .mockResolvedValueOnce(fallback);

    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
    });

    const result = await acquireHandsFreeMicrophone();
    expect(result.stream).toBe(fallback);
    expect(result.ownsStream).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0]![0]).toEqual({
      audio: HANDS_FREE_AUDIO_CONSTRAINTS,
    });
    expect(getUserMedia.mock.calls[1]![0]).toEqual({ audio: true });
    void preferred;
  });

  it("reuses a live existing stream without calling getUserMedia", async () => {
    const existing = fakeStream("live");
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
    });

    const result = await acquireHandsFreeMicrophone(existing);
    expect(result.stream).toBe(existing);
    expect(result.ownsStream).toBe(false);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("stashes and claims a primed stream across Start → session handoff", () => {
    vi.stubGlobal("window", globalThis);
    const stream = fakeStream("live");
    stashPrimedMicrophone(stream);
    expect(takePrimedMicrophone()).toBe(stream);
    expect(takePrimedMicrophone()).toBeNull();
  });

  it("discards ended primed streams", () => {
    vi.stubGlobal("window", globalThis);
    const stream = fakeStream("ended");
    stashPrimedMicrophone(stream);
    expect(takePrimedMicrophone()).toBeNull();
  });
});
