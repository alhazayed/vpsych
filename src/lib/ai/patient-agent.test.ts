import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIServiceError } from "@/lib/ai/openai/errors";

const chatMock = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  openAIService: { chat: (...args: unknown[]) => chatMock(...args) },
  hasOpenAIApiKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

const avatar = {
  name: "Maya Chen",
  disorder: "Major Depressive Disorder",
  system_prompt: "You are Maya.",
  fallback_replies: ["I'm not sure.", "It's hard to say."],
  per_turn_reinforcement: "Stay in character.",
};

describe("generatePatientReply resilience", () => {
  beforeEach(() => {
    chatMock.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_CHAT_PROVIDER;
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("returns the model reply on success", async () => {
    chatMock.mockResolvedValue({ text: "  Hi, I've been low.  ", model: "gpt-5" });
    const { generatePatientReplyDetailed } = await import(
      "@/lib/ai/patient-agent"
    );
    const reply = await generatePatientReplyDetailed({
      avatar,
      history: [],
      userMessage: "How are you?",
    });
    expect(reply.text).toBe("Hi, I've been low.");
    expect(reply.aiSource).toBe("gpt");
    expect(reply.model).toBe("gpt-5");
  });

  it("falls back (does not throw) and exposes persona_fallback", async () => {
    chatMock.mockRejectedValue(
      new OpenAIServiceError("OpenAI rate limit exceeded.", {
        code: "OPENAI_RATE_LIMIT",
        kind: "rate_limit",
        status: 429,
        retryable: false,
      }),
    );
    const { generatePatientReplyDetailed } = await import(
      "@/lib/ai/patient-agent"
    );
    const reply = await generatePatientReplyDetailed({
      avatar,
      history: [],
      userMessage: "How are you?",
    });
    expect(avatar.fallback_replies).toContain(reply.text);
    expect(reply.aiSource).toBe("persona_fallback");
    expect(reply.errorKind).toBe("rate_limit");
  });

  it("failovers to gpt-4o-mini on rate_limit without retrying 429", async () => {
    chatMock
      .mockRejectedValueOnce(
        new OpenAIServiceError("OpenAI rate limit exceeded.", {
          code: "OPENAI_RATE_LIMIT",
          kind: "rate_limit",
          status: 429,
          retryable: false,
        }),
      )
      .mockResolvedValueOnce({ text: "Mini path works.", model: "gpt-4o-mini" });

    const { generatePatientReplyDetailed } = await import(
      "@/lib/ai/patient-agent"
    );
    const reply = await generatePatientReplyDetailed({
      avatar,
      history: [],
      userMessage: "How are you?",
    });
    expect(reply.aiSource).toBe("gpt");
    expect(reply.model).toBe("gpt-4o-mini");
    expect(reply.errorKind).toBe("rate_limit");
    expect(chatMock).toHaveBeenCalledTimes(2);
    const secondArg = chatMock.mock.calls[1]?.[0] as { model?: string };
    expect(secondArg.model).toBe("gpt-4o-mini");
  });

  it("keeps string return for generatePatientReply", async () => {
    chatMock.mockResolvedValue({ text: "ok", model: "gpt-5" });
    const { generatePatientReply } = await import("@/lib/ai/patient-agent");
    await expect(
      generatePatientReply({
        avatar,
        history: [],
        userMessage: "Hi",
      }),
    ).resolves.toBe("ok");
  });

  it("appends Conversation Behaviour reinforcement to the therapist turn", async () => {
    chatMock.mockResolvedValue({ text: "…", model: "gpt-5" });
    const { generatePatientReplyDetailed } = await import(
      "@/lib/ai/patient-agent"
    );
    await generatePatientReplyDetailed({
      avatar,
      history: [],
      userMessage: "How are you feeling?",
      behaviourReinforcement:
        "CONVERSATION BEHAVIOUR THIS TURN\n- Do not answer everything.",
    });
    expect(chatMock).toHaveBeenCalled();
    const payload = chatMock.mock.calls[0]![0] as {
      messages: { role: string; content: string }[];
    };
    const userTurn = payload.messages.find((m) => m.role === "user");
    expect(userTurn?.content).toContain("How are you feeling?");
    expect(userTurn?.content).toContain("Stay in character.");
    expect(userTurn?.content).toContain("CONVERSATION BEHAVIOUR THIS TURN");
  });
});
