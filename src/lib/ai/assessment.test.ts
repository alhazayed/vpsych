import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatMock = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  openAIService: { chat: (...args: unknown[]) => chatMock(...args) },
  hasOpenAIApiKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (x: unknown) => x },
}));

const avatar = {
  name: "Maya Chen",
  disorder: "Major Depressive Disorder",
  ideal_guidelines: {
    session_goals: ["Explore mood"],
    ideal_approach: "Supportive CBT",
  },
  rubric: [],
};

const messages = [
  {
    role: "user" as const,
    content: "How have you been feeling this week?",
    created_at: new Date().toISOString(),
  },
  {
    role: "assistant" as const,
    content: "Tired and heavy. Work has been rough.",
    created_at: new Date().toISOString(),
  },
];

const goodJson = JSON.stringify({
  items: [
    {
      id: "rapport",
      score: 4,
      feedback: "Warm opening matched patient affect.",
      examples: ["How have you been feeling this week?"],
    },
    {
      id: "empathy",
      score: 4,
      feedback: "Reflected fatigue without empty reassurance.",
      examples: ["How have you been feeling this week?"],
    },
    {
      id: "risk_assessment",
      score: 2,
      feedback: "No safety screen yet.",
    },
    {
      id: "history_taking",
      score: 3,
      feedback: "Asked about mood; limited depth.",
    },
    {
      id: "dsm_reasoning",
      score: 3,
      feedback: "Named mood episode features without over-claiming MDD.",
    },
    {
      id: "therapeutic_alliance",
      score: 3,
      feedback: "Collaborative tone present.",
    },
    {
      id: "communication",
      score: 3,
      feedback: "Clear opening question.",
    },
    {
      id: "professionalism",
      score: 3,
      feedback: "Respectful framing.",
    },
    {
      id: "session_structure",
      score: 3,
      feedback: "Clear opening; thin close.",
    },
    {
      id: "treatment_planning",
      score: 2,
      feedback: "Mostly supportive listening.",
    },
  ],
  narrative:
    "Therapist opened with mood inquiry; patient reported fatigue and work stress.",
  excerpts: ["How have you been feeling this week?"],
});

describe("assessSession parse failover", () => {
  beforeEach(() => {
    chatMock.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_CHAT_PROVIDER;
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns gpt assessment when primary JSON is valid", async () => {
    chatMock.mockResolvedValue({ text: goodJson, model: "gpt-5" });
    const { assessSession } = await import("@/lib/ai/assessment");
    const result = await assessSession({
      avatar,
      messages,
      durationSec: 120,
      language: "en-US",
    });
    expect(result.aiSource).toBe("gpt");
    expect(result.narrative).toContain("fatigue");
    expect(result.narrative).not.toMatch(/AI_GATEWAY|heuristic|persona_fallback/i);
  });

  it("failovers to gpt-4o-mini when primary returns fenced/invalid-then-valid path", async () => {
    chatMock
      .mockResolvedValueOnce({ text: "not json at all", model: "gpt-5" })
      .mockResolvedValueOnce({ text: goodJson, model: "gpt-4o-mini" });
    const { assessSession } = await import("@/lib/ai/assessment");
    const result = await assessSession({
      avatar,
      messages,
      durationSec: 120,
      language: "en",
    });
    expect(result.aiSource).toBe("gpt");
    expect(result.model).toBe("gpt-4o-mini");
    expect(chatMock).toHaveBeenCalledTimes(2);
    const second = chatMock.mock.calls[1]?.[0] as {
      model?: string;
      json?: boolean;
    };
    expect(second.model).toBe("gpt-4o-mini");
    expect(second.json).toBe(true);
  });

  it("accepts markdown-fenced JSON from primary without heuristic", async () => {
    chatMock.mockResolvedValue({
      text: "```json\n" + goodJson + "\n```",
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const result = await assessSession({
      avatar,
      messages,
      durationSec: 90,
      language: "en",
    });
    expect(result.aiSource).toBe("gpt");
    // Mission 9 Clinical Educator rubric (10 dimensions, weights sum 100)
    expect(result.scores.items).toHaveLength(10);
    expect(result.scores.items.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "rapport",
        "empathy",
        "risk_assessment",
        "history_taking",
        "dsm_reasoning",
        "therapeutic_alliance",
        "communication",
        "professionalism",
        "session_structure",
        "treatment_planning",
      ]),
    );
    expect(result.scores.clinical_educator?.dimensions).toHaveLength(10);
  });
});
