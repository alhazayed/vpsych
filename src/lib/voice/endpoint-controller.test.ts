import { describe, expect, it, vi } from "vitest";
import {
  createEndpointController,
  type EndpointControllerEvent,
  type SpeculativeSttResult,
} from "@/lib/voice/endpoint-controller";

/** Deterministic clock + timers for race tests. */
function harness() {
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let nextId = 1;
  const pendingStt: Array<{
    resolve: (r: SpeculativeSttResult) => void;
    signal: AbortSignal;
  }> = [];
  const commits: string[] = [];
  const events: EndpointControllerEvent[] = [];
  const transcribe = vi.fn(
    (_wav: Blob, signal: AbortSignal) =>
      new Promise<SpeculativeSttResult>((resolve) => {
        pendingStt.push({ resolve, signal });
      }),
  );
  const controller = createEndpointController({
    locale: "ar",
    transcribe,
    onCommit: (reason) => commits.push(reason),
    onEvent: (e) => events.push(e),
    now: () => now,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer: (h) => {
      const i = timers.findIndex((t) => t.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  const advance = async (ms: number) => {
    now += ms;
    for (const t of [...timers].sort((a, b) => a.at - b.at)) {
      if (t.at <= now) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
    }
    await Promise.resolve();
    await Promise.resolve();
  };
  const flush = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };
  const wav = new Blob([new Uint8Array([1])], { type: "audio/wav" });
  return {
    controller,
    transcribe,
    pendingStt,
    commits,
    events,
    advance,
    flush,
    wav,
    setNow: (v: number) => {
      now = v;
    },
    getNow: () => now,
  };
}

describe("two-stage endpoint controller", () => {
  it("commits immediately when the speculative transcript is a complete thought", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 2500, silenceStartedAt: 150 });
    expect(h.controller.isPending()).toBe(true);
    h.pendingStt[0]!.resolve({ ok: true, transcript: "أنا من فترة ما بنام منيح." });
    await h.flush();
    expect(h.commits).toEqual(["complete_thought"]);
    const fin = await h.controller.finalize();
    expect(fin.stt).toEqual({ ok: true, transcript: "أنا من فترة ما بنام منيح." });
    expect(fin.completeness).toBe("complete");
    // One STT call per turn in the common case.
    expect(h.transcribe).toHaveBeenCalledTimes(1);
  });

  it("does NOT commit an unfinished thought early; waits the bounded budget", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 1500, silenceStartedAt: 150 });
    h.pendingStt[0]!.resolve({ ok: true, transcript: "أنا أخذت الدوا بس" });
    await h.flush();
    expect(h.commits).toEqual([]);
    // incomplete → 2000 ms total silence; 850 ms already elapsed.
    await h.advance(1000);
    expect(h.commits).toEqual([]);
    await h.advance(200);
    expect(h.commits).toEqual(["silence_budget_met"]);
  });

  it("Test 2 — therapist resumes: pending endpoint cancelled, STT aborted, late result ignored", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 900, silenceStartedAt: 150 });
    const first = h.pendingStt[0]!;
    h.controller.resumed();
    expect(first.signal.aborted).toBe(true);
    expect(h.controller.isPending()).toBe(false);
    // Late result from the aborted speculative pass must not commit.
    first.resolve({ ok: true, transcript: "أنا من فترة" });
    await h.flush();
    expect(h.commits).toEqual([]);
    expect(h.events.some((e) => e.type === "resumed")).toBe(true);
  });

  it("after a resume, the old transcript is never reused for the committed audio", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 900, silenceStartedAt: 150 });
    h.pendingStt[0]!.resolve({ ok: true, transcript: "I've been" });
    await h.flush();
    h.controller.resumed();
    // VAD later ends via max length without a new pause.
    const fin = await h.controller.finalize();
    expect(fin.stt).toBeNull();
  });

  it("second pause after resume transcribes the full audio again and can commit", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 900, silenceStartedAt: 150 });
    h.controller.resumed();
    h.setNow(4000);
    h.controller.pause({ wav: h.wav, speechMs: 3000, silenceStartedAt: 3150 });
    h.pendingStt[1]!.resolve({
      ok: true,
      transcript: "I've been feeling exhausted for weeks.",
    });
    await h.flush();
    expect(h.commits).toEqual(["complete_thought"]);
    const fin = await h.controller.finalize();
    expect(fin.stt?.ok && fin.stt.transcript).toBe(
      "I've been feeling exhausted for weeks.",
    );
  });

  it("speculative STT failure commits and defers to the classic STT stage", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 0 });
    h.pendingStt[0]!.resolve({
      ok: false,
      error: "Speech transcription failed",
      unavailable: false,
    });
    await h.flush();
    expect(h.commits).toEqual(["stt_failed"]);
    const fin = await h.controller.finalize();
    expect(fin.stt).toBeNull();
  });

  describe("early speculative pause (starts STT before a thought may commit)", () => {
    it("a complete thought transcribed early still waits for the 850 ms floor", async () => {
      const h = harness();
      h.setNow(500);
      h.controller.pause({ wav: h.wav, speechMs: 2500, silenceStartedAt: 0 });
      h.setNow(700);
      h.pendingStt[0]!.resolve({ ok: true, transcript: "How have you been sleeping?" });
      await h.flush();
      expect(h.commits).toEqual([]);
      await h.advance(149);
      expect(h.commits).toEqual([]);
      await h.advance(1);
      expect(h.commits).toEqual(["complete_thought"]);
      const fin = await h.controller.finalize();
      expect(fin.stt).toEqual({ ok: true, transcript: "How have you been sleeping?" });
    });

    it("speaking again before the floor cancels the commit and reuses nothing", async () => {
      const h = harness();
      h.setNow(500);
      h.controller.pause({ wav: h.wav, speechMs: 2500, silenceStartedAt: 0 });
      h.setNow(650);
      h.pendingStt[0]!.resolve({ ok: true, transcript: "I wanted to ask." });
      await h.flush();
      h.controller.resumed();
      await h.advance(1000);
      expect(h.commits).toEqual([]);
      const fin = await h.controller.finalize();
      expect(fin.stt).toBeNull();
    });

    it("an early STT failure does not cut the speaker off before the floor", async () => {
      const h = harness();
      h.setNow(500);
      h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 0 });
      h.pendingStt[0]!.resolve({ ok: false, error: "rate limited", unavailable: false });
      await h.flush();
      expect(h.commits).toEqual([]);
      await h.advance(350);
      expect(h.commits).toEqual(["stt_failed"]);
    });

    it("an early empty transcript (noise) waits for the floor too", async () => {
      const h = harness();
      h.setNow(500);
      h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 0 });
      h.pendingStt[0]!.resolve({ ok: true, transcript: "  " });
      await h.flush();
      expect(h.commits).toEqual([]);
      await h.advance(350);
      expect(h.commits).toEqual(["silence_budget_met"]);
    });
  });

  it("finalize awaits an in-flight speculative pass (VAD max-silence commit)", async () => {
    const h = harness();
    h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 0 });
    const finP = h.controller.finalize();
    h.pendingStt[0]!.resolve({ ok: true, transcript: "and" });
    const fin = await finP;
    expect(fin.stt).toEqual({ ok: true, transcript: "and" });
  });

  it("commit is emitted at most once", async () => {
    const h = harness();
    h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 0 });
    h.pendingStt[0]!.resolve({ ok: true, transcript: "Okay" });
    await h.flush();
    await h.controller.finalize();
    expect(h.events.filter((e) => e.type === "commit")).toHaveLength(1);
  });

  it("cancel aborts everything and finalize yields no transcript", async () => {
    const h = harness();
    h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 0 });
    const stt = h.pendingStt[0]!;
    h.controller.cancel();
    expect(stt.signal.aborted).toBe(true);
    stt.resolve({ ok: true, transcript: "Okay" });
    await h.flush();
    expect(h.commits).toEqual([]);
    expect((await h.controller.finalize()).stt).toBeNull();
  });

  it("voice activity holds a due commit until the resume is confirmed (no race)", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 900, silenceStartedAt: 150 });
    h.pendingStt[0]!.resolve({ ok: true, transcript: "أنا من فترة" });
    await h.flush();
    // Therapist starts speaking again just before the budget expires …
    await h.advance(500);
    h.controller.activity(true);
    // … the budget expires while confirmation is still pending.
    await h.advance(300);
    expect(h.commits).toEqual([]);
    h.controller.resumed();
    expect(h.commits).toEqual([]);
    expect(h.controller.isPending()).toBe(false);
  });

  it("activity that dies out (cough / noise) releases the deferred commit", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 900, silenceStartedAt: 150 });
    h.pendingStt[0]!.resolve({ ok: true, transcript: "أنا من فترة" });
    await h.flush();
    h.controller.activity(true);
    await h.advance(1000);
    expect(h.commits).toEqual([]);
    h.controller.activity(false);
    expect(h.commits).toEqual(["silence_budget_met"]);
  });

  it("reports no trailing silence when the capture ends without a pause", async () => {
    const h = harness();
    h.setNow(27678);
    await h.controller.finalize();
    const commit = h.events.find((e) => e.type === "commit");
    expect(commit).toMatchObject({ reason: "vad_finished", silenceMs: 0 });
  });

  it("reports no trailing silence when speech resumed after the last pause", async () => {
    const h = harness();
    h.setNow(1000);
    h.controller.pause({ wav: h.wav, speechMs: 2000, silenceStartedAt: 400 });
    h.controller.resumed();
    h.setNow(9000);
    await h.controller.finalize();
    const commit = h.events.find((e) => e.type === "commit");
    expect(commit).toMatchObject({ silenceMs: 0 });
  });
});
