import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { FivePsFormulation } from "@/lib/types";
import { buildCaseFormulationKey, isEmptyFormulationKey } from "./formulation-key";

const chat = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/openai/service", () => ({ openAIService: { chat } }));
import {
  buildFormulationReviewPrompt,
  parseFormulationReview,
  reviewFormulation,
} from "./formulation-review";

const snapshot = {
  primary_diagnosis: { name: "Generalized anxiety disorder" },
  comorbidities: [{ name: "Insomnia disorder" }],
  severity: "moderate",
  randomized_context: {
    recent_stressor: "a health scare in someone close",
    financial_situation: "recent income drop of about 30%",
    relationship_detail: "supportive but emotionally distant household contact",
    minor_life_event: "slept through an alarm twice this week",
    timeline_offset_weeks: 5,
  },
  clinical_core: {
    onset_duration: "current episode about 13 weeks",
    symptom_profile: [
      { id: "worry", description: "Uncontrollable worry most days" },
      { id: "sleep", description: "Trouble falling asleep" },
    ],
    protective_factors: [
      { id: "pf-partner", label: "Supportive partner/friend", category: "social_support" },
      { id: "pf-job", label: "Stable employment", category: "employment" },
    ],
    case_file: {
      psychiatric_history: {
        medication_response_summary: "Brief SSRI trial, stopped after 12 days",
        previous_medications: [],
      },
    },
    formulation: {
      values: [{ id: "v", label: "Being responsible", weight: 70 }],
      schemas: [
        {
          id: "s",
          if_condition: "If I stop worrying",
          then_pattern: "then something bad will happen",
          linked_belief_ids: [],
          coping_bias: "reassurance_seeking",
        },
      ],
      distortions: [{ id: "d", distortion_kind: "catastrophizing", activation_topics: [] }],
      defense_mechanisms: [{ id: "dm", mechanism: "intellectualization", intensity: 40, topics: [] }],
      belief_system: {
        core_beliefs: [{ id: "b", statement: "I cannot cope if something goes wrong" }],
      },
    },
  },
} as unknown as CaseInstanceSnapshot;

const trainee: FivePsFormulation = {
  presenting: "Worry most days and poor sleep for three months.",
  predisposing: "Long-standing belief she cannot cope.",
  precipitating: "A relative's health scare.",
  perpetuating: "Believes worry prevents disaster; seeks reassurance.",
  protective: "Supportive partner and a steady job.",
};

describe("case formulation key", () => {
  it("reads each P from the frozen case snapshot", () => {
    const key = buildCaseFormulationKey(snapshot);
    expect(key.presenting).toEqual([
      "Generalized anxiety disorder (moderate)",
      "with Insomnia disorder",
      "Uncontrollable worry most days",
      "Trouble falling asleep",
      "current episode about 13 weeks",
    ]);
    expect(key.predisposing).toContain(
      "medication response summary: Brief SSRI trial, stopped after 12 days",
    );
    expect(key.predisposing).toContain('Core belief: "I cannot cope if something goes wrong"');
    expect(key.precipitating[0]).toBe("a health scare in someone close");
    expect(key.perpetuating).toEqual([
      'Rule: "If I stop worrying, then something bad will happen"',
      "Coping: reassurance seeking",
      "Thinking pattern: catastrophizing",
      "Defence: intellectualization",
    ]);
    expect(key.protective).toEqual([
      "Supportive partner/friend",
      "Stable employment",
      "Values: Being responsible",
    ]);
    // Minor life events are noise, not precipitants.
    expect(key.precipitating.join(" ")).not.toContain("alarm");
  });

  it("is empty, not a crash, for a missing or thin snapshot", () => {
    expect(isEmptyFormulationKey(buildCaseFormulationKey(null))).toBe(true);
    expect(
      isEmptyFormulationKey(
        buildCaseFormulationKey({ clinical_core: {} } as unknown as CaseInstanceSnapshot),
      ),
    ).toBe(true);
  });

  it("caps each P so the prompt stays bounded", () => {
    const many = {
      ...snapshot,
      clinical_core: {
        ...snapshot.clinical_core,
        protective_factors: Array.from({ length: 20 }, (_, i) => ({ label: `factor ${i}` })),
      },
    } as unknown as CaseInstanceSnapshot;
    expect(buildCaseFormulationKey(many).protective).toHaveLength(8);
  });
});

