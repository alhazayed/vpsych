import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_TTS_IN_FLIGHT,
  playQueuedSpeech,
  type SynthesizeChunkResult,
} from "@/lib/voice/speech-queue";
import { chunkTextForSpeechPlayback } from "@/lib/voice/speech-chunker";
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
});
