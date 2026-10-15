/**
 * Route-level tests for POST /api/sessions/:id/message (classic) and
 * POST /api/sessions/:id/message/stream (realtime SSE).
 *
 * Real: route handlers, prepareClinicalTurn (engines soft-fail on the fake
 * DB exactly as they do on a missing table), resolveAvatar, canonical gate,
 * prepareMessageRpc HMAC signing. Faked: Supabase client, rate limiter, and
 * the model calls in patient-agent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { sealSkillTestCase } from "@/lib/skill-tests";
import {
  ctx,
  fakeSupabase,
  post,
  readSse,
  SESSION_ID,
  USER_MSG_ID,
} from "@/lib/sessions/__fixtures__/route-fakes";

const TEST_ID = "44444444-4444-4444-8444-444444444444";
const EXAM_CASE = {
  version: 2,
  assessment_id: "VPSY-T",
  locale: "en-US",
  primary_diagnosis: { id: "d1", slug: "ptsd", name: "Posttraumatic stress disorder" },
  comorbidities: [],
} as unknown as CaseInstanceSnapshot;

/**
 * A skill test of EXAM_CASE: the row holds only the locale and the case is
 * sealed. `fullSnapshot` runs the same case as a practice session.
 */
function examSession() {
  const sealedCase = sealSkillTestCase(TEST_ID, EXAM_CASE);
  expect(sealedCase).toBeTruthy();
  return {
    fullSnapshot: EXAM_CASE as unknown as Record<string, unknown>,
    rowOpts: {
      snapshot: { locale: "en-US" },
      sessionExtra: { skill_test_assignment_id: TEST_ID, sealed_case: sealedCase },
    },
  };
}

