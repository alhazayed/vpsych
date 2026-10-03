import { afterEach, describe, expect, it, vi } from "vitest";
import type { PatientReplyStreamResult } from "@/lib/ai/patient-agent";
import type { PreparedClinicalTurn } from "@/lib/sessions/clinical-turn";
import {
  runStreamingClinicalTurn,
  type StreamTurnDeps,
  type StreamTurnEventType,
} from "@/lib/sessions/stream-turn";

type Recorded = { type: StreamTurnEventType; payload: Record<string, unknown> };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const SERTRALINE = {
  id: "sertraline_never",
  owner: "patient",
  status: "never_taken",
  agent_class: "ssri",
  agent_names: ["sertraline", "zoloft"],
};

function fakeTurn(over: Partial<PreparedClinicalTurn> = {}): PreparedClinicalTurn {
  return {
    sessionId: "session-1",
    userId: "user-1",
    message: "How have you been sleeping?",
    therapistInterrupted: false,
    supabase: {} as never,
    session: {
      id: "session-1",
      language: "en",
      started_at: new Date().toISOString(),
      max_duration_sec: 2400,
      avatars: { slug: null },
    } as never,
    resolved: { language: "en" } as never,
    avatarForReply: {
      name: "Test Patient",
      disorder: "MDD",
      system_prompt: "You are the patient.",
      fallback_replies: ["I don't really know."],
      per_turn_reinforcement: "",
      age: 34,
      locale: "en-US",
      clinical_core: { age: 34, case_file: { medications: [SERTRALINE] } },
    } as never,
    historyRows: [{ role: "user", content: "How have you been sleeping?" }],
    turnIndex: 0,
    userMsg: {
      id: "user-msg-42",
      session_id: "session-1",
      role: "user",
      content: "How have you been sleeping?",
      created_at: new Date().toISOString(),
    },
    emotionPayload: null,
    behaviourPlan: null,
    decisionPlan: null,
    humanization: null,
    ...over,
  };
}

/** A provider stand-in that yields tokens one event-loop turn apart. */
function scriptedStream(
  drafts: string[][],
  log: string[],
  seen: { signals: AbortSignal[]; reinforcements: (string | null)[] },
): StreamTurnDeps["streamDraft"] {
  let call = 0;
  return async (input) => {
    seen.signals.push(input.signal);
    seen.reinforcements.push(input.behaviourReinforcement);
    const tokens = drafts[Math.min(call, drafts.length - 1)]!;
    call += 1;
    let text = "";
    for (const token of tokens) {
      await tick();
      if (input.signal.aborted) {
        return { text, aiSource: "gpt", interrupted: true };
      }
      text += token;
      log.push(`gen:${token}`);
      input.onToken(token, text);
    }
    return {
      text: text.trim(),
      aiSource: "gpt",
      model: "gpt-5",
      interrupted: false,
    } satisfies PatientReplyStreamResult;
  };
}

function harness(opts: {
  drafts: string[][];
  turn?: PreparedClinicalTurn;
  classicText?: string;
  streamThrows?: boolean;
  persistFails?: boolean;
  abortAfterTokens?: number;
}) {
  const events: Recorded[] = [];
  const log: string[] = [];
  const seen = { signals: [] as AbortSignal[], reinforcements: [] as (string | null)[] };
  const controller = new AbortController();
  const persist = vi.fn(async (turn: PreparedClinicalTurn, content: string) => {
    log.push("persist");
    if (opts.persistFails) return { ok: false as const, error: { message: "boom" } };
    return {
      ok: true as const,
      assistantMsg: {
        id: "assistant-1",
        session_id: turn.sessionId,
        role: "assistant" as const,
        content,
        created_at: new Date().toISOString(),
      },
    };
  });
  const classicDraft = vi.fn(async () => ({
    text: opts.classicText ?? "Classic reply.",
    aiSource: "gpt" as const,
    model: "gpt-5",
  }));
  let tokens = 0;
  const stream = scriptedStream(opts.drafts, log, seen);
  const streamDraft: StreamTurnDeps["streamDraft"] = opts.streamThrows
    ? async (input) => {
        input.onToken("Partial ", "Partial ");
        await tick();
        throw new Error("provider stream broke");
      }
    : stream;
  const emit = (type: StreamTurnEventType, payload: Record<string, unknown>) => {
    events.push({ type, payload });
    log.push(`emit:${type}`);
    if (type === "token") {
      tokens += 1;
      if (opts.abortAfterTokens && tokens >= opts.abortAfterTokens) {
        controller.abort();
      }
    }
  };
  const run = () =>
    runStreamingClinicalTurn({
      turn: opts.turn ?? fakeTurn(),
      signal: controller.signal,
      emit,
      deps: { streamDraft, classicDraft, persist },
    });
  return { events, log, seen, controller, persist, classicDraft, run };
}

