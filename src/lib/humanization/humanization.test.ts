/**
 * Mission 10 — Humanization Engine unit + clinical accuracy tests.
 */

import { describe, expect, it } from "vitest";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  ALL_BEHAVIOR_IDS,
  applyClinicalGates,
  buildHumanizationTurn,
  classifyTherapistMove,
  emotionTick,
  behaviorTick,
  memoryTick,
  voiceTick,
  HUMANIZATION_CATALOG,
  isHumanizationEnabledForSession,
} from "@/lib/humanization";
import type { HumanizationBehaviorId } from "@/lib/humanization/types";

function minimalSnapshot(
  overrides?: Partial<CaseInstanceSnapshot> & {
    slug?: string;
    si?: "none" | "passive" | "active_no_plan" | "active_with_plan";
  },
): CaseInstanceSnapshot {
  const slug = overrides?.slug ?? "mdd-recurrent-moderate";
  return {
    schema_version: 2,
    locale: "en-US",
    primary_diagnosis: {
      id: "d1",
      slug,
      name: slug,
      dsm5_code: null,
      icd10_code: null,
      icd11_code: null,
    },
    comorbidities: [],
    difficulty: "intermediate",
    clinical_core: {
      disorder: slug,
      age: 34,
      gender: "female",
      severity: "moderate",
      onset_duration: "6 months",
      symptom_profile: [
        { id: "low-mood", description: "low mood", salience: "presenting" },
      ],
      disclosure_rules: [
        {
          topic: "risk",
          condition: "on_safety_assessment",
          notes: "passive only",
        },
      ],
      risk_profile: {
        suicidal_ideation: overrides?.si ?? "none",
        self_harm: false,
        harm_to_others: false,
        substance_use: false,
      },
    },
    difficulty_modifiers: {
      insight: "partial",
      resistance: "moderate",
      disclosure: "mixed",
      masking: "moderate",
      alliance: "neutral",
    },
    therapy_modality: "cbt",
    therapy_reaction_rules: {},
    severity: "moderate",
    randomized_context: {},
    memory_scope: "case_instance",
    generated_at: new Date().toISOString(),
    ...overrides,
  } as CaseInstanceSnapshot;
}

describe("Humanization catalog", () => {
  it("covers every Mission 10 behaviour id", () => {
    const required: HumanizationBehaviorId[] = [
      "thinking_pause",
      "hesitation",
      "false_start",
      "self_correction",
      "laughter",
      "crying",
      "breathing",
      "filler_words",
      "changing_mind",
      "asking_therapist_questions",
      "remembering_previous_sessions",
      "emotionally_reacting",
      "small_talk",
      "humor",
      "fatigue",
      "silence",
      "interruptions",
      "uncertainty",
      "look_away",
      "forget",
      "rephrase",
      "distracted",
      "be_emotional",
    ];
    for (const id of required) {
      expect(HUMANIZATION_CATALOG[id]).toBeDefined();
      expect(HUMANIZATION_CATALOG[id].directive_en.length).toBeGreaterThan(20);
      expect(HUMANIZATION_CATALOG[id].directive_ar.length).toBeGreaterThan(10);
    }
    expect(ALL_BEHAVIOR_IDS.length).toBe(required.length);
  });
});

describe("classifyTherapistMove", () => {
  it("detects safety, advice, validation, and questions", () => {
    expect(classifyTherapistMove("Are you thinking about suicide?")).toBe(
      "safety_check",
    );
    expect(classifyTherapistMove("You should just try journaling")).toBe(
      "advice",
    );
    expect(classifyTherapistMove("That sounds really hard")).toBe("validation");
    expect(classifyTherapistMove("How have you been sleeping?")).toBe(
      "open_question",
    );
    expect(classifyTherapistMove("Do you work full time?")).toBe(
      "closed_question",
    );
  });
});

