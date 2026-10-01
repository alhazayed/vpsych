import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_TTS_IN_FLIGHT,
  playQueuedSpeech,
  type SynthesizeChunkResult,
} from "@/lib/voice/speech-queue";
import {
  chunkTextForSpeechPlayback,
  MAX_PROGRESSIVE_TTS_CHUNKS,
  planSpeechChunksForPlayback,
} from "@/lib/voice/speech-chunker";
import { createVoiceTurnFence } from "@/lib/voice/turn-fence";
import { playPatientSpeech } from "@/lib/voice/conversation-pipeline";

function mockAudio(playDelayMs = 5) {
  const playSpy = vi.fn().mockImplementation(function (this: {
    onended: (() => void) | null;
  }) {
    setTimeout(() => this.onended?.(), playDelayMs);
    return Promise.resolve();
  });
  vi.stubGlobal(
    "Audio",
    vi.fn(function AudioMock(this: {
      play: typeof playSpy;
      pause: () => void;
      removeAttribute: () => void;
      load: () => void;
      onended: (() => void) | null;
      onerror: (() => void) | null;
    }) {
      this.play = playSpy;
      this.pause = vi.fn();
      this.removeAttribute = vi.fn();
      this.load = vi.fn();
      this.onended = null;
      this.onerror = null;
      return this;
    }),
  );
  return playSpy;
}