const ofType = (events: Recorded[], type: StreamTurnEventType) =>
  events.filter((e) => e.type === type);

describe("runStreamingClinicalTurn", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits each provider token as it is generated (true streaming, not a reveal)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({ drafts: [["I ", "haven't ", "slept ", "well."]] });
    await h.run();
    const generated = h.log.filter((l) => l.startsWith("gen:") || l === "emit:token");
    // gen:I → emit:token → gen:haven't → emit:token … strictly interleaved:
    // every token is emitted before the provider produces the next one.
    expect(generated).toEqual([
      "gen:I ",
      "emit:token",
      "gen:haven't ",
      "emit:token",
      "gen:slept ",
      "emit:token",
      "gen:well.",
      "emit:token",
    ]);
    expect(ofType(h.events, "token").map((e) => e.payload.token)).toEqual([
      "I ",
      "haven't ",
      "slept ",
      "well.",
    ]);
  });

  it("completes: started → tokens → sentences → persist → done", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({ drafts: [["Not great. ", "I wake up a lot."]] });
    const outcome = await h.run();
    expect(outcome).toBe("done");
    expect(h.events[0]!.type).toBe("started");
    expect((h.events[0]!.payload.userMessage as { id: string }).id).toBe("user-msg-42");
    const sentences = ofType(h.events, "sentence").map((e) => e.payload.text);
    expect(sentences).toEqual(["Not great.", "I wake up a lot."]);
    // First sentence released while streaming, before the reply was validated.
    expect(ofType(h.events, "sentence")[0]!.payload.validated).toBe(false);
    expect(h.persist).toHaveBeenCalledTimes(1);
    expect(h.persist.mock.calls[0]![1]).toBe("Not great. I wake up a lot.");
    // done is last and strictly after persistence.
    expect(h.events.at(-1)!.type).toBe("done");
    expect(h.log.indexOf("persist")).toBeLessThan(h.log.lastIndexOf("emit:done"));
    const done = h.events.at(-1)!.payload;
    expect((done.assistantMessage as { content: string }).content).toBe(
      "Not great. I wake up a lot.",
    );
    expect(done.aiSource).toBe("gpt");
  });

  it("propagates the turn AbortSignal into generation", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({ drafts: [["Okay."]] });
    await h.run();
    expect(h.seen.signals).toHaveLength(1);
    expect(h.seen.signals[0]).toBe(h.controller.signal);
  });

  it("interruption: abort stops tokens, emits interrupted, never persists partial text", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({
      drafts: [["I ", "keep ", "thinking ", "about ", "work."]],
      abortAfterTokens: 2,
    });
    const outcome = await h.run();
    expect(outcome).toBe("interrupted");
    expect(ofType(h.events, "token")).toHaveLength(2);
    expect(h.events.at(-1)!.type).toBe("interrupted");
    expect(h.events.at(-1)!.payload.assistantPersisted).toBe(false);
    expect(ofType(h.events, "done")).toHaveLength(0);
    expect(h.persist).not.toHaveBeenCalled();
    expect(h.classicDraft).not.toHaveBeenCalled();
    // Generation stopped at the abort; later tokens were never produced.
    expect(h.log).not.toContain("gen:about ");
  });

  it("aborted before persistence: validated reply is still not persisted", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({ drafts: [["Fine."]] });
    const persist = h.persist;
    const p = runStreamingClinicalTurn({
      turn: fakeTurn(),
      signal: h.controller.signal,
      emit: (type, payload) => {
        h.events.push({ type, payload });
        if (type === "token") queueMicrotask(() => h.controller.abort());
      },
      deps: {
        streamDraft: async (input) => {
          input.onToken("Fine.", "Fine.");
          await tick();
          return { text: "Fine.", aiSource: "gpt", interrupted: false };
        },
        persist,
      },
    });
    expect(await p).toBe("interrupted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("canonical gate rejects the streamed draft: regenerates, streams the replacement, persists only it", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const turn = fakeTurn({ message: "You're 35, right?" });
    const h = harness({
      turn,
      drafts: [["Yeah, ", "35."], ["No, ", "I'm 34."]],
    });
    const outcome = await h.run();
    expect(outcome).toBe("done");
    const regen = ofType(h.events, "regenerating");
    expect(regen).toHaveLength(1);
    expect(regen[0]!.payload).toMatchObject({ attempt: 2, reason: "canonical_rejected" });
    // The correction cue is the same one the classic route uses.
    expect(h.seen.reinforcements[1]).toMatch(/contradicts your authored history/);
    expect(h.persist).toHaveBeenCalledTimes(1);
    expect(h.persist.mock.calls[0]![1]).toBe("No, I'm 34.");
    // Fact-bearing drafts are never spoken before validation: no sentence of
    // attempt 1 was released, attempt 2 only after persistence.
    const sentences = ofType(h.events, "sentence");
    expect(sentences.every((s) => s.payload.attempt === 2)).toBe(true);
    expect(sentences.every((s) => s.payload.validated === true)).toBe(true);
    expect(h.log.indexOf("persist")).toBeLessThan(h.log.indexOf("emit:sentence"));
  });

  it("rejected twice → persona fallback replaces the draft and is persisted", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({
      turn: fakeTurn({ message: "You're 35, right?" }),
      drafts: [["Yeah, 35."], ["Yes, 35."]],
    });
    expect(await h.run()).toBe("done");
    const regen = ofType(h.events, "regenerating").map((e) => e.payload.reason);
    expect(regen).toEqual(["canonical_rejected", "persona_fallback"]);
    expect(h.persist.mock.calls[0]![1]).toBe("I don't really know.");
    expect(h.events.at(-1)!.payload.aiSource).toBe("persona_fallback");
  });

  it("stream failure after partial output → partial discarded, classic generator answers", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness({ drafts: [[]], streamThrows: true, classicText: "I sleep badly." });
    expect(await h.run()).toBe("done");
    expect(h.classicDraft).toHaveBeenCalledTimes(1);
    expect(ofType(h.events, "regenerating")[0]!.payload.reason).toBe("stream_failed");
    expect(h.persist).toHaveBeenCalledTimes(1);
    expect(h.persist.mock.calls[0]![1]).toBe("I sleep badly.");
    expect(h.persist.mock.calls[0]![1]).not.toContain("Partial");
  });

  it("speech gate: holds every sentence when the therapist names an authored medication", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({
      turn: fakeTurn({ message: "Are you still taking sertraline?" }),
      drafts: [["No. ", "I never started it."]],
    });
    expect(await h.run()).toBe("done");
    const sentences = ofType(h.events, "sentence");
    expect(sentences.map((s) => s.payload.text)).toEqual(["No.", "I never started it."]);
    expect(sentences.every((s) => s.payload.validated === true)).toBe(true);
    expect(h.log.indexOf("persist")).toBeLessThan(h.log.indexOf("emit:sentence"));
  });

  it("speech gate: latches at the first fact-bearing sentence", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({
      drafts: [["It's been rough. ", "I'm 34 and still ", "can't sleep."]],
    });
    expect(await h.run()).toBe("done");
    const sentences = ofType(h.events, "sentence").map((s) => [
      s.payload.text,
      s.payload.validated,
    ]);
    expect(sentences).toEqual([
      ["It's been rough.", false],
      ["I'm 34 and still can't sleep.", true],
    ]);
  });

  it("persistence failure → error event, no done, nothing else spoken", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({ drafts: [["I'm 34."]], persistFails: true });
    expect(await h.run()).toBe("error");
    expect(h.events.at(-1)!.type).toBe("error");
    expect(h.events.at(-1)!.payload.assistantPersisted).toBe(false);
    expect(ofType(h.events, "done")).toHaveLength(0);
    expect(ofType(h.events, "sentence")).toHaveLength(0);
  });

  it("CBE direct reply skips the model but still validates, persists and speaks", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const h = harness({
      turn: fakeTurn({
        behaviourPlan: { directReply: "…I don't want to talk about that." } as never,
      }),
      drafts: [["unused"]],
    });
    expect(await h.run()).toBe("done");
    expect(h.seen.signals).toHaveLength(0);
    expect(h.persist.mock.calls[0]![1]).toBe("…I don't want to talk about that.");
    expect(ofType(h.events, "sentence").map((s) => s.payload.text)).toEqual([
      "…I don't want to talk about that.",
    ]);
    expect(h.events.at(-1)!.payload.aiSource).toBe("cbe_direct");
  });
});
