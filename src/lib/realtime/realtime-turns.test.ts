import { describe, expect, it, vi } from "vitest";
import { createSseParser } from "@/lib/realtime/sse-parser";
import { createTurnFence } from "@/lib/realtime/turn-fence";
import {
  createSentenceSegmenter,
  segmentForSpeech,
} from "@/lib/realtime/sentence-segmenter";
import {
  createProgressiveSpeechQueue,
  type ProgressiveSpeechDeps,
  type SpeechChunkAudio,
} from "@/lib/realtime/progressive-tts";
import { submitStreamingConversationTurn } from "@/lib/realtime/client-pipeline";
import { encodeSse } from "@/lib/realtime/llm-streaming";
import { isRealtimeStreamingEnabled } from "@/lib/realtime/feature-flag";
import { createSpeechReleaseGate } from "@/lib/sessions/speech-release-gate";
import type { StreamEvent } from "@/lib/realtime/types";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/* ───────────────────────────── SSE parser ───────────────────────────── */

describe("createSseParser", () => {
  it("parses events split at arbitrary byte positions and CRLF boundaries", () => {
    const wire =
      'event: token\r\ndata: {"a":1}\r\n\r\n: keepalive comment\n\nevent: done\ndata: line1\ndata: line2\n\n';
    for (let split = 1; split < wire.length; split++) {
      const p = createSseParser();
      const out = [...p.push(wire.slice(0, split)), ...p.push(wire.slice(split))];
      expect(out).toEqual([
        { event: "token", data: '{"a":1}', id: undefined },
        { event: "done", data: "line1\nline2", id: undefined },
      ]);
    }
  });

  it("drops a trailing message that never received its blank line", () => {
    const p = createSseParser();
    expect(p.push("event: token\ndata: x\n")).toEqual([]);
    p.end();
    expect(p.push("\n")).toEqual([]);
  });
});

/* ───────────────────────────── turn fence ───────────────────────────── */

describe("createTurnFence", () => {
  it("advances monotonically and aborts the superseded ticket", () => {
    const fence = createTurnFence();
    const a = fence.begin();
    expect(a.isCurrent()).toBe(true);
    const b = fence.begin();
    expect(b.generation).toBeGreaterThan(a.generation);
    expect(a.signal.aborted).toBe(true);
    expect(a.isCurrent()).toBe(false);
    expect(b.isCurrent()).toBe(true);
    expect(fence.invalidate()).toBe(true);
    expect(b.isCurrent()).toBe(false);
    expect(fence.invalidate()).toBe(false);
  });
});

/* ───────────────────────────── segmenter ───────────────────────────── */

describe("createSentenceSegmenter", () => {
  it("emits a sentence only once its boundary is certain", () => {
    const seg = createSentenceSegmenter();
    expect(seg.push("I took 2.")).toEqual([]); // "." may be a decimal / mid-token
    expect(seg.push("5 mg. Then")).toEqual(["I took 2.5 mg."]);
    expect(seg.push(" I stopped.")).toEqual([]);
    expect(seg.flush()).toEqual(["Then I stopped."]);
  });

  it("handles Arabic punctuation and splits long sentences at phrase boundaries", () => {
    expect(segmentForSpeech("ما بعرف؟ يمكن. ")).toEqual(["ما بعرف؟", "يمكن."]);
    const long = `${"word ".repeat(30)}, and then ${"more ".repeat(30)}`;
    const parts = segmentForSpeech(long, { maxChars: 120 });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 120)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long.trim().replace(/\s+/g, " "));
  });
});

/* ───────────────────────── speech release gate ───────────────────────── */

