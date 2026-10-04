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
import {
  ctx,
  fakeSupabase,
  post,
  readSse,
  SESSION_ID,
  USER_MSG_ID,
} from "@/lib/sessions/__fixtures__/route-fakes";

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
});

describe("POST /api/sessions/:id/message/stream", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_REALTIME_SIMULATION", "true");
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "true");
  });

  it("is off unless streaming is explicitly enabled", async () => {
    vi.stubEnv("FEATURE_REALTIME_STREAMING", "");
    state.supabase = fakeSupabase().client;
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const res = await POST(post("message/stream", { message: "hi" }), ctx);
    expect(res.status).toBe(404);
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