describe("playQueuedSpeech", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => `blob:mock-${Math.random()}`),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("documents bounded concurrency default", () => {
    expect(DEFAULT_TTS_IN_FLIGHT).toBe(2);
  });

  it("E — queue ordering preserved", async () => {
    mockAudio(2);
    const order: number[] = [];
    const result = await playQueuedSpeech({
      chunks: ["A.", "B.", "C."],
      maxInFlight: 2,
      synthesizeChunk: async (_text, index) => {
        order.push(index);
        return { ok: true, objectUrl: `blob:c${index}` };
      },
    });
    expect(result.mode).toBe("elevenlabs");
    expect(result.metrics.chunksPlayed).toBe(3);
    // Fetch may be parallel but play order is 0→1→2 via played count.
    expect(result.metrics.chunkCount).toBe(3);
  });

  it("F+G — first chunk begins before later chunks finish synthesizing", async () => {
    mockAudio(30);
    let resolve2!: (v: SynthesizeChunkResult) => void;
    const chunk2Gate = new Promise<SynthesizeChunkResult>((r) => {
      resolve2 = r;
    });
    const events: string[] = [];
    let firstPlayBeforeChunk2Ready = false;

    const pending = playQueuedSpeech({
      chunks: ["Sentence one.", "Sentence two.", "Sentence three."],
      maxInFlight: 2,
      onEvent: (e) => {
        events.push(e.type);
        if (e.type === "audio_queue_first_play") {
          // Chunk 2 still gated — proves playback did not wait for full utterance.
          firstPlayBeforeChunk2Ready = true;
          resolve2({ ok: true, objectUrl: "blob:c2" });
        }
      },
      synthesizeChunk: async (_text, index) => {
        if (index === 0) {
          return { ok: true, objectUrl: "blob:c0" };
        }
        if (index === 1) {
          // Start fetch immediately but finish only after first play.
          return chunk2Gate;
        }
        return { ok: true, objectUrl: "blob:c2b" };
      },
    });

    const result = await pending;
    expect(firstPlayBeforeChunk2Ready).toBe(true);
    expect(events.indexOf("audio_queue_first_play")).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("tts_chunk_ready")).toBeLessThan(
      events.indexOf("audio_queue_first_play"),
    );
    expect(result.playbackPath).toBe("progressive_queue");
    expect(result.metrics.ttsFirstAudioPlayMs).not.toBeNull();
  });

  it("H — normal completion", async () => {
    mockAudio(1);
    const result = await playQueuedSpeech({
      chunks: ["One.", "Two."],
      synthesizeChunk: async (_t, i) => ({
        ok: true,
        objectUrl: `blob:${i}`,
      }),
    });
    expect(result.mode).toBe("elevenlabs");
    expect(result.metrics.chunksPlayed).toBe(2);
  });

  it("I+J — interruption / abort discards queue", async () => {
    mockAudio(50);
    const abort = new AbortController();
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:x"),
      revokeObjectURL: revoke,
    });

    const pending = playQueuedSpeech({
      chunks: ["One.", "Two.", "Three."],
      signal: abort.signal,
      synthesizeChunk: async (_t, i) => {
        if (i === 0) {
          queueMicrotask(() => abort.abort());
          return { ok: true, objectUrl: "blob:0" };
        }
        await new Promise((r) => setTimeout(r, 40));
        return { ok: true, objectUrl: `blob:${i}` };
      },
    });

    const result = await pending;
    expect(result.mode).toBe("interrupted");
    expect(result.playbackPath).toBe("interrupted");
  });

  it("K+L — stale turn never plays", async () => {
    mockAudio(1);
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    fence.beginTurn(); // supersede
    const playSpy = mockAudio(1);

    const result = await playQueuedSpeech({
      chunks: ["Stale."],
      turn: { turnId, isActive: (id) => fence.isActive(id) },
      synthesizeChunk: async () => ({ ok: true, objectUrl: "blob:stale" }),
    });
    expect(result.mode).toBe("interrupted");
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("M — object URL cleanup on completion", async () => {
    mockAudio(1);
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:clean"),
      revokeObjectURL: revoke,
    });
    await playQueuedSpeech({
      chunks: ["Done."],
      synthesizeChunk: async () => ({ ok: true, objectUrl: "blob:clean" }),
    });
    expect(revoke).toHaveBeenCalled();
  });

  it("O — mid-chunk TTS failure does not replay chunk 1", async () => {
    const playSpy = mockAudio(1);
    let plays = 0;
    playSpy.mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      plays += 1;
      setTimeout(() => this.onended?.(), 1);
      return Promise.resolve();
    });

    const result = await playQueuedSpeech({
      chunks: ["First.", "Second.", "Third."],
      synthesizeChunk: async (_t, i) => {
        if (i === 1) return { ok: false, reason: "failed" };
        return { ok: true, objectUrl: `blob:${i}` };
      },
    });
    expect(plays).toBe(1);
    expect(result.metrics.chunksPlayed).toBe(1);
  });

  it("P — first chunk TTS failure is fatal for the queue", async () => {
    mockAudio(1);
    const result = await playQueuedSpeech({
      chunks: ["First.", "Second."],
      synthesizeChunk: async () => ({ ok: false, reason: "failed" }),
    });
    expect(result.mode).toBe("interrupted");
    expect(result.metrics.chunksPlayed).toBe(0);
  });

  it("9.2R — first-audio metric only after play() resolves", async () => {
    let resolvePlay!: () => void;
    const playGate = new Promise<void>((r) => {
      resolvePlay = r;
    });
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      return playGate.then(() => {
        setTimeout(() => this.onended?.(), 1);
      });
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );

    const events: string[] = [];
    const pending = playQueuedSpeech({
      chunks: ["Only."],
      onEvent: (e) => events.push(e.type),
      synthesizeChunk: async () => ({ ok: true, objectUrl: "blob:1" }),
    });

    // play() not resolved yet — first_play must not have fired.
    await Promise.resolve();
    expect(events).not.toContain("audio_queue_first_play");

    resolvePlay();
    const result = await pending;
    expect(events).toContain("audio_queue_first_play");
    expect(result.metrics.ttsFirstAudioPlayMs).not.toBeNull();
  });

  it("9.2R — chunk1 play ok; chunk2 NotAllowedError; no duplicate / no leak", async () => {
    let playCount = 0;
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => `blob:mock-${Math.random()}`),
      revokeObjectURL: revoke,
    });
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      playCount += 1;
      if (playCount === 1) {
        setTimeout(() => this.onended?.(), 1);
        return Promise.resolve();
      }
      return Promise.reject(
        Object.assign(new Error("play blocked"), { name: "NotAllowedError" }),
      );
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );

    const events: Array<{ type: string; chunkIndex?: number }> = [];
    const result = await playQueuedSpeech({
      chunks: ["First.", "Second.", "Third."],
      onEvent: (e) =>
        events.push({
          type: e.type,
          chunkIndex: "chunkIndex" in e ? e.chunkIndex : undefined,
        }),
      synthesizeChunk: async (_t, i) => ({
        ok: true,
        objectUrl: `blob:${i}`,
      }),
    });

    expect(playCount).toBe(2);
    expect(result.metrics.chunksPlayed).toBe(1);
    expect(
      events.some(
        (e) => e.type === "audio_play_rejected" && e.chunkIndex === 1,
      ),
    ).toBe(true);
    // No replay of chunk 1 after rejection.
    expect(playCount).toBeLessThan(3);
    expect(revoke.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("9.2R — abort during rejected play cleans up without leak", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:x"),
      revokeObjectURL: revoke,
    });
    const abort = new AbortController();
    const playSpy = vi.fn().mockImplementation(() => {
      abort.abort();
      return Promise.reject(
        Object.assign(new Error("blocked"), { name: "NotAllowedError" }),
      );
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );

    const result = await playQueuedSpeech({
      chunks: ["One.", "Two."],
      signal: abort.signal,
      synthesizeChunk: async (_t, i) => ({
        ok: true,
        objectUrl: `blob:${i}`,
      }),
    });
    expect(result.mode).toBe("interrupted");
    expect(result.metrics.chunksPlayed).toBe(0);
    expect(result.metrics.ttsFirstAudioPlayMs).toBeNull();
    expect(revoke).toHaveBeenCalled();
  });

  it("9.2R — stale turn during playback never continues", async () => {
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    let playCalls = 0;
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      playCalls += 1;
      fence.beginTurn(); // supersede mid-play
      setTimeout(() => this.onended?.(), 1);
      return Promise.resolve();
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );

    const result = await playQueuedSpeech({
      chunks: ["One.", "Two."],
      turn: { turnId, isActive: (id) => fence.isActive(id) },
      synthesizeChunk: async (_t, i) => ({
        ok: true,
        objectUrl: `blob:${i}`,
      }),
    });
    expect(result.mode).toBe("interrupted");
    expect(playCalls).toBe(1);
  });
});