describe("createSpeechReleaseGate", () => {
  const meds = [
    {
      id: "m1",
      owner: "patient" as const,
      status: "never_taken" as const,
      agent_class: "ssri",
      agent_names: ["sertraline"],
    },
  ];

  it("releases fact-free sentences and latches at the first exposure", () => {
    const gate = createSpeechReleaseGate({ age: 30, medications: meds, therapistMessage: "How are you?" });
    expect(gate.offer("Not great.")).toEqual(["Not great."]);
    expect(gate.offer("I'm 31 now.")).toEqual([]);
    expect(gate.offer("Anyway.")).toEqual([]);
    expect(gate.latched()).toBe(true);
    expect(gate.drain()).toEqual(["I'm 31 now.", "Anyway."]);
  });

  it("holds contentless openers until real words arrive, and everything when meds are named", () => {
    const gate = createSpeechReleaseGate({ medications: meds, therapistMessage: "hi" });
    expect(gate.offer("Um…")).toEqual([]);
    expect(gate.offer("I guess okay.")).toEqual(["Um…", "I guess okay."]);
    const held = createSpeechReleaseGate({
      medications: meds,
      therapistMessage: "Do you take sertraline?",
    });
    expect(held.offer("No.")).toEqual([]);
    expect(held.drain()).toEqual(["No."]);
  });
});

/* ───────────────────────── progressive TTS queue ───────────────────────── */

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function ttsHarness(opts: { current?: () => boolean } = {}) {
  const synth: Array<{ text: string; signal: AbortSignal; d: ReturnType<typeof deferred<SpeechChunkAudio>> }> = [];
  const plays: Array<{ text: string; signal: AbortSignal; d: ReturnType<typeof deferred<void>> }> = [];
  const revoked: string[] = [];
  let urlN = 0;
  const deps: ProgressiveSpeechDeps = {
    isCurrent: opts.current ?? (() => true),
    revoke: (url) => revoked.push(url),
    synthesize: (text, signal) => {
      const d = deferred<SpeechChunkAudio>();
      synth.push({ text, signal, d });
      return d.promise;
    },
    play: (_audio, text, signal) => {
      const d = deferred<void>();
      plays.push({ text, signal, d });
      signal.addEventListener("abort", () => d.resolve(), { once: true });
      return d.promise;
    },
    wait: async () => {},
  };
  const audio = (): SpeechChunkAudio => ({ kind: "audio", url: `blob:${++urlN}` });
  return { deps, synth, plays, revoked, audio };
}

describe("createProgressiveSpeechQueue", () => {
  it("bounds concurrency to 2 and plays strictly in order even when TTS resolves out of order", async () => {
    const h = ttsHarness();
    const q = createProgressiveSpeechQueue(h.deps);
    q.enqueue("One.");
    q.enqueue("Two.");
    q.enqueue("Three.");
    expect(h.synth.map((s) => s.text)).toEqual(["One.", "Two."]);
    h.synth[1]!.d.resolve(h.audio()); // chunk 2 ready first
    await tick();
    expect(h.plays).toHaveLength(0); // must wait for chunk 1
    expect(h.synth.map((s) => s.text)).toEqual(["One.", "Two.", "Three."]);
    h.synth[0]!.d.resolve(h.audio());
    await tick();
    expect(h.plays.map((p) => p.text)).toEqual(["One."]);
    h.plays[0]!.d.resolve();
    await tick();
    expect(h.plays.map((p) => p.text)).toEqual(["One.", "Two."]);
    h.synth[2]!.d.resolve(h.audio());
    h.plays[1]!.d.resolve();
    await tick();
    expect(h.plays.map((p) => p.text)).toEqual(["One.", "Two.", "Three."]);
    q.close();
    h.plays[2]!.d.resolve();
    expect(await q.settled).toBe("completed");
    expect(q.stats().maxInFlight).toBeLessThanOrEqual(2);
    expect(new Set(h.revoked)).toEqual(new Set(["blob:1", "blob:2", "blob:3"]));
  });

  it("caps pending chunks at 6 without dropping or reordering text", async () => {
    const h = ttsHarness();
    const q = createProgressiveSpeechQueue(h.deps, { maxQueued: 6 });
    for (let i = 1; i <= 10; i++) q.enqueue(`S${i}.`);
    expect(q.stats().chunks).toBe(6);
    // Overflow merged into the last not-yet-synthesized chunk, in order.
    expect(q.stats().pending).toBe(6);
    // Drain everything and check spoken order.
    for (let guard = 0; guard < 50 && h.plays.length < q.stats().chunks; guard++) {
      for (const s of h.synth) s.d.resolve(h.audio());
      await tick();
      for (const p of h.plays) p.d.resolve();
      await tick();
    }
    q.close();
    for (const s of h.synth) s.d.resolve(h.audio());
    for (const p of h.plays) p.d.resolve();
    await tick();
    const spoken = h.plays.map((p) => p.text).join(" ");
    expect(spoken).toBe(Array.from({ length: 10 }, (_, i) => `S${i + 1}.`).join(" "));
    expect(await q.settled).toBe("completed");
  });

  it("barge-in abort stops playback, aborts in-flight TTS, revokes URLs, and plays nothing late", async () => {
    const h = ttsHarness();
    const q = createProgressiveSpeechQueue(h.deps);
    q.enqueue("One.");
    q.enqueue("Two.");
    q.enqueue("Three.");
    h.synth[0]!.d.resolve(h.audio());
    h.synth[1]!.d.resolve(h.audio()); // ready, waiting to play
    await tick();
    expect(h.plays).toHaveLength(1);
    q.abort();
    expect(h.plays[0]!.signal.aborted).toBe(true);
    expect(h.synth[0]!.signal.aborted).toBe(true);
    await tick();
    // Late TTS result after abort is revoked and never played.
    h.synth[2]!.d.resolve(h.audio());
    await tick();
    expect(h.plays).toHaveLength(1);
    expect(new Set(h.revoked)).toEqual(new Set(["blob:1", "blob:2", "blob:3"]));
    expect(q.enqueue("Four.")).toBe(false);
    expect(await q.settled).toBe("aborted");
  });

  it("a stale turn (fence advanced) never resumes playback", async () => {
    let current = true;
    const h = ttsHarness({ current: () => current });
    const q = createProgressiveSpeechQueue(h.deps);
    q.enqueue("Old turn sentence.");
    current = false; // a new therapist turn started
    h.synth[0]!.d.resolve(h.audio());
    await tick();
    expect(h.plays).toHaveLength(0);
    expect(h.revoked).toEqual(["blob:1"]);
  });
});

