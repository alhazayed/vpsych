import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIServiceError } from "@/lib/ai/openai/errors";

type StreamHandlers = {
  onToken?: (token: string, full: string) => void;
  signal?: AbortSignal;
};
type ChatStreamImpl = (
  params: { model?: string },
  handlers: StreamHandlers,
) => Promise<{ text: string; model: string; interrupted: boolean }>;

const chatStreamMock = vi.fn<ChatStreamImpl>();

vi.mock("@/lib/ai/openai", () => ({
  openAIService: {
    chat: vi.fn(),
    chatStream: (params: { model?: string }, handlers: StreamHandlers) =>
      chatStreamMock(params, handlers),
  },
  hasOpenAIApiKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
}));

vi.mock("ai", () => ({ generateText: vi.fn(), streamText: vi.fn() }));

const avatar = {
  name: "Maya Chen",
  disorder: "MDD",
  system_prompt: "You are Maya.",
  fallback_replies: ["I'm not sure."],
  per_turn_reinforcement: "",
};

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const rateLimited = () =>
  new OpenAIServiceError("OpenAI rate limit exceeded.", {
    code: "OPENAI_RATE_LIMIT",
    kind: "rate_limit",
    status: 429,
    retryable: false,
  });

describe("generatePatientReplyStream", () => {
  beforeEach(() => {
    chatStreamMock.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_CHAT_PROVIDER;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it("forwards provider tokens as they arrive, before the stream resolves", async () => {
    const order: string[] = [];
    chatStreamMock.mockImplementation(async (_p, h) => {
      let text = "";
      for (const t of ["I ", "feel ", "flat."]) {
        await tick();
        text += t;
        order.push(`provider:${t}`);
        h.onToken?.(t, text);
      }
      order.push("provider:resolved");
      return { text, model: "gpt-5", interrupted: false };
    });
    const { generatePatientReplyStream } = await import("@/lib/ai/patient-agent");
    const result = await generatePatientReplyStream({
      avatar,
      history: [],
      userMessage: "How are you?",
      onToken: (t) => order.push(`client:${t}`),
    });
    expect(order).toEqual([
      "provider:I ",
      "client:I ",
      "provider:feel ",
      "client:feel ",
      "provider:flat.",
      "client:flat.",
      "provider:resolved",
    ]);
    expect(result).toMatchObject({ text: "I feel flat.", aiSource: "gpt", interrupted: false });
  });

  it("an abort ends the turn: no failover, no persona fallback, interrupted=true", async () => {
    const controller = new AbortController();
    chatStreamMock.mockImplementation(async (_p, h) => {
      h.onToken?.("I ", "I ");
      controller.abort();
      // Both SDKs surface an abort as a thrown error — make it look like a 429
      // to prove the abort check wins over the rate-limit failover.
      throw rateLimited();
    });
    const onToken = vi.fn();
    const { generatePatientReplyStream } = await import("@/lib/ai/patient-agent");
    const result = await generatePatientReplyStream({
      avatar,
      history: [],
      userMessage: "hi",
      onToken,
      signal: controller.signal,
    });
    expect(result.interrupted).toBe(true);
    expect(chatStreamMock).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).not.toHaveBeenCalledWith("I'm not sure.", "I'm not sure.");
  });

  it("personaFallback:false throws instead of silently substituting a persona reply", async () => {
    chatStreamMock.mockRejectedValue(new Error("stream not permitted"));
    const { generatePatientReplyStream, PatientStreamUnavailableError } = await import(
      "@/lib/ai/patient-agent"
    );
    await expect(
      generatePatientReplyStream({
        avatar,
        history: [],
        userMessage: "hi",
        personaFallback: false,
      }),
    ).rejects.toBeInstanceOf(PatientStreamUnavailableError);
    // Legacy default keeps the persona fallback.
    const legacy = await generatePatientReplyStream({ avatar, history: [], userMessage: "hi" });
    expect(legacy.aiSource).toBe("persona_fallback");
  });

  it("signals onReset before a failover replays tokens from another model", async () => {
    const events: string[] = [];
    chatStreamMock
      .mockImplementationOnce(async (_p, h) => {
        h.onToken?.("Half", "Half");
        throw rateLimited();
      })
      .mockImplementationOnce(async (_p, h) => {
        h.onToken?.("Whole reply.", "Whole reply.");
        return { text: "Whole reply.", model: "gpt-4o-mini", interrupted: false };
      });
    const { generatePatientReplyStream } = await import("@/lib/ai/patient-agent");
    const result = await generatePatientReplyStream({
      avatar,
      history: [],
      userMessage: "hi",
      onToken: (t) => events.push(`token:${t}`),
      onReset: () => events.push("reset"),
    });
    expect(events).toEqual(["token:Half", "reset", "token:Whole reply."]);
    expect(result.text).toBe("Whole reply.");
  });
});