const state = vi.hoisted(() => ({
  supabase: null as unknown,
  detailed: [] as Array<(input: Record<string, unknown>) => unknown>,
  stream: null as null | ((input: Record<string, unknown>) => unknown),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));
vi.mock("@/lib/ai/patient-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/patient-agent")>();
  return {
    ...actual,
    generatePatientReplyDetailed: vi.fn(async (input: Record<string, unknown>) => {
      const next = state.detailed.shift();
      if (!next) throw new Error("unexpected classic generation");
      return next(input);
    }),
    generatePatientReplyStream: vi.fn(async (input: Record<string, unknown>) => {
      if (!state.stream) throw new Error("unexpected stream generation");
      return state.stream(input);
    }),
  };
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("REPORT_WRITE_KEY", "unit-test-report-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.detailed = [];
  state.stream = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/sessions/:id/message (classic regression)", () => {
  it("persists the validated reply via the 4-arg RPC linked to the therapist message", async () => {
    const db = fakeSupabase();
    state.supabase = db.client;
    state.detailed.push(() => ({ text: "I worry all the time.", aiSource: "gpt", model: "gpt-5" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const res = await POST(post("message", { message: "What brings you in?" }), ctx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect((json.assistantMessage as { content: string }).content).toBe("I worry all the time.");
    expect((json.userMessage as { id: string }).id).toBe(USER_MSG_ID);
    expect(json.aiSource).toBe("gpt");
    expect(res.headers.get("X-AI-Source")).toBe("gpt");
    // Response keeps every additive field of the pre-refactor contract.
    for (const key of [
      "remainingSeconds", "locale", "aiModel", "aiErrorKind", "emotion", "cbeEnabled",
      "cbePrimary", "cbeDisclosureGate", "cbeRapport", "decisionSpeak", "decisionAct",
      "decisionDisclosure", "decisionCognitiveMove", "humanizationEnabled",
      "humanization", "voiceHints",
    ]) {
      expect(json).toHaveProperty(key);
    }
    const rpc = db.rpcCalls.filter((c) => c.name === "insert_assistant_message");
    expect(rpc).toHaveLength(1);
    expect(rpc[0]!.args).toMatchObject({
      p_session_id: SESSION_ID,
      p_content: "I worry all the time.",
      p_user_message_id: USER_MSG_ID,
    });
    expect(typeof rpc[0]!.args.p_sig).toBe("string");
  });

  it("regenerates once with the correction cue when the canonical gate rejects", async () => {
    // CBE may legitimately answer a confrontational line with a direct stall;
    // turn it off so this test exercises the model + canonical gate path.
    vi.stubEnv("CBE_ENABLED", "false");
    const db = fakeSupabase();
    state.supabase = db.client;
    const seen: Array<Record<string, unknown>> = [];
    state.detailed.push((i) => (seen.push(i), { text: "Yeah, 45.", aiSource: "gpt" }));
    state.detailed.push((i) => (seen.push(i), { text: "No, I'm 30.", aiSource: "gpt" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const res = await POST(post("message", { message: "You're 45, right?" }), ctx);
    const json = (await res.json()) as Record<string, unknown>;
    expect((json.assistantMessage as { content: string }).content).toBe("No, I'm 30.");
    expect(String(seen[1]!.behaviourReinforcement)).toMatch(/contradicts your authored history/);
    const rpc = db.rpcCalls.filter((c) => c.name === "insert_assistant_message");
    expect(rpc).toHaveLength(1);
    expect(rpc[0]!.args.p_content).toBe("No, I'm 30.");
  });

  it("keeps HTTP semantics for pre-generation failures", async () => {
    state.supabase = fakeSupabase({ status: "completed" }).client;
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    expect((await POST(post("message", { message: "hi" }), ctx)).status).toBe(409);
    state.supabase = fakeSupabase({ owner: "someone-else" }).client;
    expect((await POST(post("message", { message: "hi" }), ctx)).status).toBe(403);
    expect((await POST(post("message", { message: "  " }), ctx)).status).toBe(400);
  });

  it("sends no engine numbers that could hint at a skill test's sealed case", async () => {
    const exam = examSession();
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const turn = async (opts: Parameters<typeof fakeSupabase>[0]) => {
      state.supabase = fakeSupabase(opts).client;
      state.detailed.push(() => ({ text: "I don't sleep much.", aiSource: "gpt" }));
      const res = await POST(post("message", { message: "How have you been sleeping?" }), ctx);
      expect(res.status).toBe(200);
      return { res, json: (await res.json()) as Record<string, unknown> };
    };

    // The same case as a practice turn carries the engine packets, so the
    // exam assertions below are not vacuous.
    const practice = await turn({ snapshot: exam.fullSnapshot });
    expect(practice.json.emotion).toMatchObject({ variables: expect.any(Object) });
    expect(practice.json.humanization).not.toBeNull();
    expect(practice.json.voiceHints).not.toBeNull();

    const test = await turn(exam.rowOpts);
    expect((test.json.assistantMessage as { content: string }).content).toBe("I don't sleep much.");
    for (const key of [
      "emotion", "cbePrimary", "cbeDisclosureGate", "cbeRapport", "decisionSpeak",
      "decisionAct", "decisionDisclosure", "decisionCognitiveMove", "humanization",
    ]) {
      expect(test.json[key], key).toBeNull();
    }
    // The patient's voice still gets its pacing.
    expect(test.json.voiceHints).toEqual(practice.json.voiceHints);
    for (const header of ["X-CBE-Primary", "X-CI-Speak", "X-CI-Act", "X-Humanization"]) {
      expect(test.res.headers.get(header), header).toBeNull();
    }
  });

  it("redrafts a skill-test reply that names the sealed diagnosis; practice keeps it", async () => {
    // CBE may answer with a direct stall; turn it off so the model path runs.
    vi.stubEnv("CBE_ENABLED", "false");
    const exam = examSession();
    const NAMED = "My doctor said it was PTSD.";
    const CLEAN = "I'd rather not put a label on it. I just don't sleep.";
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const ask = { message: "Has anyone ever given you a diagnosis?" };

    const practiceDb = fakeSupabase({ snapshot: exam.fullSnapshot });
    state.supabase = practiceDb.client;
    state.detailed.push(() => ({ text: NAMED, aiSource: "gpt" }));
    const practice = (await (await POST(post("message", ask), ctx)).json()) as Record<string, unknown>;
    expect((practice.assistantMessage as { content: string }).content).toBe(NAMED);

    const seen: Array<Record<string, unknown>> = [];
    const testDb = fakeSupabase(exam.rowOpts);
    state.supabase = testDb.client;
    state.detailed.push((i) => (seen.push(i), { text: NAMED, aiSource: "gpt" }));
    state.detailed.push((i) => (seen.push(i), { text: CLEAN, aiSource: "gpt" }));
    const test = (await (await POST(post("message", ask), ctx)).json()) as Record<string, unknown>;
    expect((test.assistantMessage as { content: string }).content).toBe(CLEAN);
    expect(String(seen[1]!.behaviourReinforcement)).toMatch(/named a diagnosis/);
    const saved = testDb.rpcCalls.filter((c) => c.name === "insert_assistant_message");
    expect(saved.map((c) => c.args.p_content)).toEqual([CLEAN]);
  });
});

describe("POST /api/sessions/:id/message/stream", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "true");
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "true");
  });

  it("is off when both the realtime and Therapy Room streaming flags are off", async () => {
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "");
    vi.stubEnv("THERAPY_ROOM_STREAMING", "false");
    state.supabase = fakeSupabase().client;
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: "hi" }), ctx);
    expect(res.status).toBe(404);
  });

  it("is on for the Therapy Room by default, without the realtime flags", async () => {
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "");
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "");
    state.supabase = fakeSupabase().client;
    state.stream = async () => ({ text: "Okay.", aiSource: "gpt", interrupted: false });
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: "hi" }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const events = await readSse(res);
    expect(events.at(-1)!.type).toBe("done");
  });

  it("in a skill test, sends no draft text and never speaks a sentence naming the diagnosis", async () => {
    vi.stubEnv("CBE_ENABLED", "false");
    const exam = examSession();
    const drafts = [
      ["I don't sleep. ", "My doctor said it was PTSD."],
      ["I'd rather not put a label on it. ", "I just don't sleep."],
    ];
    const run = async (opts: Parameters<typeof fakeSupabase>[0]) => {
      state.supabase = fakeSupabase(opts).client;
      let call = 0;
      state.stream = async (input) => {
        const onToken = input.onToken as (t: string, full: string) => void;
        const parts = drafts[call++]!;
        let full = "";
        for (const part of parts) onToken(part, (full += part));
        return { text: full, aiSource: "gpt", interrupted: false };
      };
      const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
      const res = await POST(
        post("message/stream", { message: "Has anyone ever given you a diagnosis?" }),
        ctx,
      );
      return readSse(res);
    };

    const test = await run(exam.rowOpts);
    expect(test.filter((e) => e.type === "token")).toEqual([]);
    const spoken = test.filter((e) => e.type === "sentence").map((e) => String(e.payload.text));
    expect(spoken.join(" ")).not.toContain("PTSD");
    const done = test.at(-1)!;
    expect(done.type).toBe("done");
    expect((done.payload.assistantMessage as { content: string }).content).toBe(
      "I'd rather not put a label on it. I just don't sleep.",
    );

    // Practice streams the draft as before and keeps the reply.
    const practice = await run({ snapshot: exam.fullSnapshot });
    expect(practice.some((e) => e.type === "token")).toBe(true);
    expect(
      (practice.at(-1)!.payload.assistantMessage as { content: string }).content,
    ).toBe("I don't sleep. My doctor said it was PTSD.");
  });

  it("delivers each token to the HTTP body before the model produces the next one", async () => {
    const db = fakeSupabase();
    state.supabase = db.client;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let generatorFinished = false;
    state.stream = async (input) => {
      const onToken = input.onToken as (t: string, full: string) => void;
      onToken("I ", "I ");
      await gate; // the model is "still generating" until the test releases it
      onToken("worry.", "I worry.");
      generatorFinished = true;
      return { text: "I worry.", aiSource: "gpt", model: "gpt-5", interrupted: false };
    };
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(
      post("message/stream", { message: "What brings you in?", clientTurnId: "t7" }),
      ctx,
    );
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

    let firstTokenSeenWhileGenerating: boolean | null = null;
    const events = await readSse(res, (e) => {
      if (e.type === "token" && firstTokenSeenWhileGenerating === null) {
        firstTokenSeenWhileGenerating = !generatorFinished;
        release();
      }
    });
    expect(firstTokenSeenWhileGenerating).toBe(true);

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("started");
    expect(types.at(-1)).toBe("done");
    expect(events.filter((e) => e.type === "token").map((e) => e.payload.token)).toEqual([
      "I ",
      "worry.",
    ]);
    // Monotonic sequence + turn id on every event.
    events.forEach((e, i) => {
      expect(e.sequence).toBe(i + 1);
      expect(e.payload.turnId).toBe("t7");
    });
    const rpc = db.rpcCalls.filter((c) => c.name === "insert_assistant_message");
    expect(rpc).toHaveLength(1);
    expect(rpc[0]!.args).toMatchObject({
      p_content: "I worry.",
      p_user_message_id: USER_MSG_ID,
    });
    const done = events.at(-1)!.payload;
    expect((done.assistantMessage as { content: string }).content).toBe("I worry.");
  });

  it("client disconnect aborts generation and persists nothing", async () => {
    const db = fakeSupabase();
    state.supabase = db.client;
    const client = new AbortController();
    let sawAbort = false;
    state.stream = async (input) => {
      const signal = input.signal as AbortSignal;
      const onToken = input.onToken as (t: string, full: string) => void;
      onToken("I ", "I ");
      await new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
      sawAbort = signal.aborted;
      return { text: "I", aiSource: "gpt", interrupted: true };
    };
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: "Tell me more" }, client.signal), ctx);
    const events = await readSse(res, (e) => {
      if (e.type === "token") client.abort();
    });
    expect(sawAbort).toBe(true);
    expect(events.at(-1)!.type).toBe("interrupted");
    expect(events.some((e) => e.type === "done")).toBe(false);
    expect(db.rpcCalls.filter((c) => c.name === "insert_assistant_message")).toHaveLength(0);
    // The therapist turn itself was persisted exactly once.
    expect(db.inserts.filter((i) => i.table === "session_messages")).toHaveLength(1);
  });

  it("answers pre-generation failures with JSON before persisting anything", async () => {
    const db = fakeSupabase({ status: "completed" });
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: "hi" }), ctx);
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(db.inserts).toHaveLength(0);
  });
});

