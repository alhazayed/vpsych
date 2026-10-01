/**
 * Human Conversation Fidelity — conversation-level test suite (Tests 1–10).
 *
 * Composes the real voice-layer modules (endpoint controller, FSM, turn
 * fence, chunker, progressive queue, pipeline) with mocked network + audio.
 * Clinical reasoning is out of scope: the message API is mocked and only its
 * request contract is asserted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConversationFsm } from "@/lib/therapy-room/conversation-fsm";
import {
  createEndpointController,
  type SpeculativeSttResult,
} from "@/lib/voice/endpoint-controller";
import { classifyUtteranceCompleteness } from "@/lib/voice/endpointing";
import {
  createVoiceTurnFence,
  playPatientSpeech,
  runVoiceConversationTurn,
  submitConversationTurn,
} from "@/lib/voice/conversation-pipeline";
import { createTherapistInterruptedFlag } from "@/lib/voice/interrupt-flag";
import {
  joinSpeechChunks,
  planSpeechChunksForPlayback,
} from "@/lib/voice/speech-chunker";

// ── audio + network fakes ─────────────────────────────────────────────────

type FakeAudio = {
  src: string;
  play: () => Promise<void>;
  pause: () => void;
  removeAttribute: () => void;
  load: () => void;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  paused: boolean;
};

/** Tracks every Audio element; at most one may be "playing" at a time. */
function installAudio(opts: { durationMs?: number; rejectFirst?: string } = {}) {
  const created: FakeAudio[] = [];
  let playingNow = 0;
  let maxConcurrent = 0;
  let rejections = 0;
  vi.stubGlobal(
    "Audio",
    vi.fn(function AudioMock(this: FakeAudio, src: string) {
      this.src = src;
      this.paused = true;
      this.onended = null;
      this.onerror = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      this.play = () => {
        if (opts.rejectFirst && rejections === 0) {
          rejections += 1;
          const err = new Error("play() blocked");
          err.name = opts.rejectFirst;
          return Promise.reject(err);
        }
        this.paused = false;
        playingNow += 1;
        maxConcurrent = Math.max(maxConcurrent, playingNow);
        timer = setTimeout(() => {
          if (this.paused) return;
          this.paused = true;
          playingNow -= 1;
          this.onended?.();
        }, opts.durationMs ?? 5);
        return Promise.resolve();
      };
      this.pause = () => {
        if (!this.paused) playingNow -= 1;
        this.paused = true;
        if (timer) clearTimeout(timer);
      };
      this.removeAttribute = () => undefined;
      this.load = () => undefined;
      created.push(this);
      return this;
    }),
  );
  return {
    created,
    maxConcurrent: () => maxConcurrent,
    playingNow: () => playingNow,
  };
}

type FetchCall = { url: string; body: Record<string, unknown> | null };

function installFetch(handler: (call: FetchCall) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      let body: Record<string, unknown> | null = null;
      if (typeof init?.body === "string") {
        body = JSON.parse(init.body) as Record<string, unknown>;
      }
      const call = { url, body };
      calls.push(call);
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return await new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
        Promise.resolve(handler(call)).then(resolve, reject);
      });
    }),
  );
  return calls;
}

const audioResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });

