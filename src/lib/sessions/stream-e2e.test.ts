/**
 * End-to-end proof that /message/stream is genuinely incremental.
 *
 * Nothing on the generation path is mocked: the real stream route, the real
 * shared clinical pipeline, the real `generatePatientReplyStream`, and the
 * real official OpenAI SDK streaming request. The SDK is pointed (via
 * OPENAI_BASE_URL) at a local HTTP server that speaks the chat-completions
 * SSE protocol and emits one content chunk every CHUNK_GAP_MS. Only Supabase
 * and the rate limiter are faked.
 *
 * If the route buffered the reply (or revealed a finished reply), every token
 * would reach the client after the provider's last chunk. Instead the first
 * token must arrive while the provider is still generating, and token arrival
 * times must track the provider's emission times.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ctx,
  fakeSupabase,
  post,
  readSse,
  USER_MSG_ID,
} from "@/lib/sessions/__fixtures__/route-fakes";

const state = vi.hoisted(() => ({ supabase: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));

const CHUNK_GAP_MS = 80;
const PIECES = ["Honestly, ", "I haven't ", "been sleeping ", "much. ", "Most nights ", "I just ", "lie there."];

type ProviderLog = { sentAt: number[]; closedEarly: boolean; finished: boolean };
let server: Server;
let baseUrl = "";
let provider: ProviderLog;

function chunk(content: string | null, finish: string | null = null) {
  return `data: ${JSON.stringify({
    id: "chatcmpl-e2e",
    object: "chat.completion.chunk",
    created: 0,
    model: "gpt-5-e2e",
    choices: [{ index: 0, delta: content === null ? {} : { content }, finish_reason: finish }],
  })}\n\n`;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    req.resume();
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    let i = 0;
    const timer = setInterval(() => {
      if (res.destroyed) return;
      if (i < PIECES.length) {
        provider.sentAt.push(performance.now());
        res.write(chunk(PIECES[i]!));
        i += 1;
        return;
      }
      clearInterval(timer);
      res.write(chunk(null, "stop"));
      res.write("data: [DONE]\n\n");
      provider.finished = true;
      res.end();
    }, CHUNK_GAP_MS);
    res.on("close", () => {
      if (!provider.finished) provider.closedEarly = true;
      clearInterval(timer);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(async () => {
  provider = { sentAt: [], closedEarly: false, finished: false };
  vi.stubEnv("OPENAI_API_KEY", "sk-e2e-local");
  vi.stubEnv("OPENAI_BASE_URL", baseUrl);
  vi.stubEnv("OPENAI_MAX_RETRIES", "0");
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  vi.stubEnv("OPENAI_CHAT_PROVIDER", "openai");
  vi.stubEnv("CBE_ENABLED", "false");
  vi.stubEnv("FEATURE_REALTIME_SIMULATION", "true");
  vi.stubEnv("FEATURE_REALTIME_STREAMING", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("REPORT_WRITE_KEY", "unit-test-report-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { resetOpenAIClient } = await import("@/lib/ai/openai/client");
  resetOpenAIClient();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  const { resetOpenAIClient } = await import("@/lib/ai/openai/client");
  resetOpenAIClient();
});

describe("realtime stream — end to end through the OpenAI SDK", () => {
  it("delivers tokens to the client while the provider is still generating", async () => {
    const db = fakeSupabase();
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");

    const t0 = performance.now();
    const res = await POST(post("message/stream", { message: "How have you been sleeping?" }), ctx);
    const arrivals: Array<{ type: string; at: number; providerChunksSent: number; providerDone: boolean }> = [];
    const events = await readSse(res, (e) =>
      arrivals.push({
        type: e.type,
        at: performance.now() - t0,
        providerChunksSent: provider.sentAt.length,
        providerDone: provider.finished,
      }),
    );

    const tokens = arrivals.filter((a) => a.type === "token");
    expect(tokens).toHaveLength(PIECES.length);
    // 1. The first token reached the client while the provider was still
    //    generating — at most one chunk later (slack for a loaded runner).
    expect(tokens[0]!.providerDone).toBe(false);
    expect(tokens[0]!.providerChunksSent).toBeLessThanOrEqual(2);
    // 2. Causal and incremental: token i never precedes provider chunk i, and
    //    every token but the last arrived before the provider finished.
    tokens.forEach((t, i) => expect(t.providerChunksSent).toBeGreaterThanOrEqual(i + 1));
    expect(tokens.slice(0, -1).every((t) => !t.providerDone)).toBe(true);
    // 3. Arrivals are spread over the generation, not bunched at the end.
    const spread = tokens.at(-1)!.at - tokens[0]!.at;
    expect(spread).toBeGreaterThanOrEqual(CHUNK_GAP_MS * (PIECES.length - 3));
    // 4. A sentence is released for TTS before the model has finished.
    const firstSentence = arrivals.find((a) => a.type === "sentence")!;
    expect(firstSentence.providerDone).toBe(false);

    // Report the measured timeline (visible with --reporter=verbose).
    console.log(
      "[stream-e2e] token arrival ms:",
      tokens.map((t) => Math.round(t.at)).join(", "),
      "| first sentence ms:",
      Math.round(firstSentence.at),
    );

    expect(events.at(-1)!.type).toBe("done");
    const rpc = db.rpcCalls.filter((c) => c.name === "insert_assistant_message");
    expect(rpc).toHaveLength(1);
    expect(rpc[0]!.args).toMatchObject({
      p_content: PIECES.join("").trim(),
      p_user_message_id: USER_MSG_ID,
    });
  });

  it("client abort cancels the upstream provider request mid-generation", async () => {
    const db = fakeSupabase();
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/message/stream/route");
    const client = new AbortController();
    const res = await POST(
      post("message/stream", { message: "How have you been sleeping?" }, client.signal),
      ctx,
    );
    let tokens = 0;
    const events = await readSse(res, (e) => {
      if (e.type === "token" && ++tokens === 2) client.abort();
    });
    // Give the socket close a moment to propagate to the fake provider.
    await new Promise((r) => setTimeout(r, CHUNK_GAP_MS * 2));
    expect(provider.closedEarly).toBe(true);
    expect(provider.sentAt.length).toBeLessThan(PIECES.length);
    expect(events.at(-1)!.type).toBe("interrupted");
    expect(events.filter((e) => e.type === "token")).toHaveLength(2);
    expect(db.rpcCalls.filter((c) => c.name === "insert_assistant_message")).toHaveLength(0);
  });
});
