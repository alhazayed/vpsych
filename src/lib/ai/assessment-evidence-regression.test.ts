import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression pins taken before turn-cited evidence and "cannot score" were
// added: an examiner reply in the old shape (no status, no evidence) must
// score exactly as it did.

const chatMock = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  openAIService: { chat: (...args: unknown[]) => chatMock(...args) },
  hasOpenAIApiKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (x: unknown) => x },
}));

const liveRubric = [
  { id: "alliance", label: "Alliance", weight: 25, max: 5 },
  { id: "assessment", label: "Assessment", weight: 25, max: 5 },
  { id: "interventions", label: "Interventions", weight: 20, max: 5 },
  { id: "safety", label: "Safety", weight: 20, max: 5 },
  { id: "structure", label: "Structure", weight: 10, max: 5 },
];

const avatar = {
  name: "Maya Chen",
  disorder: "Major Depressive Disorder",
  ideal_guidelines: { session_goals: ["Explore mood"], ideal_approach: "Supportive CBT" },
  rubric: liveRubric,
};

const messages = [
  { role: "user" as const, content: "How have you been feeling this week?", created_at: "2026-10-26T00:00:00Z" },
  { role: "assistant" as const, content: "Tired and heavy. Work has been rough.", created_at: "2026-10-26T00:00:05Z" },
];

const oldShape = JSON.stringify({
  items: [
    { id: "alliance", score: 4, feedback: "Warm." },
    { id: "assessment", score: 3, feedback: "Some depth." },
    { id: "interventions", score: 2, feedback: "Listening only." },
    { id: "safety", score: 1, feedback: "No screen." },
    { id: "structure", score: 5, feedback: "Clear." },
  ],
  narrative: "Short opening.",
  excerpts: ["How have you been feeling this week?"],
});

describe("assessSession scoring regression (old examiner shape)", () => {
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

  it("keeps item scores and the weighted overall for the live 5-item rubric", async () => {
    chatMock.mockResolvedValue({ text: oldShape, model: "gpt-5" });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    expect(r.aiSource).toBe("gpt");
    expect(r.scores.items.map((i) => [i.id, i.score])).toEqual([
      ["alliance", 4],
      ["assessment", 3],
      ["interventions", 2],
      ["safety", 1],
      ["structure", 5],
    ]);
    // 25*.8 + 25*.6 + 20*.4 + 20*.2 + 10*1 = 20 + 15 + 8 + 4 + 10 = 57
    expect(r.scores.overall).toBe(57);
  });

  it("keeps the weighted overall for the 11-item default rubric", async () => {
    const items = [
      ["alliance", 4], ["assessment", 3], ["dsm_reasoning", 3], ["icd_reasoning", 3],
      ["interventions", 2], ["safety", 2], ["structure", 3], ["clinical_formulation", 2],
      ["differential_diagnosis", 2], ["risk_formulation", 2], ["educational_competency", 3],
    ].map(([id, score]) => ({ id, score, feedback: "x" }));
    chatMock.mockResolvedValue({
      text: JSON.stringify({ items, narrative: "n", excerpts: [] }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({
      avatar: { ...avatar, rubric: [] },
      messages,
      durationSec: 120,
      language: "en",
    });
    expect(r.scores.overall).toBe(52);
  });

  it("keeps heuristic fallback scores unchanged with no AI key", async () => {
    delete process.env.OPENAI_API_KEY;
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    expect(r.aiSource).toBe("persona_fallback");
    expect(r.scores.items.map((i) => [i.id, i.score])).toEqual([
      ["alliance", 2],
      ["assessment", 2],
      ["interventions", 2],
      ["safety", 1],
      ["structure", 1],
    ]);
    // 25*.4 + 25*.4 + 20*.4 + 20*.2 + 10*.2 = 34
    expect(r.scores.overall).toBe(34);
  });
});