/* ───────────────────────── client SSE turn ───────────────────────── */

function sseResponse(events: StreamEvent[], opts: { chunkSize?: number } = {}) {
  const wire = events.map((e) => encodeSse(e)).join("");
  const bytes = new TextEncoder().encode(wire);
  const size = opts.chunkSize ?? 7;
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

let seqN = 0;
const ev = (type: StreamEvent["type"], payload: Record<string, unknown> = {}): StreamEvent => ({
  type,
  ts: 0,
  sequence: ++seqN,
  payload: { turnId: "t1", ...payload },
});

const userMessage = { id: "u1", session_id: "s", role: "user", content: "hi", created_at: "" };
const assistantMessage = { id: "a1", session_id: "s", role: "assistant", content: "Fine.", created_at: "" };

describe("submitStreamingConversationTurn", () => {
  it("parses tokens/sentences, fences older attempts, and returns the persisted reply", async () => {
    seqN = 0;
    const events = [
      ev("started", { userMessage }),
      ev("token", { attempt: 1, token: "Yeah ", text: "Yeah " }),
      ev("regenerating", { attempt: 2, reason: "canonical_rejected" }),
      ev("token", { attempt: 1, token: "stale", text: "stale" }), // older attempt
      ev("token", { attempt: 2, token: "Fine.", text: "Fine." }),
      ev("sentence", { attempt: 2, index: 0, text: "Fine.", validated: true }),
      { ...ev("token", { attempt: 2, token: "dup", text: "dup" }), sequence: 3 }, // replay
      { ...ev("token", { attempt: 2, token: "x", text: "x" }), payload: { turnId: "other", attempt: 2, token: "x" } },
      ev("done", { userMessage, assistantMessage, aiSource: "gpt", locale: "en" }),
    ];
    const tokens: string[] = [];
    const sentences: string[] = [];
    const regen: number[] = [];
    const result = await submitStreamingConversationTurn({
      sessionId: "s",
      message: "hi",
      clientTurnId: "t1",
      fetchImpl: async () => sseResponse(events),
      handlers: {
        onToken: (t) => tokens.push(t),
        onSentence: (s) => sentences.push(s.text),
        onRegenerating: (r) => regen.push(r.attempt),
      },
    });
    expect(tokens).toEqual(["Yeah ", "Fine."]);
    expect(sentences).toEqual(["Fine."]);
    expect(regen).toEqual([2]);
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.data.assistantMessage.content).toBe("Fine.");
    expect(result.aiSource).toBe("gpt");
  });

  it("distinguishes interrupted from failed and never reports a partial as completed", async () => {
    seqN = 0;
    const interrupted = await submitStreamingConversationTurn({
      sessionId: "s",
      message: "hi",
      fetchImpl: async () =>
        sseResponse([
          ev("started", { userMessage }),
          ev("token", { attempt: 1, token: "I was", text: "I was" }),
          ev("interrupted", { reason: "aborted" }),
        ]),
    });
    expect(interrupted).toMatchObject({ status: "interrupted", partialText: "I was" });

    seqN = 0;
    const truncated = await submitStreamingConversationTurn({
      sessionId: "s",
      message: "hi",
      fetchImpl: async () =>
        sseResponse([ev("started", { userMessage }), ev("token", { attempt: 1, token: "I", text: "I" })]),
    });
    expect(truncated).toMatchObject({
      status: "failed",
      error: "stream_incomplete",
      fallbackToClassic: false,
    });
  });

  it("aborting the signal ends the turn as interrupted and stops callbacks", async () => {
    seqN = 0;
    const controller = new AbortController();
    const tokens: string[] = [];
    let pullCount = 0;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        pullCount += 1;
        if (pullCount === 1) c.enqueue(encoder.encode(encodeSse(ev("started", { userMessage }))));
        else if (pullCount === 2) c.enqueue(encoder.encode(encodeSse(ev("token", { attempt: 1, token: "a", text: "a" }))));
        else {
          await tick();
          c.enqueue(encoder.encode(encodeSse(ev("token", { attempt: 1, token: "b", text: "ab" }))));
        }
      },
    });
    const result = await submitStreamingConversationTurn({
      sessionId: "s",
      message: "hi",
      fetchImpl: async () => new Response(body, { headers: { "Content-Type": "text/event-stream" } }),
      handlers: {
        signal: controller.signal,
        onToken: (t) => {
          tokens.push(t);
          controller.abort();
        },
      },
    });
    expect(result.status).toBe("interrupted");
    expect(tokens).toEqual(["a"]);
  });

  it("returns stale (no callbacks) once the turn fence moves on", async () => {
    seqN = 0;
    const fence = createTurnFence();
    const ticket = fence.begin();
    const onToken = vi.fn();
    const result = await submitStreamingConversationTurn({
      sessionId: "s",
      message: "hi",
      isCurrent: ticket.isCurrent,
      fetchImpl: async () => {
        fence.begin(); // a newer turn starts while this request is in flight
        return sseResponse([ev("started", { userMessage }), ev("token", { token: "x", text: "x" })]);
      },
      handlers: { onToken },
    });
    expect(["stale", "interrupted"]).toContain(result.status);
    expect(onToken).not.toHaveBeenCalled();
  });

  it("falls back to classic only when the stream route refused before persisting", async () => {
    const json = (status: number, body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const run = (res: Response) =>
      submitStreamingConversationTurn({ sessionId: "s", message: "hi", fetchImpl: async () => res });
    expect(await run(json(404, { error: "Realtime streaming is not enabled" }))).toMatchObject({
      status: "failed",
      fallbackToClassic: true,
    });
    expect(await run(json(502, { error: "x" }))).toMatchObject({ fallbackToClassic: true });
    expect(await run(json(409, { error: "Session time expired", expired: true }))).toMatchObject({
      fallbackToClassic: false,
      expired: true,
    });
    expect(await run(json(429, { error: "Too many requests" }))).toMatchObject({ fallbackToClassic: false });
    const network = await submitStreamingConversationTurn({
      sessionId: "s",
      message: "hi",
      fetchImpl: async () => {
        throw new TypeError("network");
      },
    });
    expect(network).toMatchObject({ status: "failed", fallbackToClassic: false });
  });
});

/* ───────────────────────────── feature flag ───────────────────────────── */

describe("isRealtimeStreamingEnabled", () => {
  it("requires the simulation flag AND an explicit streaming opt-in", () => {
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "true");
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_REALTIME_STREAMING", "");
    expect(isRealtimeStreamingEnabled()).toBe(false);
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "true");
    expect(isRealtimeStreamingEnabled()).toBe(true);
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_REALTIME_SIMULATION", "");
    expect(isRealtimeStreamingEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
