import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatMock = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  openAIService: { chat: (...args: unknown[]) => chatMock(...args) },
  hasOpenAIApiKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
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
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns the model reply on success", async () => {
    chatMock.mockResolvedValue({ text: "  Hi, I've been low.  " });
    const { generatePatientReply } = await import("@/lib/ai/patient-agent");
    const reply = await generatePatientReply({
      avatar,
      history: [],
      userMessage: "How are you?",
    });
    expect(reply).toBe("Hi, I've been low.");
  });

  it("falls back (does not throw) when the model errors", async () => {
    chatMock.mockRejectedValue(new Error("OpenAI rate limit exceeded."));
    const { generatePatientReply } = await import("@/lib/ai/patient-agent");
    const reply = await generatePatientReply({
      avatar,
      history: [],
      userMessage: "How are you?",
    });
    expect(avatar.fallback_replies).toContain(reply);
  });
});