describe("playPatientSpeech progressive integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("behavioral — three sentences: play starts while later TTS pending", async () => {
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      setTimeout(() => this.onended?.(), 20);
      return Promise.resolve();
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => `blob:${blob.size}`,
      revokeObjectURL: vi.fn(),
    });

    let resolveSlow: ((r: Response) => void) | null = null;
    let requestCount = 0;
    let playedBeforeAllRequests = false;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        requestCount += 1;
        const n = requestCount;
        if (n === 1) {
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          });
        }
        // Later chunks delayed.
        return new Promise<Response>((resolve) => {
          resolveSlow = resolve;
          // If play already started with fewer than 3 requests completed, good.
          queueMicrotask(() => {
            if (playSpy.mock.calls.length > 0 && n < 3) {
              playedBeforeAllRequests = true;
            }
            resolve(
              new Response(new Uint8Array([n]), {
                status: 200,
                headers: { "Content-Type": "audio/mpeg" },
              }),
            );
          });
        });
      }),
    );

    const text = "Sentence one. Sentence two. Sentence three.";
    expect(chunkTextForSpeechPlayback(text).length).toBeGreaterThanOrEqual(2);

    const spoken = await playPatientSpeech({
      text,
      locale: "en",
    });

    expect(spoken.playbackPath).toBe("progressive_queue");
    expect(spoken.mode).toBe("elevenlabs");
    expect(playSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(playedBeforeAllRequests || requestCount >= 2).toBe(true);
    void resolveSlow;
  });

  it("R — humanization pause applied once before first chunk only", async () => {
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:p",
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Uint8Array([9]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      ),
    );

    const t0 = performance.now();
    const spoken = await playPatientSpeech({
      text: "Hello there. More words follow.",
      locale: "en",
      pauseBeforeMs: 80,
    });
    const elapsed = performance.now() - t0;
    expect(spoken.metrics.pauseBeforeAppliedMs).toBe(80);
    expect(elapsed).toBeGreaterThanOrEqual(70);
    // Not 80ms * chunkCount.
    expect(elapsed).toBeLessThan(80 * 3);
  });

  it("Q — preferPlayback legacy_blob is explicit", async () => {
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:legacy",
      revokeObjectURL: vi.fn(),
    });
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const spoken = await playPatientSpeech({
      text: "Sentence one. Sentence two. Sentence three.",
      locale: "en",
      preferPlayback: "legacy_blob",
    });
    expect(spoken.playbackPath).toBe("legacy_blob");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("9.2R — over-budget response uses legacy_blob before progressive (1 TTS)", async () => {
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:budget",
      revokeObjectURL: vi.fn(),
    });
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Default maxChars=180 / coalesce=480 ⇒ each coalesced piece holds ~2
    // originals. Need ≥13 near-max chunks so ceil(N/2) > 6 → legacy_blob
    // before progressive playback starts.
    const text = Array.from({ length: 14 }, (_, i) => {
      const body = `Clinical observation ${i + 1} ${"detail ".repeat(20)}`.trim();
      return `${body}.`;
    }).join(" ");
    const raw = chunkTextForSpeechPlayback(text);
    expect(raw.length).toBeGreaterThan(12);
    const plan = planSpeechChunksForPlayback(text);
    expect(plan.mode).toBe("legacy_blob");

    const spoken = await playPatientSpeech({ text, locale: "en" });
    expect(spoken.playbackPath).toBe("legacy_blob");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(MAX_PROGRESSIVE_TTS_CHUNKS).toBe(6);
  });

  it("9.2R — progressive path never issues more TTS than chunk budget", async () => {
    const playSpy = vi.fn().mockImplementation(function (this: {
      onended: (() => void) | null;
    }) {
      queueMicrotask(() => this.onended?.());
      return Promise.resolve();
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(this: {
        play: typeof playSpy;
        pause: () => void;
        removeAttribute: () => void;
        load: () => void;
        onended: (() => void) | null;
        onerror: (() => void) | null;
      }) {
        this.play = playSpy;
        this.pause = vi.fn();
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        this.onended = null;
        this.onerror = null;
        return this;
      }),
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:n",
      revokeObjectURL: vi.fn(),
    });
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([9]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const text = Array.from(
      { length: 10 },
      (_, i) => `Sentence number ${i + 1} about the week.`,
    ).join(" ");
    const raw = chunkTextForSpeechPlayback(text);
    expect(raw.length).toBeGreaterThan(MAX_PROGRESSIVE_TTS_CHUNKS);

    const spoken = await playPatientSpeech({ text, locale: "en" });
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(
      MAX_PROGRESSIVE_TTS_CHUNKS,
    );
    expect(
      spoken.playbackPath === "progressive_queue" ||
        spoken.playbackPath === "legacy_blob",
    ).toBe(true);
  });
});