/**
 * The Therapy Room streams the patient's reply. Streaming may only change
 * WHEN words are heard — never what the clinical turn does. Same therapist
 * message + same model text must give the same model input, the same
 * patient-engine state (rapport, emotion, decision plan, humanization) and the
 * same writes on /message and /message/stream.
 */
describe("streamed vs classic turn — identical clinical turn", () => {
  const HISTORY = [
    { role: "user", content: "Hi, I'm the therapist you'll be seeing today." },
    { role: "assistant", content: "Hi. I'm not really sure why I'm here." },
    { role: "user", content: "That's okay. What made you book the appointment?" },
    { role: "assistant", content: "My sister made me. I haven't been sleeping." },
  ];
  const THERAPIST = "That sounds exhausting. How long has the sleep been like this?";
  const REPLY = "A few months, I guess. I lie there and my head just won't stop.";

  async function runClassic() {
    const db = fakeSupabase({ history: HISTORY });
    state.supabase = db.client;
    const inputs: Array<Record<string, unknown>> = [];
    state.detailed.push((i) => (inputs.push(i), { text: REPLY, aiSource: "gpt", model: "gpt-5" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const res = await POST(post("message", { message: THERAPIST }), ctx);
    expect(res.status).toBe(200);
    return { db, input: inputs[0]!, body: (await res.json()) as Record<string, unknown> };
  }

  async function runStreamed() {
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "");
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "");
    const db = fakeSupabase({ history: HISTORY });
    state.supabase = db.client;
    const inputs: Array<Record<string, unknown>> = [];
    state.stream = async (input) => {
      inputs.push(input);
      const onToken = input.onToken as (t: string, full: string) => void;
      let text = "";
      for (const word of REPLY.split(/(?<= )/)) {
        text += word;
        onToken(word, text);
      }
      return { text: REPLY, aiSource: "gpt", model: "gpt-5", interrupted: false };
    };
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: THERAPIST }), ctx);
    const events = await readSse(res);
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    return { db, input: inputs[0]!, body: done!.payload, events };
  }

  it("gives the model the same prompt, history and per-turn cues", async () => {
    const classic = await runClassic();
    const streamed = await runStreamed();
    for (const key of ["avatar", "history", "userMessage", "behaviourReinforcement"]) {
      expect(streamed.input[key]).toEqual(classic.input[key]);
    }
  });

  it("produces the same patient-engine state (rapport, emotion, decision, humanization)", async () => {
    const classic = await runClassic();
    const streamed = await runStreamed();
    for (const key of [
      "aiSource", "aiModel", "locale", "emotion", "cbeEnabled", "cbePrimary",
      "cbeDisclosureGate", "cbeRapport", "decisionSpeak", "decisionAct",
      "decisionDisclosure", "decisionCognitiveMove", "humanizationEnabled",
      "humanization", "voiceHints",
    ]) {
      expect(streamed.body[key], key).toEqual(classic.body[key]);
    }
    expect((streamed.body.assistantMessage as { content: string }).content).toBe(REPLY);
  });

  it("saves the same therapist message and patient reply, once each, in order", async () => {
    const classic = await runClassic();
    const streamed = await runStreamed();
    const shape = (db: ReturnType<typeof fakeSupabase>) => ({
      inserts: db.inserts.map((i) => ({ table: i.table, role: i.row.role, content: i.row.content })),
      replies: db.rpcCalls
        .filter((c) => c.name === "insert_assistant_message")
        .map((c) => ({ content: c.args.p_content, after: c.args.p_user_message_id })),
    });
    expect(shape(streamed.db)).toEqual(shape(classic.db));
    expect(shape(streamed.db).replies).toEqual([{ content: REPLY, after: USER_MSG_ID }]);
    // Nothing is persisted before the validated reply: "done" is the last event.
    expect(streamed.events.at(-1)!.type).toBe("done");
  });

  it("releases the first sentence for speech before the reply is saved", async () => {
    const streamed = await runStreamed();
    const firstSentence = streamed.events.findIndex((e) => e.type === "sentence");
    const done = streamed.events.findIndex((e) => e.type === "done");
    expect(firstSentence).toBeGreaterThan(-1);
    expect(firstSentence).toBeLessThan(done);
    expect(streamed.events[firstSentence]!.payload.text).toBe("A few months, I guess.");
  });
});