describe("formulation review prompt", () => {
  it("puts the case key beside the trainee's text for every P", () => {
    const { system, user } = buildFormulationReviewPrompt({
      trainee,
      key: buildCaseFormulationKey(snapshot),
      language: "en",
    });
    for (const p of ["presenting", "predisposing", "precipitating", "perpetuating", "protective"]) {
      expect(user).toContain(`(${p})`);
    }
    expect(user).toContain("- a health scare in someone close");
    expect(user).toContain(trainee.perpetuating);
    expect(system).toContain("FICTIONAL");
    expect(system).toContain("in English");
  });

  it("asks for Arabic notes in Arabic", () => {
    const { system } = buildFormulationReviewPrompt({
      trainee,
      key: buildCaseFormulationKey(null),
      language: "ar",
    });
    expect(system).toContain("in Arabic");
  });

  it("marks a P the case does not author", () => {
    const { user } = buildFormulationReviewPrompt({
      trainee,
      key: buildCaseFormulationKey(null),
      language: "en",
    });
    expect(user).toContain("(not specified by the case)");
  });
});

const goodJson = JSON.stringify({
  items: [
    { p: "presenting", rating: "matches", note: "Captures worry and sleep." },
    { p: "predisposing", rating: "partial", note: "Belief yes, history no." },
    { p: "precipitating", rating: "matches", note: "Health scare." },
    { p: "perpetuating", rating: "matches", note: "Rule and reassurance." },
    { p: "protective", rating: "matches", note: "Partner and job." },
  ],
});

describe("formulation review parsing", () => {
  it("accepts one valid item per P, in P order", () => {
    const items = parseFormulationReview(goodJson);
    expect(items?.map((i) => i.p)).toEqual([
      "presenting",
      "predisposing",
      "precipitating",
      "perpetuating",
      "protective",
    ]);
    expect(items?.[1]).toEqual({ p: "predisposing", rating: "partial", note: "Belief yes, history no." });
  });

  it("tolerates a fenced code block", () => {
    expect(parseFormulationReview("```json\n" + goodJson + "\n```")).not.toBeNull();
  });

  it.each([
    ["not json", "nope"],
    ["no items", "{}"],
    ["a P missing", JSON.stringify({ items: JSON.parse(goodJson).items.slice(0, 4) })],
    [
      "an unknown rating",
      JSON.stringify({
        items: JSON.parse(goodJson).items.map((i: { p: string }, n: number) =>
          n === 0 ? { ...i, rating: "excellent" } : i,
        ),
      }),
    ],
  ])("rejects %s", (_label, text) => {
    expect(parseFormulationReview(text)).toBeNull();
  });
});

describe("reviewFormulation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    chat.mockReset();
  });

  it("returns the parsed rating from the OpenAI path", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_CHAT_PROVIDER", "openai");
    chat.mockResolvedValue({ text: goodJson, model: "gpt-test", provider: "openai" });
    const result = await reviewFormulation({
      trainee,
      key: buildCaseFormulationKey(snapshot),
      language: "en",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.aiSource).toBe("gpt");
      expect(result.review.items).toHaveLength(5);
    }
    expect(chat.mock.calls[0]?.[0]).toMatchObject({ json: true });
  });

  it("fails closed on unusable model output and on provider errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_CHAT_PROVIDER", "openai");
    chat.mockResolvedValueOnce({ text: "{}", model: "gpt-test", provider: "openai" });
    const input = { trainee, key: buildCaseFormulationKey(snapshot), language: "en" as const };
    expect(await reviewFormulation(input)).toEqual({ ok: false, code: "AI_INVALID_OUTPUT" });
    chat.mockRejectedValueOnce(new Error("429 rate limit"));
    expect(await reviewFormulation(input)).toEqual({ ok: false, code: "AI_UNAVAILABLE" });
  });

  it("reports unavailable, without calling anything, when no AI key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const result = await reviewFormulation({
      trainee,
      key: buildCaseFormulationKey(snapshot),
      language: "en",
    });
    expect(result).toEqual({ ok: false, code: "AI_UNAVAILABLE" });
  });
});
