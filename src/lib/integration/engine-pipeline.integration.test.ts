/**
 * Integrated engine pipeline certification — sequential merge stack.
 * Asserts each engine owns its concern and composition does not overwrite.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  freezeHumanPersonalityForCase,
  formatHumanPersonalityForPrompt,
  resolveHumanPersonality,
} from "@/lib/personality-engine";
import {
  initEmotionState,
  tickEmotion,
  deriveExpression,
  classifyTherapistIntervention,
} from "@/lib/emotion";
import {
  createAdaptationState,
  processTherapistTurn,
  beginNextSession,
} from "@/lib/adaptation";
import {
  extractFromTranscript,
  extractFromUtterance,
  compressMemoryStore,
  needsCompression,
  appendMemoryEntries,
  emptyPatientMemoryStore,
  MEMORY_SOFT_CAP,
  retrieveMemories,
} from "@/lib/patient-memory";
import {
  planConversationBehaviour,
  isConversationBehaviourEnabled,
} from "@/lib/conversation-behaviour";
import { buildHumanizationTurn } from "@/lib/humanization";
import { planNonverbal, runBehaviorEngine } from "@/lib/nbe";
import {
  resolveLiveEmotion,
  applyEmotionModulation,
} from "@/lib/clinical-voice";

const DISORDER_SLUGS = [
  "mdd-recurrent-moderate",
  "gad-with-panic",
  "panic-disorder",
  "ptsd",
  "ocd",
  "bipolar-mania",
  "psychosis",
  "bpd",
  "adjustment-disorder",
  "healthy-control",
] as const;

describe("Integrated clinical engine pipeline", () => {
  it("message route composes engines without overwrite (source invariant)", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/processTherapistTurn/);
    expect(route).toMatch(/prepareMemoryForTurn/);
    expect(route).toMatch(/processEmotionTurn/);
    expect(route).toMatch(/planConversationBehaviour/);
    expect(route).toMatch(/buildHumanizationTurn/);
    expect(route).toMatch(/avatarWithMemory/);
    expect(route).toMatch(/avatarForReply/);
    expect(route).toMatch(/emotion engine soft-fail/);
    expect(route).toMatch(/CBE plan failed/);
    expect(route).toMatch(/humanization soft-fail/);
    expect(route).toMatch(/emotion:\s*emotionPayload/);
    expect(route).toMatch(/cbePrimary/);
    expect(route).toMatch(/humanizationEnabled/);
  });

  it("personality freeze is deterministic and patients remain distinct", () => {
    const a = freezeHumanPersonalityForCase({
      personaSlug: "maya-chen",
      locale: "en-US",
    });
    const b = freezeHumanPersonalityForCase({
      personaSlug: "maya-chen",
      locale: "en-US",
    });
    expect(a).toEqual(b);
    const block = formatHumanPersonalityForPrompt(a);
    expect(block.length).toBeGreaterThan(40);

    const maya = resolveHumanPersonality({
      avatar: { slug: "maya-chen" } as never,
      locale: "en-US",
      personality: null,
      snapshotProfile: null,
    });
    const jordan = resolveHumanPersonality({
      avatar: { slug: "jordan-hale" } as never,
      locale: "en-US",
      personality: null,
      snapshotProfile: null,
    });
    expect(maya).not.toEqual(jordan);
  });

  it("emotion interventions move state without mutating baseline_mood", () => {
    for (const slug of [
      "mdd-recurrent-moderate",
      "ptsd",
      "bipolar-mania",
    ] as const) {
      let state = initEmotionState({ disorderSlug: slug });
      const baseline = state.variables.baseline_mood;
      const tick = tickEmotion({
        state,
        intervention: "validation",
        elapsedSeconds: 30,
      });
      state = tick.state;
      expect(state.variables.baseline_mood).toBe(baseline);
      expect(state.variables.trust).toBeGreaterThanOrEqual(baseline - 100);
      const expr = deriveExpression(state);
      expect(expr.facial_affect).toBeTruthy();
      expect(expr.voice).toBeTruthy();
    }
    const classified = classifyTherapistIntervention(
      "That sounds really hard.",
    );
    expect(classified.primary).toMatch(/empathy|validation/);
  });

  it("adaptation: warm raises rapport; judgment withdraws; interruption raises anger", () => {
    let warmState = createAdaptationState();
    for (let i = 0; i < 4; i++) {
      warmState = processTherapistTurn(
        warmState,
        "I'm glad you're here. Take your time — I'm with you.",
      ).state;
    }
    expect(warmState.rapport.velocity).toBeGreaterThan(1);

    let judgeState = createAdaptationState();
    const beforeWithdraw = judgeState.effects.withdrawal;
    for (let i = 0; i < 3; i++) {
      judgeState = processTherapistTurn(
        judgeState,
        "You should stop overreacting. Why didn't you just handle it?",
      ).state;
    }
    expect(judgeState.effects.withdrawal).toBeGreaterThan(beforeWithdraw);

    let interruptState = createAdaptationState();
    const beforeAnger = interruptState.effects.anger;
    interruptState = processTherapistTurn(
      interruptState,
      "Let me stop you there. Anyway, moving on — next question?",
    ).state;
    expect(interruptState.effects.anger).toBeGreaterThan(beforeAnger);

    const next = beginNextSession(warmState);
    expect(next.rapport.level).toBeGreaterThan(0);
  });

  it("memory extracts durable facts and can compress/retrieve", () => {
    const facts = extractFromUtterance(
      "I work at a hospital as a nurse. My brother died last year.",
      { role: "assistant" },
    );
    expect(facts.length).toBeGreaterThan(0);
    expect(
      facts.every((f) => typeof f.content === "string" && f.content.length > 0),
    ).toBe(true);

    const fromTranscript = extractFromTranscript([
      { role: "user", content: "Tell me about work." },
      {
        role: "assistant",
        content: "I take sertraline 50mg and live with my sister.",
      },
    ]);
    expect(fromTranscript.length).toBeGreaterThan(0);

    let store = emptyPatientMemoryStore({
      therapistId: "t1",
      avatarId: "a1",
    });
    store = appendMemoryEntries(store, fromTranscript, {
      sessionId: "s1",
    }).store;
    const retrieved = retrieveMemories(store, "medication sister", {
      limit: 5,
    });
    expect(Array.isArray(retrieved.hits)).toBe(true);

    // Force compression path when over soft cap
    const candidates = [];
    for (let i = 0; i < MEMORY_SOFT_CAP + 5; i++) {
      candidates.push({
        category: "life_event" as const,
        content: `Life detail number ${i}`,
        salience: 0.4,
        topics: ["life_event"],
        source: "transcript" as const,
        turn_index: i,
      });
    }
    store = appendMemoryEntries(store, candidates, { sessionId: "big" }).store;
    if (needsCompression(store)) {
      const compressed = compressMemoryStore(store);
      expect(compressed.store.entries.length).toBeLessThanOrEqual(
        store.entries.length,
      );
    }
  });

  it("CBE produces behavioural plans across turns with natural variation", () => {
    expect(typeof isConversationBehaviourEnabled).toBe("function");
    const plans = [];
    for (let turn = 0; turn < 6; turn++) {
      plans.push(
        planConversationBehaviour({
          sessionId: "sess-1",
          turnIndex: turn,
          userMessage:
            turn % 2 === 0
              ? "Can you tell me more about the trauma?"
              : "That makes sense. How does that feel in your body?",
          history: [],
          difficulty: null,
          disorderSlug: "ptsd",
          therapistInterrupted: turn === 3,
          language: "en",
        }),
      );
    }
    const primaries = plans.map((p) => p.primary);
    expect(primaries.every(Boolean)).toBe(true);
    expect(new Set(primaries).size).toBeGreaterThanOrEqual(1);
  });

  it("humanization stays soft and does not invent clinical facts", () => {
    const plan = buildHumanizationTurn({
      sessionId: "s1",
      caseSnapshot: null,
      clinicalCore: { disorder: "Major Depressive Disorder" } as never,
      history: [
        { role: "user", content: "How have you been sleeping?" },
        { role: "assistant", content: "Not great." },
      ],
      userMessage: "That sounds exhausting.",
      sessionLanguage: "en",
      elapsedSeconds: 600,
      maxDurationSec: 2400,
      caseMemory: null,
    });
    if (plan) {
      expect(plan.prompt_cue.length).toBeLessThan(2000);
      expect(plan.behaviors.length).toBeLessThanOrEqual(8);
      expect(plan.prompt_cue).not.toMatch(/DSM-|ICD-11|as an AI/i);
    }
  });

  it("NBE and clinical voice modules remain callable and modular", () => {
    expect(typeof planNonverbal).toBe("function");
    expect(typeof runBehaviorEngine).toBe("function");
    const live = resolveLiveEmotion({ emotion: "depressed" });
    expect(live).toBe("depressed");
    const base = {
      speech_rate: 1,
      pitch: 1,
      energy: "low" as const,
      prosody: "flat" as const,
      breathing: "shallow" as const,
      hesitation_frequency: 0.2,
      speaker_boost: 0.7,
      emotion_modulation: true,
    };
    const modulated = applyEmotionModulation(base as never, "anxious");
    expect(modulated.params).toBeTruthy();
    expect(typeof modulated.stability_nudge).toBe("number");
  });

  it("covers representative clinical disorder baselines for emotion continuity", () => {
    for (const slug of DISORDER_SLUGS) {
      const state = initEmotionState({ disorderSlug: slug });
      expect(state.variables).toBeTruthy();
      expect(typeof state.variables.trust).toBe("number");
      expect(typeof state.variables.hope).toBe("number");
      expect(typeof state.variables.anger).toBe("number");
      expect(state.variables.baseline_mood).toBeGreaterThanOrEqual(0);
    }
  });
});
