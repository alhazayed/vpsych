import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Playback-level tests for the segmented TTS pipeline and barge-in.
 * The DOM/audio surface is stubbed; the logic under test is ours.
 */

type FakeAudioInstance = {
  src: string;
  volume: number;
  stopped: boolean;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  endNow: () => void;
};

const audioInstances: FakeAudioInstance[] = [];
/** When true, clips never end on their own — the test drives them. */
let holdPlayback = false;

class FakeAudio {
  src: string;
  volume = 1;
  stopped = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src: string) {
    this.src = src;
    audioInstances.push(this as unknown as FakeAudioInstance);
  }

  endNow() {
    if (!this.stopped) this.onended?.();
  }

  play() {
    if (!holdPlayback) {
      queueMicrotask(() => {
        if (!this.stopped) this.onended?.();
      });
    }
    return Promise.resolve();
  }

  pause() {
    this.stopped = true;
  }

  removeAttribute() {}
  load() {}
}

let ttsCalls: Array<Record<string, unknown>> = [];

function stubEnvironment() {
  audioInstances.length = 0;
  ttsCalls = [];
  holdPlayback = false;

  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("window", {
    speechSynthesis: undefined,
    setTimeout: (...args: Parameters<typeof globalThis.setTimeout>) =>
      globalThis.setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof globalThis.clearTimeout>) =>
      globalThis.clearTimeout(...args),
  });
  vi.stubGlobal("URL", {
    createObjectURL: (blob: unknown) => `blob:${String(blob)}`,
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/voice/tts")) {
        ttsCalls.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

beforeEach(stubEnvironment);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("segmented patient playback", () => {
  it("synthesizes and plays one clip per segment, in order", async () => {
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );

    const mode = await playPatientSpeech({
      text: "I don't know. It started six months ago. Do you think that's normal?",
      locale: "en",
      pauseScale: 0,
    });

    expect(mode).toBe("elevenlabs");
    expect(ttsCalls.length).toBe(3);
    expect(audioInstances.length).toBe(3);
    expect(ttsCalls[0]!.text).toContain("I don't know");
    expect(ttsCalls[2]!.text).toContain("normal");
  });

  it("passes previous/next context so segments share one contour", async () => {
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );

    await playPatientSpeech({
      text: "I don't know. It started six months ago. Do you think that's normal?",
      locale: "en",
      pauseScale: 0,
    });

    expect(ttsCalls[0]!.previousText).toBeUndefined();
    expect(ttsCalls[0]!.nextText).toContain("six months");
    expect(ttsCalls[1]!.previousText).toContain("I don't know");
    expect(ttsCalls[1]!.nextText).toContain("normal");
    expect(ttsCalls[2]!.nextText).toBeUndefined();
  });

  it("sends normalized speech text while leaving display text untouched", async () => {
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );

    const display = "الدكتور وصفلي Prozac من ٣ شهور؟";
    await playPatientSpeech({ text: display, locale: "ar", pauseScale: 0 });

    const sent = String(ttsCalls[0]!.text);
    expect(sent).toContain("بروزاك");
    expect(sent).toContain("ثلاثة");
    expect(sent).toContain("?");
    // The caller's string is never mutated.
    expect(display).toBe("الدكتور وصفلي Prozac من ٣ شهور؟");
    expect(sent).not.toBe(display);
  });

  it("falls back to a single request for a short turn", async () => {
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    await playPatientSpeech({
      text: "Do you think that's normal?",
      locale: "en",
      pauseScale: 0,
    });
    expect(ttsCalls.length).toBe(1);
  });

  it("reports interruption without synthesizing when already aborted", async () => {
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    const controller = new AbortController();
    controller.abort();

    const mode = await playPatientSpeech({
      text: "I don't know. It started six months ago.",
      locale: "en",
      signal: controller.signal,
      pauseScale: 0,
    });

    expect(mode).toBe("interrupted");
    expect(ttsCalls.length).toBe(0);
  });
});

describe("barge-in stops playback", () => {
  it("aborting mid-clip stops the audio and ends the turn as interrupted", async () => {
    holdPlayback = true;
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );

    const controller = new AbortController();
    const handlers = { onstart: vi.fn(), onend: vi.fn(), onerror: vi.fn() };

    const promise = playPatientSpeech({
      text: "I don't know. It started six months ago. Do you think that's normal?",
      locale: "en",
      signal: controller.signal,
      pauseScale: 0,
      handlers,
    });

    // Let the first clip start playing.
    await vi.waitFor(() => expect(audioInstances.length).toBeGreaterThan(0));

    controller.abort();
    const mode = await promise;

    expect(mode).toBe("interrupted");
    expect(handlers.onend).not.toHaveBeenCalled();
    expect(handlers.onerror).toHaveBeenCalled();
    // The turn yields immediately; the clip itself stops at the end of a short
    // volume ramp rather than with an audible click. (The ramp shape is
    // asserted directly in the fadeOutAudio test below.)
    await vi.waitFor(() => expect(audioInstances[0]!.stopped).toBe(true));
    expect(audioInstances[0]!.volume).toBeLessThan(1);
  });

  it("stops synthesizing further segments after a barge-in", async () => {
    holdPlayback = true;
    const { playPatientSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );

    const controller = new AbortController();
    const promise = playPatientSpeech({
      text: "One sentence here. Two sentence here. Three sentence here. Four sentence here.",
      locale: "en",
      signal: controller.signal,
      pauseScale: 0,
    });

    await vi.waitFor(() => expect(audioInstances.length).toBeGreaterThan(0));
    controller.abort();
    await promise;

    // At most the playing segment plus its single prefetch were requested —
    // never the whole turn.
    expect(ttsCalls.length).toBeLessThanOrEqual(2);
  });

  it("fades rather than hard-cutting when aborted", async () => {
    const { fadeOutAudio } = await import("@/lib/voice/client");
    vi.useFakeTimers();
    const audio = new FakeAudio("blob:x");
    fadeOutAudio(audio as unknown as HTMLAudioElement, 120);

    vi.advanceTimersByTime(60);
    expect(audio.volume).toBeLessThan(1);
    expect(audio.stopped).toBe(false);

    vi.advanceTimersByTime(120);
    expect(audio.stopped).toBe(true);
    vi.useRealTimers();
  });
});