function messageResponse(userText: string, patientText: string) {
  const at = new Date().toISOString();
  return new Response(
    JSON.stringify({
      userMessage: { id: `u-${Math.random()}`, role: "user", content: userText, created_at: at },
      assistantMessage: {
        id: `a-${Math.random()}`,
        role: "assistant",
        content: patientText,
        created_at: at,
      },
      locale: "ar",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  let n = 0;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => `blob:audio-${n++}`),
    revokeObjectURL: vi.fn(),
  });
  const synth = { cancel: vi.fn(), speak: vi.fn() };
  vi.stubGlobal("window", { speechSynthesis: synth });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    vi.fn(function U(this: Record<string, unknown>, text: string) {
      this.text = text;
      return this;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Human Conversation Fidelity — conversation suite", () => {
  it("Test 1 — normal conversation: pause → patient responds → therapist responds, no overlap", async () => {
    const audio = installAudio({ durationMs: 8 });
    installFetch(({ url, body }) => {
      if (url.includes("/message")) {
        return messageResponse(String(body?.message), "تمام. احكيلي أكثر عن هاي النقطة.");
      }
      return audioResponse();
    });
    const fsm = createConversationFsm();
    const fence = createVoiceTurnFence();
    fsm.dispatch("START");

    for (const said of ["مرحبا، كيف حالك اليوم؟", "وكيف نومك هالفترة؟"]) {
      // Endpoint: a complete thought commits at the base budget.
      const commits: string[] = [];
      const ctrl = createEndpointController({
        locale: "ar",
        transcribe: async () => ({ ok: true, transcript: said }),
        onCommit: (r) => commits.push(r),
      });
      fsm.dispatch("PAUSE_DETECTED");
      ctrl.pause({
        wav: new Blob([new Uint8Array([1])]),
        speechMs: 2000,
        silenceStartedAt: performance.now() - 900,
      });
      await sleep(0);
      expect(commits).toEqual(["complete_thought"]);
      const fin = await ctrl.finalize();
      expect(fsm.dispatch("SPEECH_END").ok).toBe(true);
      expect(fsm.dispatch("STT_OK").ok).toBe(true);

      const turnId = fence.beginTurn();
      const turn = await submitConversationTurn({
        sessionId: "s1",
        message: fin.stt && fin.stt.ok ? fin.stt.transcript : "",
      });
      expect(turn.ok).toBe(true);
      expect(fsm.dispatch("GPT_OK").ok).toBe(true);
      const spoken = await playPatientSpeech({
        text: turn.ok ? turn.data.assistantMessage.content : "",
        locale: "ar",
        voiceIdAr: "R6nda3uM038xEEKi7GFl",
        turn: { turnId, isActive: (id) => fence.isActive(id) },
      });
      expect(spoken.mode).toBe("elevenlabs");
      expect(fsm.dispatch("PLAYBACK_END").ok).toBe(true);
    }
    expect(audio.maxConcurrent()).toBe(1);
    expect(audio.playingNow()).toBe(0);
  });

  it("Test 2 — short pause: therapist continues; turn is NOT submitted", async () => {
    const calls = installFetch(() => audioResponse());
    let releaseStt!: (r: SpeculativeSttResult) => void;
    const commits: string[] = [];
    const ctrl = createEndpointController({
      locale: "ar",
      transcribe: () =>
        new Promise((r) => {
          releaseStt = r;
        }),
      onCommit: (r) => commits.push(r),
    });
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    fsm.dispatch("PAUSE_DETECTED");
    ctrl.pause({
      wav: new Blob([new Uint8Array([1])]),
      speechMs: 800,
      silenceStartedAt: performance.now() - 850,
    });
    // Therapist keeps talking ("أنا من فترة…" → "…ما بنام منيح").
    ctrl.resumed();
    expect(fsm.dispatch("SPEECH_RESUMED").ok).toBe(true);
    releaseStt({ ok: true, transcript: "أنا من فترة" });
    await sleep(0);
    expect(commits).toEqual([]);
    expect(fsm.getState()).toBe("LISTENING");
    expect(calls.filter((c) => c.url.includes("/message"))).toHaveLength(0);

    // Even without the resume, the fragment alone would not commit at 850 ms.
    expect(classifyUtteranceCompleteness("أنا من فترة…")).toBe("incomplete");
  });

  it("Test 3 — immediate interruption: patient audio stops synchronously", async () => {
    const audio = installAudio({ durationMs: 10_000 });
    installFetch(() => audioResponse());
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    const abort = new AbortController();
    let started = false;
    const spoken = playPatientSpeech({
      text: "أنا أعتقد إنه المشكلة الأساسية هي الشغل. وكمان البيت صار صعب.",
      locale: "ar",
      voiceIdAr: "R6nda3uM038xEEKi7GFl",
      signal: abort.signal,
      turn: { turnId, isActive: (id) => fence.isActive(id) },
      handlers: { onstart: () => (started = true) },
    });
    await vi.waitFor(() => expect(started).toBe(true));
    expect(audio.playingNow()).toBe(1);

    // Barge-in: fence + abort, as the UIs do.
    fence.invalidate();
    abort.abort();
    // Stop is synchronous with the abort — no audible tail from the queue.
    expect(audio.playingNow()).toBe(0);
    const result = await spoken;
    expect(result.mode).toBe("interrupted");
    expect(result.metrics.chunksPlayed).toBe(0);
    // The second chunk never became audible.
    expect(audio.created.filter((a) => !a.paused)).toHaveLength(0);
  });

  it("Test 4 — mid-sentence correction is submitted in context as an interruption", async () => {
    const calls = installFetch(({ url, body }) => {
      if (url.includes("/transcribe")) {
        return new Response(JSON.stringify({ transcript: "لا، مش هيك قصدي." }), {
          status: 200,
        });
      }
      return messageResponse(String(body?.message), "آه، فهمت. شو قصدك؟");
    });
    const flag = createTherapistInterruptedFlag();
    // Patient: "أنت بتحس…" — therapist cut in while audible.
    flag.mark();
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    const result = await runVoiceConversationTurn({
      sessionId: "s1",
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "ar",
      sessionLanguage: "ar",
      voiceEnabled: false,
      therapistInterrupted: flag.isPending(),
      onValidTurnSubmit: () => flag.consumeForSubmit(),
      turn: { turnId, isActive: (id) => fence.isActive(id) },
    });
    expect(result.ok).toBe(true);
    const msg = calls.find((c) => c.url.includes("/message"))!;
    // Same session, same history — the correction is the next turn, flagged.
    expect(msg.url).toContain("/api/sessions/s1/message");
    expect(msg.body).toEqual({
      message: "لا، مش هيك قصدي.",
      therapistInterrupted: true,
    });
    expect(flag.isPending()).toBe(false);
  });

  it("Test 5 — Arabic conversation: hesitation waits, completion commits, Arabic TTS stitched", async () => {
    // Endpointing on realistic Jordanian clinical speech.
    expect(classifyUtteranceCompleteness("والله يا دكتور صرلي فترة و")).toBe(
      "incomplete",
    );
    expect(
      classifyUtteranceCompleteness("والله يا دكتور صرلي فترة ما بنام منيح."),
    ).toBe("complete");

    installAudio({ durationMs: 2 });
    const calls = installFetch(() => audioResponse());
    const reply =
      "آه، فهمت عليك. يعني النوم صار صعب من فترة؟ احكيلي أكثر عن هاي النقطة، شو بصير معك بالليل.";
    const spoken = await playPatientSpeech({
      text: reply,
      locale: "ar",
      voiceIdAr: "R6nda3uM038xEEKi7GFl",
    });
    expect(spoken.mode).toBe("elevenlabs");
    const tts = calls.filter((c) => c.url.includes("/tts"));
    expect(tts.length).toBeGreaterThan(1);
    expect(tts.every((c) => c.body?.locale === "ar")).toBe(true);
    // Later chunks carry the earlier words as stitching context.
    expect(tts.slice(1).every((c) => typeof c.body?.previousText === "string")).toBe(
      true,
    );
    expect(joinSpeechChunks(tts.map((c) => String(c.body?.text)))).toBe(reply);
  });

  it("Test 6 — Arabic/English mixed speech stays intact through endpointing and chunking", async () => {
    const mixed = "أنا أخذت الـmedication مبارح بس ما قدرت أنام.";
    expect(classifyUtteranceCompleteness(mixed)).toBe("complete");
    const calls = installFetch(() =>
      new Response(JSON.stringify({ transcript: mixed }), { status: 200 }),
    );
    const { transcribeTherapistSpeech } = await import(
      "@/lib/voice/conversation-pipeline"
    );
    const stt = await transcribeTherapistSpeech({
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "ar",
    });
    expect(stt.ok && stt.transcript).toBe(mixed);
    expect(calls[0]!.url).toContain("/api/voice/transcribe");
    const plan = planSpeechChunksForPlayback(
      `${mixed} وبعدين صحيت الساعة ثلاثة الصبح وما رجعت نمت أبداً، وهاد صار كثير هالأسبوع.`,
    );
    expect(plan.mode).toBe("progressive");
    if (plan.mode === "progressive") {
      expect(plan.chunks.some((c) => c.includes("الـmedication"))).toBe(true);
    }
  });

  it("Test 7 — long response: progressive, ordered, no duplicated or skipped chunks", async () => {
    installAudio({ durationMs: 2 });
    const calls = installFetch(() => audioResponse());
    const reply = [
      "I've been finding it really hard to get out of bed in the mornings.",
      "Work has been piling up and I keep telling myself I'll catch up on the weekend.",
      "But then the weekend comes and I just sleep through most of it.",
      "My sister noticed and asked if I was okay, and I didn't know what to say.",
      "I think that's partly why I agreed to come today.",
    ].join(" ");
    const spoken = await playPatientSpeech({ text: reply, locale: "en" });
    const ttsTexts = calls.filter((c) => c.url.includes("/tts")).map((c) => String(c.body?.text));
    expect(spoken.playbackPath).toBe("progressive_queue");
    expect(spoken.metrics.chunkCount).toBe(ttsTexts.length);
    expect(spoken.metrics.chunksPlayed).toBe(ttsTexts.length);
    expect(new Set(ttsTexts).size).toBe(ttsTexts.length);
    expect(joinSpeechChunks(ttsTexts)).toBe(reply);
    // First audible chunk is a complete sentence, not a fragment.
    expect(ttsTexts[0]).toMatch(/[.!?]$/);
  });

  it("Test 8 — rapid interruptions: only the newest turn is ever audible", async () => {
    const audio = installAudio({ durationMs: 50 });
    installFetch(async () => {
      await sleep(3);
      return audioResponse();
    });
    const fence = createVoiceTurnFence();
    const runs: Array<Promise<{ mode: string }>> = [];
    const aborts: AbortController[] = [];
    for (let i = 0; i < 3; i++) {
      aborts.forEach((a) => a.abort());
      const turnId = fence.beginTurn();
      const abort = new AbortController();
      aborts.push(abort);
      runs.push(
        playPatientSpeech({
          text: `Reply number ${i}. It has two sentences.`,
          locale: "en",
          signal: abort.signal,
          turn: { turnId, isActive: (id) => fence.isActive(id) },
        }),
      );
      await sleep(1);
    }
    const results = await Promise.all(runs);
    expect(results.map((r) => r.mode)).toEqual(["interrupted", "interrupted", "elevenlabs"]);
    expect(audio.maxConcurrent()).toBe(1);
  });

  it("Test 9 — network delay: late STT / message / TTS results never surface", async () => {
    // Late speculative STT after the therapist resumed.
    let releaseStt!: (r: SpeculativeSttResult) => void;
    const commits: string[] = [];
    const ctrl = createEndpointController({
      locale: "en",
      transcribe: () => new Promise((r) => (releaseStt = r)),
      onCommit: (r) => commits.push(r),
    });
    ctrl.pause({ wav: new Blob([]), speechMs: 2000, silenceStartedAt: performance.now() });
    ctrl.resumed();
    releaseStt({ ok: true, transcript: "Okay." });
    await sleep(0);
    expect(commits).toEqual([]);

    // Late message response after supersede → no onMessages, no TTS.
    let releaseMsg!: () => void;
    const calls = installFetch(({ url, body }) => {
      if (url.includes("/transcribe")) {
        return new Response(JSON.stringify({ transcript: "Hello" }), { status: 200 });
      }
      if (url.includes("/message")) {
        return new Promise<Response>((r) => {
          releaseMsg = () => r(messageResponse(String(body?.message), "Hi."));
        });
      }
      return audioResponse();
    });
    const fence = createVoiceTurnFence();
    const turnId = fence.beginTurn();
    const onMessages = vi.fn();
    const pending = runVoiceConversationTurn({
      sessionId: "s1",
      audio: new Blob([new Uint8Array([1])], { type: "audio/wav" }),
      locale: "en",
      voiceEnabled: true,
      onMessages,
      turn: { turnId, isActive: (id) => fence.isActive(id) },
    });
    await vi.waitFor(() => expect(releaseMsg).toBeTypeOf("function"));
    fence.beginTurn(); // therapist moved on
    releaseMsg();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(onMessages).not.toHaveBeenCalled();
    expect(calls.some((c) => c.url.includes("/tts"))).toBe(false);
  });

  it("Test 10 — browser playback rejection: fallback path runs and never sticks in 'speaking'", async () => {
    installAudio({ durationMs: 2, rejectFirst: "NotAllowedError" });
    installFetch(() => audioResponse());
    const onstart = vi.fn();
    const onend = vi.fn();
    const onerror = vi.fn();
    const result = await playPatientSpeech({
      text: "Okay. I can try that.",
      locale: "en",
      handlers: { onstart, onend, onerror },
    });
    // play() rejection on chunk 0 → explicit legacy Blob fallback (audible).
    expect(result.playbackPath).toBe("legacy_blob");
    expect(result.mode).toBe("elevenlabs");
    // "Speaking" was cleared by a terminal handler.
    expect(onend.mock.calls.length + onerror.mock.calls.length).toBeGreaterThan(0);
    expect(onend).toHaveBeenCalled();
  });
});