describe("clinical gates", () => {
  it("blocks humour and laughter during active risk / safety turns", () => {
    const snapshot = minimalSnapshot({ si: "passive" });
    const gates = applyClinicalGates({
      snapshot,
      therapistMove: "safety_check",
      affect: "sad",
      intensity: 5,
      sessionPhase: "middle",
      hasPriorSessionMemory: false,
      turnIndex: 5,
    });
    expect(gates.allowed).not.toContain("humor");
    expect(gates.allowed).not.toContain("laughter");
    expect(gates.allowed).not.toContain("small_talk");
    expect(
      gates.blocked.some((b) => b.id === "humor"),
    ).toBe(true);
  });

  it("blocks remembering_previous_sessions without prior memory", () => {
    const gates = applyClinicalGates({
      snapshot: minimalSnapshot(),
      therapistMove: "open_question",
      affect: "sad",
      intensity: 4,
      sessionPhase: "middle",
      hasPriorSessionMemory: false,
      turnIndex: 3,
    });
    expect(gates.allowed).not.toContain("remembering_previous_sessions");
  });

  it("suppresses low-energy behaviours for pressured/manic phenotype", () => {
    const gates = applyClinicalGates({
      snapshot: minimalSnapshot({ slug: "bipolar-mania" }),
      therapistMove: "open_question",
      affect: "irritable",
      intensity: 6,
      sessionPhase: "middle",
      hasPriorSessionMemory: false,
      turnIndex: 4,
    });
    expect(gates.allowed).not.toContain("fatigue");
    expect(gates.allowed).not.toContain("silence");
    expect(gates.allowed).not.toContain("thinking_pause");
  });

  it("requires elevated tearful affect for crying", () => {
    const low = applyClinicalGates({
      snapshot: minimalSnapshot(),
      therapistMove: "reflection",
      affect: "neutral",
      intensity: 3,
      sessionPhase: "middle",
      hasPriorSessionMemory: false,
      turnIndex: 4,
    });
    expect(low.allowed).not.toContain("crying");

    const high = applyClinicalGates({
      snapshot: minimalSnapshot(),
      therapistMove: "reflection",
      affect: "tearful",
      intensity: 7,
      sessionPhase: "middle",
      hasPriorSessionMemory: false,
      turnIndex: 4,
    });
    expect(high.allowed).toContain("crying");
  });
});

describe("engine ticks", () => {
  it("Emotion Engine reacts to triggers and moves", () => {
    const out = emotionTick({
      snapshot: minimalSnapshot(),
      therapistMove: "invalidation",
      userMessage: "You're fine, stop worrying about your mother.",
      fatigue: 0.2,
    });
    expect(out.triggers_fired.length).toBeGreaterThan(0);
    expect(out.primary).toBeTruthy();
    expect(out.intensity).toBeGreaterThanOrEqual(1);
    expect(out.intensity).toBeLessThanOrEqual(10);
  });

  it("Behavior Engine follows speech phenotype for MDD", () => {
    const emotion = emotionTick({
      snapshot: minimalSnapshot(),
      therapistMove: "open_question",
      userMessage: "How are you feeling today?",
      fatigue: 0.1,
    });
    const behavior = behaviorTick({
      snapshot: minimalSnapshot(),
      therapistMove: "open_question",
      emotion,
      fatigue: 0.1,
    });
    expect(behavior.speech_pace).toBe("slow");
    expect(behavior.speech_energy).toBe("low");
    expect(behavior.category).toBe("mood");
  });

  it("Memory Engine surfaces prior-session cues", () => {
    const mem = memoryTick({
      history: [
        { role: "assistant", content: "I've been sleeping maybe four hours." },
      ],
      userMessage: "Last time we talked about work — how is that?",
      therapistMove: "open_question",
      caseMemory: {
        humanization: {
          prior_session_notes: ["Mentioned conflict with manager at work"],
        },
      },
    });
    expect(mem.prior_session_cues.length).toBeGreaterThan(0);
    expect(mem.recalled_facts.length).toBeGreaterThan(0);
    expect(mem.imperfect_recall_ok).toBe(true);
  });

  it("Voice Engine lengthens pause for thinking_pause / silence", () => {
    const emotion = emotionTick({
      snapshot: minimalSnapshot(),
      therapistMove: "silence",
      userMessage: "...",
      fatigue: 0.4,
    });
    const behavior = behaviorTick({
      snapshot: minimalSnapshot(),
      therapistMove: "silence",
      emotion,
      fatigue: 0.4,
    });
    const voice = voiceTick({
      emotion,
      behavior,
      selected: ["thinking_pause", "hesitation"],
      fatigue: 0.4,
    });
    expect(voice.pause_before_ms).toBeGreaterThanOrEqual(700);
    expect(voice.stability).toBeGreaterThan(0);
    expect(voice.stability).toBeLessThanOrEqual(1);
  });
});

