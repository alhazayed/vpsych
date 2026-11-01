import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A session where the therapist said nothing is not sent to the examiner:
// the report says "too short", scores nothing, and is never labelled as a
// model reply. A session with one therapist turn still goes to the examiner.

const chatMock = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  openAIService: { chat: (...args: unknown[]) => chatMock(...args) },
  hasOpenAIApiKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: (x: unknown) => x },
}));

const rubric = [
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
  rubric,
};

const opening = {
  role: "system" as const,
  content: "Session started. Speak with the patient avatar.",
  created_at: "2026-10-28T11:24:05Z",
};

describe("assessSession with no therapist turn", () => {
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

  for (const language of ["en", "ar"] as const) {
    it(`calls no model and scores nothing (${language})`, async () => {
      const { assessSession } = await import("@/lib/ai/assessment");
      const r = await assessSession({
        avatar,
        messages: [opening, { role: "user", content: "   ", created_at: opening.created_at }],
        durationSec: 81,
        language,
      });
      expect(chatMock).not.toHaveBeenCalled();
      expect(r.scores.too_short).toBe(true);
      expect(r.scores.items).toEqual([]);
      expect(r.scores.unscored_items?.map((u) => u.id)).toEqual(rubric.map((x) => x.id));
      expect(r.scores.overall).toBe(0);
      expect(r.scores.trainee_feedback).toBeUndefined();
      // No examiner ran: never presented as a model reply.
      expect(r.aiSource).toBe("persona_fallback");
      expect(r.scores.scientific_provenance?.assessment_mode).toBe("heuristic_fallback");
      expect(r.language).toBe(language);
      expect(r.narrative).toMatch(language === "ar" ? /قصيرة جداً/ : /Too short to assess/);
    });
  }

  it("still sends a session with one therapist turn to the examiner", async () => {
    chatMock.mockResolvedValue({
      text: JSON.stringify({
        items: rubric.map((x) => ({ id: x.id, score: 2, feedback: "ok" })),
        narrative: "Brief.",
        excerpts: [],
      }),
      model: "gpt-5",
    });
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({
      avatar,
      messages: [opening, { role: "user", content: "Hello.", created_at: opening.created_at }],
      durationSec: 30,
      language: "en",
    });
    expect(chatMock).toHaveBeenCalled();
    expect(r.aiSource).toBe("gpt");
    expect(r.scores.too_short).toBeUndefined();
  });

  it("is too short without any AI key as well", async () => {
    delete process.env.OPENAI_API_KEY;
    const { assessSession } = await import("@/lib/ai/assessment");
    const r = await assessSession({ avatar, messages: [opening], durationSec: 5, language: "en" });
    expect(r.scores.too_short).toBe(true);
    expect(r.scores.overall).toBe(0);
  });
});

describe("hasTherapistTurn", () => {
  it("needs a therapist line with words", async () => {
    const { hasTherapistTurn } = await import("@/lib/ai/assessment");
    expect(hasTherapistTurn([])).toBe(false);
    expect(hasTherapistTurn([{ role: "assistant", content: "Hi." }])).toBe(false);
    expect(hasTherapistTurn([{ role: "user", content: " \n" }])).toBe(false);
    expect(hasTherapistTurn([{ role: "user", content: "مرحبا" }])).toBe(true);
  });
});