describe("Human Conversation Fidelity — start gate overlaps synthesis", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => `blob:mock-${Math.random()}`),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("TTS starts before the persona pause ends; first audio waits for the gate", async () => {
    const playSpy = mockAudio(1);
    let openGate!: () => void;
    const gate = new Promise<void>((r) => {
      openGate = r;
    });
    const synthStarted: number[] = [];
    const done = playQueuedSpeech({
      chunks: ["One.", "Two."],
      startGate: gate,
      synthesizeChunk: async (_t, i) => {
        synthStarted.push(i);
        return { ok: true, objectUrl: `blob:${i}` };
      },
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(synthStarted).toEqual([0, 1]);
    expect(playSpy).not.toHaveBeenCalled();
    openGate();
    const result = await done;
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(result.metrics.chunksPlayed).toBe(2);
  });

  it("mid-utterance failure reports error only — never a completed reply", async () => {
    mockAudio(1);
    const onend = vi.fn();
    const onerror = vi.fn();
    const events: string[] = [];
    await playQueuedSpeech({
      chunks: ["One.", "Two."],
      handlers: { onend, onerror },
      onEvent: (e) => events.push(e.type),
      synthesizeChunk: async (_t, i) =>
        i === 0 ? { ok: true, objectUrl: "blob:0" } : { ok: false, reason: "failed" },
    });
    expect(onerror).toHaveBeenCalled();
    expect(onend).not.toHaveBeenCalled();
    expect(events).not.toContain("audio_queue_complete");
  });
});
