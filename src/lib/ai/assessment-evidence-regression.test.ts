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

describe("assessSession turn-cited evidence and cannot score", () => {
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

  const base = JSON.parse(oldShape) as {
    items: Record<string, unknown>[];
    narrative: string;
    excerpts: string[];
  };
  const withItems = (patch: Record<string, Record<string, unknown>>) =>
    JSON.stringify({
      ...base,
      items: base.items.map((i) => ({ ...i, ...(patch[i.id as string] ?? {}) })),
    });

  it("stores verified quotes with their turn and drops invented ones", async () => {
    chatMock.mockResolvedValue({
      text: withItems({
        alliance: {
          status: "scored",
          evidence: [
            { turn: 1, quote: "How have you been feeling this week?" },
            { turn: 1, quote: "I really understand how hard this is" },
          ],
        },
        assessment: { evidence: [{ turn: 2, quote: "Work has been rough" }] },
      }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    const byId = new Map(r.scores.items.map((i) => [i.id, i]));
    expect(byId.get("alliance")?.evidence).toEqual([
      { turn: 1, speaker: "therapist", quote: "How have you been feeling this week?" },
    ]);
    expect(byId.get("assessment")?.evidence).toEqual([
      { turn: 2, speaker: "patient", quote: "Work has been rough" },
    ]);
    expect(byId.get("safety")?.evidence).toEqual([]);
    expect(r.scores.overall).toBe(57);
    expect(r.scores.unscored_items).toBeUndefined();
  });

  it("keeps a cannot-score item out of items and out of the overall", async () => {
    chatMock.mockResolvedValue({
      text: withItems({
        structure: { status: "cannot_score", score: null, reason: "Session ended after two turns." },
      }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    expect(r.aiSource).toBe("gpt");
    expect(r.scores.items.map((i) => i.id)).not.toContain("structure");
    expect(r.scores.unscored_items).toEqual([
      { id: "structure", label: "Session structure & time use", max: 5, weight: 10, reason: "Session ended after two turns." },
    ]);
    // (20 + 15 + 8 + 4) / 90 * 100 = 52.2 → 52
    expect(r.scores.overall).toBe(52);
  });

  it("counts cannot-score items as zero once less than half the weight was scored", async () => {
    chatMock.mockResolvedValue({
      text: withItems({
        assessment: { status: "cannot_score", score: null },
        interventions: { status: "cannot score", score: null },
        safety: { status: "insufficient_evidence", score: 0 },
      }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    // Scored: alliance 25 + structure 10 = 35 < 65 unscored, so the overall
    // is over the full 100: 20 + 10 = 30, not 30/35 = 86.
    expect(r.scores.overall).toBe(30);
    expect(r.scores.unscored_items?.map((u) => u.id)).toEqual(["assessment", "interventions", "safety"]);
    expect(r.scores.unscored_items?.[0]?.reason).toMatch(/no fair basis/);
  });

  it("gives an Arabic default reason in an Arabic report", async () => {
    chatMock.mockResolvedValue({
      text: withItems({ structure: { status: "cannot_score", score: null } }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "ar" });
    expect(r.scores.unscored_items?.[0]?.reason).toBe("لم يقدّم النص أساساً عادلاً لتقييم هذا البند.");
  });

  it("still fails over when a scored item has a null score", async () => {
    chatMock
      .mockResolvedValueOnce({ text: withItems({ safety: { score: null } }), model: "gpt-5" })
      .mockResolvedValueOnce({ text: oldShape, model: "gpt-4o-mini" });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    expect(r.model).toBe("gpt-4o-mini");
    expect(r.scores.items.find((i) => i.id === "safety")?.score).toBe(1);
  });

  it("scores zero when nothing could be scored, without crashing", async () => {
    const all = Object.fromEntries(
      liveRubric.map((r) => [r.id, { status: "cannot_score", score: null }]),
    );
    chatMock.mockResolvedValue({ text: withItems(all), model: "gpt-5" });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 30, language: "en" });
    expect(r.aiSource).toBe("gpt");
    expect(r.scores.items).toEqual([]);
    expect(r.scores.overall).toBe(0);
    expect(r.scores.unscored_items).toHaveLength(5);
  });

  it("gives the examiner numbered turns and 0-5 anchors in English and Arabic", async () => {
    chatMock.mockResolvedValue({ text: oldShape, model: "gpt-5" });
    const { assessSession } = await import("@/lib/ai/assessment");
    await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    await assessSession({ avatar, messages, durationSec: 120, language: "ar" });
    for (const [idx, lang] of [[0, "en"], [1, "ar"]] as const) {
      const call = chatMock.mock.calls[idx]![0] as { messages: { role: string; content: string }[] };
      const system = call.messages.find((m) => m.role === "system")!.content;
      const user = call.messages.find((m) => m.role === "user")!.content;
      expect(user).toContain('<turn n="1" speaker="therapist">');
      expect(user).toContain('<turn n="2" speaker="patient">');
      expect(system).toContain("cannot_score");
      expect(system).toMatch(/safety — .+\n {2}0: .+\n[\s\S]*\n {2}5: /);
      if (lang === "ar") {
        expect(system).toContain("لا تستخدم cannot_score أبداً لتتجنّب إعطاء درجة منخفضة");
        expect(system).toMatch(/ {2}0: [؀-ۿ]/);
      } else {
        expect(system).toContain("Never use cannot_score to avoid giving a low score");
      }
    }
  });

  it("keeps the trainee feedback and its filters alongside evidence", async () => {
    chatMock.mockResolvedValue({
      text: JSON.stringify({
        ...JSON.parse(withItems({ structure: { status: "cannot_score", score: null } })),
        trainee_feedback: {
          strengths: ["You opened with a warm, open question."],
          missed: ["You scored 1/5 on safety."],
          next_steps: ["Try asking about sleep and energy."],
        },
      }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    expect(r.scores.trainee_feedback?.strengths).toEqual(["You opened with a warm, open question."]);
    expect(r.scores.trainee_feedback?.missed ?? []).toEqual([]);
  });
});

describe("assessSession gateway structured output", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("applies the same cannot-score and evidence rules", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({
      output: {
        items: liveRubric.map((r) => ({
          id: r.id,
          status: r.id === "structure" ? "cannot_score" : "scored",
          score: r.id === "structure" ? null : 3,
          feedback: "f",
          evidence: r.id === "alliance" ? [{ turn: 1, quote: "How have you been feeling" }] : [],
          reason: r.id === "structure" ? "Too short." : null,
        })),
        narrative: "n",
        excerpts: [],
      },
    } as never);
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages, durationSec: 120, language: "en" });
    expect(r.aiSource).toBe("gateway");
    expect(r.scores.overall).toBe(60);
    expect(r.scores.unscored_items?.map((u) => [u.id, u.reason])).toEqual([["structure", "Too short."]]);
    expect(r.scores.items[0]?.evidence).toEqual([
      { turn: 1, speaker: "therapist", quote: "How have you been feeling" },
    ]);
  });
});
