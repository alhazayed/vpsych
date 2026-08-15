import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Microphone capture tests: the max-duration timer and barge-in re-arming.
 * Web Audio is stubbed; the scheduling logic under test is ours.
 */

type Processor = {
  onaudioprocess: ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null;
  connect: () => void;
  disconnect: () => void;
};

let processors: Processor[] = [];
let closedContexts = 0;
let stoppedTracks = 0;

function makeProcessor(): Processor {
  const processor: Processor = {
    onaudioprocess: null,
    connect: () => undefined,
    disconnect: () => undefined,
  };
  processors.push(processor);
  return processor;
}

function stubWebAudio() {
  processors = [];
  closedContexts = 0;
  stoppedTracks = 0;

  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 48000;
      state = "running";
      destination = {};
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
      createScriptProcessor() {
        return makeProcessor();
      }
      createGain() {
        return {
          gain: { value: 1 },
          connect: () => undefined,
          disconnect: () => undefined,
        };
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        closedContexts += 1;
        return Promise.resolve();
      }
    },
  );

  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [
          {
            stop: () => {
              stoppedTracks += 1;
            },
          },
        ],
      }),
    },
  });

  vi.stubGlobal("window", {
    setTimeout: (...args: Parameters<typeof globalThis.setTimeout>) =>
      globalThis.setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof globalThis.clearTimeout>) =>
      globalThis.clearTimeout(...args),
  });
}

/** Feed one frame at the given amplitude. */
function frame(processor: Processor, amplitude: number, samples = 2048) {
  processor.onaudioprocess?.({
    inputBuffer: {
      getChannelData: () => new Float32Array(samples).fill(amplitude),
    },
  });
}

beforeEach(stubWebAudio);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recording max duration", () => {
  it("actually terminates capture when maxMs elapses", async () => {
    vi.useFakeTimers();
    const { startMicWavRecording } = await import("@/lib/voice/record-wav");

    const onMaxDuration = vi.fn();
    const recorder = await startMicWavRecording(5000, { onMaxDuration });
    expect(recorder.isStopped()).toBe(false);

    vi.advanceTimersByTime(4999);
    expect(recorder.isStopped()).toBe(false);
    expect(onMaxDuration).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(recorder.isStopped()).toBe(true);
    expect(recorder.reachedMaxDuration()).toBe(true);
    expect(onMaxDuration).toHaveBeenCalledTimes(1);
    // Resources are genuinely released, not just flagged.
    expect(closedContexts).toBe(1);
    expect(stoppedTracks).toBe(1);
  });

  it("discards frames that arrive after the cap", async () => {
    vi.useFakeTimers();
    const { startMicWavRecording } = await import("@/lib/voice/record-wav");
    const recorder = await startMicWavRecording(1000);
    const processor = processors[0]!;

    frame(processor, 0.4);
    vi.advanceTimersByTime(1100);
    const sizeAtCap = (await recorder.stop()).size;

    frame(processor, 0.4);
    frame(processor, 0.4);
    const sizeAfter = (await recorder.stop()).size;

    expect(sizeAfter).toBe(sizeAtCap);
  });

  it("still returns captured audio when stopped normally before the cap", async () => {
    vi.useFakeTimers();
    const { startMicWavRecording } = await import("@/lib/voice/record-wav");
    const recorder = await startMicWavRecording(10_000);

    frame(processors[0]!, 0.5);
    const blob = await recorder.stop();

    expect(recorder.reachedMaxDuration()).toBe(false);
    expect(blob.type).toBe("audio/wav");
    // 44-byte WAV header plus PCM payload.
    expect(blob.size).toBeGreaterThan(44);
  });

  it("cancel() releases the microphone without waiting for the cap", async () => {
    vi.useFakeTimers();
    const { startMicWavRecording } = await import("@/lib/voice/record-wav");
    const recorder = await startMicWavRecording(10_000);

    recorder.cancel();
    expect(recorder.isStopped()).toBe(true);
    expect(stoppedTracks).toBe(1);
  });
});

describe("barge-in monitor", () => {
  /** Drive the monitor with loud frames across a span of wall-clock time. */
  function speakFor(processor: Processor, ms: number, stepMs = 50) {
    for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
      vi.advanceTimersByTime(stepMs);
      frame(processor, 0.5);
    }
  }

  it("ignores the grace period so speaker bleed does not trigger it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { startBargeInMonitor } = await import("@/lib/therapy-room/vad");

    const onBargeIn = vi.fn();
    await startBargeInMonitor({ onBargeIn, graceMs: 250, minSpeechMs: 100 });
    const processor = processors[0]!;

    speakFor(processor, 200);
    expect(onBargeIn).not.toHaveBeenCalled();
  });

  it("fires after sustained therapist speech", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { startBargeInMonitor } = await import("@/lib/therapy-room/vad");

    const onBargeIn = vi.fn();
    await startBargeInMonitor({ onBargeIn, graceMs: 0, minSpeechMs: 280 });
    const processor = processors[0]!;

    speakFor(processor, 600);
    expect(onBargeIn).toHaveBeenCalledTimes(1);
  });

  it("does not fire on a brief transient", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { startBargeInMonitor } = await import("@/lib/therapy-room/vad");

    const onBargeIn = vi.fn();
    await startBargeInMonitor({ onBargeIn, graceMs: 0, minSpeechMs: 280 });
    const processor = processors[0]!;

    vi.advanceTimersByTime(50);
    frame(processor, 0.5);
    vi.advanceTimersByTime(100);
    frame(processor, 0.5);
    // Quiet again before the threshold is met.
    vi.advanceTimersByTime(50);
    frame(processor, 0.001);

    expect(onBargeIn).not.toHaveBeenCalled();
  });

  it("re-arms after the refractory period instead of latching off", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { startBargeInMonitor } = await import("@/lib/therapy-room/vad");

    const onBargeIn = vi.fn();
    await startBargeInMonitor({
      onBargeIn,
      graceMs: 0,
      minSpeechMs: 280,
      rearmAfterMs: 1000,
    });
    const processor = processors[0]!;

    speakFor(processor, 600);
    expect(onBargeIn).toHaveBeenCalledTimes(1);

    // Inside the refractory window nothing fires, however loud.
    speakFor(processor, 800);
    expect(onBargeIn).toHaveBeenCalledTimes(1);

    // Past it, the monitor is armed again — this is the regression that used to
    // permanently disable barge-in after a single detection.
    vi.advanceTimersByTime(1200);
    frame(processor, 0.001);
    speakFor(processor, 600);
    expect(onBargeIn).toHaveBeenCalledTimes(2);
  });

  it("stop() releases the microphone", async () => {
    vi.useFakeTimers();
    const { startBargeInMonitor } = await import("@/lib/therapy-room/vad");
    const stop = await startBargeInMonitor({ onBargeIn: vi.fn() });
    stop();
    expect(stoppedTracks).toBe(1);
    expect(closedContexts).toBe(1);
  });
});