describe("buildHumanizationTurn", () => {
  it("returns null without clinical snapshot", () => {
    const plan = buildHumanizationTurn({
      sessionId: "s1",
      caseSnapshot: null,
      history: [],
      userMessage: "Hi",
      sessionLanguage: "en",
      elapsedSeconds: 30,
      maxDurationSec: 2400,
    });
    expect(plan).toBeNull();
  });

  it("is enabled when snapshot present", () => {
    expect(
      isHumanizationEnabledForSession({ hasClinicalSnapshot: true }),
    ).toBe(true);
  });

  it("produces a deterministic plan for the same seed", () => {
    const input = {
      sessionId: "sess-deterministic",
      caseSnapshot: minimalSnapshot(),
      history: [] as { role: "user" | "assistant"; content: string }[],
      userMessage: "How have you been sleeping lately?",
      sessionLanguage: "en",
      elapsedSeconds: 120,
      maxDurationSec: 2400,
      seed: "fixed-seed-42",
    };
    const a = buildHumanizationTurn(input);
    const b = buildHumanizationTurn(input);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.behaviors).toEqual(b!.behaviors);
    expect(a!.voice.pause_before_ms).toBe(b!.voice.pause_before_ms);
    expect(a!.prompt_cue).toContain("HUMANIZATION LAYER");
    expect(a!.per_turn_cue).toMatch(/Humanization this turn/i);
    expect(a!.behaviors.length).toBeGreaterThanOrEqual(1);
    expect(a!.behaviors.length).toBeLessThanOrEqual(4);
  });

  it("never selects clinically blocked humour on safety turns", () => {
    const plan = buildHumanizationTurn({
      sessionId: "sess-safety",
      caseSnapshot: minimalSnapshot({ si: "active_no_plan" }),
      history: [],
      userMessage: "Have you had thoughts of suicide this week?",
      sessionLanguage: "en",
      elapsedSeconds: 600,
      maxDurationSec: 2400,
      seed: "safety-seed",
    });
    expect(plan).not.toBeNull();
    expect(plan!.therapist_move).toBe("safety_check");
    expect(plan!.behaviors).not.toContain("humor");
    expect(plan!.behaviors).not.toContain("laughter");
    expect(plan!.behaviors).not.toContain("small_talk");
  });

  it("formats Arabic per-turn cues when locale is ar", () => {
    const plan = buildHumanizationTurn({
      sessionId: "sess-ar",
      caseSnapshot: { ...minimalSnapshot(), locale: "ar-JO" },
      history: [],
      userMessage: "كيف نومك؟",
      sessionLanguage: "ar",
      elapsedSeconds: 90,
      maxDurationSec: 2400,
      seed: "ar-seed",
    });
    expect(plan).not.toBeNull();
    expect(plan!.per_turn_cue).toMatch(/طبقة الأنسنة/);
    expect(plan!.prompt_cue.length).toBeGreaterThan(40);
  });

  it("can select remembering_previous_sessions when memory exists", () => {
    // Run several seeds; at least one should include prior-session behaviour
    // when it is allowed (not guaranteed every seed due to weighted pick).
    let seen = false;
    for (let i = 0; i < 40; i++) {
      const plan = buildHumanizationTurn({
        sessionId: `sess-mem-${i}`,
        caseSnapshot: minimalSnapshot(),
        history: [],
        userMessage: "Last time you mentioned work stress — still there?",
        sessionLanguage: "en",
        elapsedSeconds: 200,
        maxDurationSec: 2400,
        seed: `mem-seed-${i}`,
        caseMemory: {
          humanization: {
            prior_session_notes: ["Conflict with manager last session"],
          },
        },
      });
      if (plan?.behaviors.includes("remembering_previous_sessions")) {
        seen = true;
        break;
      }
    }
    expect(seen).toBe(true);
  });
});

describe("clinical accuracy invariants", () => {
  it("prompt cue forbids breaking clinical disclosure to perform humanity", () => {
    const plan = buildHumanizationTurn({
      sessionId: "sess-inv",
      caseSnapshot: minimalSnapshot(),
      history: [],
      userMessage: "Tell me more.",
      sessionLanguage: "en",
      elapsedSeconds: 100,
      maxDurationSec: 2400,
      seed: "inv-1",
    });
    expect(plan!.prompt_cue).toMatch(/Never break clinical disclosure/i);
  });

  it("manic plan prefers activation-compatible behaviours when selected", () => {
    const plan = buildHumanizationTurn({
      sessionId: "sess-mania",
      caseSnapshot: minimalSnapshot({ slug: "bipolar-mania" }),
      history: [],
      userMessage: "What's been on your mind?",
      sessionLanguage: "en",
      elapsedSeconds: 150,
      maxDurationSec: 2400,
      seed: "mania-1",
    });
    expect(plan).not.toBeNull();
    expect(plan!.behavior.speech_pace).toBe("pressured");
    for (const bad of ["fatigue", "silence", "thinking_pause"] as const) {
      expect(plan!.behaviors).not.toContain(bad);
    }
  });
});