/**
 * Floor control: when the therapist adds to their question while the patient
 * is still thinking, the patient yields and its first reply is never spoken
 * (heard_chars 0). The next reply must answer both parts, so the unspoken
 * reply is left out of what the patient remembers saying.
 */
describe("a reply the therapist never heard is not in the patient's memory", () => {
  const HISTORY = [
    { role: "user", content: "How have you been feeling this week?" },
    { role: "assistant", content: "Honestly, pretty low.", heard_chars: 0 },
  ];
  const ADDITION = "And how has your sleep been?";

  function expectBothQuestionsOpen(input: Record<string, unknown>) {
    const history = input.history as Array<{ role: string; content: string }>;
    expect(history.some((m) => m.content === "Honestly, pretty low.")).toBe(false);
    expect(history.at(-2)).toMatchObject({ role: "user", content: HISTORY[0]!.content });
    expect(history.at(-1)).toMatchObject({ role: "user", content: ADDITION });
  }

  it("classic /message", async () => {
    const db = fakeSupabase({ history: HISTORY });
    state.supabase = db.client;
    const inputs: Array<Record<string, unknown>> = [];
    state.detailed.push((i) => (inputs.push(i), { text: "Low, and I barely sleep.", aiSource: "gpt" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    const res = await POST(post("message", { message: ADDITION }), ctx);
    expect(res.status).toBe(200);
    expectBothQuestionsOpen(inputs[0]!);
  });

  it("streamed /message/stream", async () => {
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "");
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "");
    const db = fakeSupabase({ history: HISTORY });
    state.supabase = db.client;
    const inputs: Array<Record<string, unknown>> = [];
    state.stream = async (input) => {
      inputs.push(input);
      return { text: "Low, and I barely sleep.", aiSource: "gpt", model: "gpt-5", interrupted: false };
    };
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: ADDITION }), ctx);
    await readSse(res);
    expectBothQuestionsOpen(inputs[0]!);
  });

  it("keeps a partly heard (barge-in) reply as it was", async () => {
    const db = fakeSupabase({
      history: [
        { role: "user", content: "How have you been feeling this week?" },
        { role: "assistant", content: "Honestly, pretty low.", heard_chars: 9 },
      ],
    });
    state.supabase = db.client;
    const inputs: Array<Record<string, unknown>> = [];
    state.detailed.push((i) => (inputs.push(i), { text: "Yeah.", aiSource: "gpt" }));
    const { POST } = await import("@/app/api/sessions/[id]/message/route");
    await POST(post("message", { message: ADDITION }), ctx);
    const history = inputs[0]!.history as Array<{ content: string }>;
    expect(history.some((m) => m.content === "Honestly, pretty low.")).toBe(true);
  });
});
