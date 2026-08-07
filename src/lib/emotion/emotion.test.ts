/**
 * Emotion Engine (Mission 2) — unit tests.
 */

import { describe, expect, it } from "vitest";
import {
  EMOTION_ENGINE_VERSION,
  EMOTION_VARIABLE_KEYS,
  applyDeltas,
  baselineForDisorder,
  classifyTherapistIntervention,
  computeOpenness,
  deriveExpression,
  effectForIntervention,
  expressionPromptBlock,
  initEmotionState,
  parseEmotionState,
  selectMode,
  tickEmotion,
  trustGatedDeltas,
} from "@/lib/emotion";

describe("Emotion Engine baselines", () => {
  it("exports a stable version", () => {
    expect(EMOTION_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("provides all ten emotional variables for MDD", () => {
    const v = baselineForDisorder("mdd-recurrent-moderate");
    for (const key of EMOTION_VARIABLE_KEYS) {
      expect(v[key]).toBeGreaterThanOrEqual(0);
      expect(v[key]).toBeLessThanOrEqual(100);
    }
    expect(v.baseline_mood).toBeLessThan(50);
    expect(v.fatigue).toBeGreaterThan(50);
  });

  it("gives PTSD high fear and low trust", () => {
    const v = baselineForDisorder("ptsd-chronic");
    expect(v.fear).toBeGreaterThan(60);
    expect(v.trust).toBeLessThan(40);
  });

  it("gives mania elevated mood and low fatigue", () => {
    const v = baselineForDisorder("bipolar-mania");
    expect(v.baseline_mood).toBeGreaterThan(60);
    expect(v.fatigue).toBeLessThan(40);
  });
});

describe("Therapist interventions", () => {
  it("validation increases trust and decreases anger", () => {
    const e = effectForIntervention("validation");
    expect(e.deltas.trust!).toBeGreaterThan(0);
    expect(e.deltas.anger!).toBeLessThan(0);
    expect(e.allianceBuilding).toBe(true);
  });

  it("empathy increases hope", () => {
    const e = effectForIntervention("empathy");
    expect(e.deltas.hope!).toBeGreaterThan(0);
  });

  it("hostility drives withdrawal (trust/rapport down, anger/stress up)", () => {
    const e = effectForIntervention("hostility");
    expect(e.deltas.trust!).toBeLessThan(0);
    expect(e.deltas.rapport!).toBeLessThan(0);
    expect(e.deltas.anger!).toBeGreaterThan(0);
    expect(e.deltas.stress!).toBeGreaterThan(0);
    expect(e.hostile).toBe(true);
  });

  it("gates positive trust gains when trust is low", () => {
    const raw = { trust: 10, anger: -5 };
    const low = trustGatedDeltas(raw, 20);
    const high = trustGatedDeltas(raw, 90);
    expect(low.trust!).toBeLessThan(high.trust!);
    // Negative deltas are not attenuated
    expect(low.anger).toBe(-5);
    expect(high.anger).toBe(-5);
  });
});

describe("Intervention classifier", () => {
  it("detects validation", () => {
    const r = classifyTherapistIntervention(
      "That makes sense — of course you would feel overwhelmed.",
    );
    expect(r.primary).toBe("validation");
  });

  it("detects empathy", () => {
    const r = classifyTherapistIntervention(
      "I can hear how painful that must feel for you.",
    );
    expect(r.primary).toBe("empathy");
  });

  it("detects hostility", () => {
    const r = classifyTherapistIntervention(
      "You're just being dramatic. Get over it.",
    );
    expect(r.primary).toBe("hostility");
  });

  it("maps empty message to silence", () => {
    expect(classifyTherapistIntervention("   ").primary).toBe("silence");
  });
});

describe("Emotion state machine", () => {
  it("initializes with engaged/guarded mode from baseline", () => {
    const state = initEmotionState({
      disorderSlug: "mdd-recurrent-moderate",
      sessionId: "s1",
    });
    expect(state.turn).toBe(0);
    expect(state.variables.baseline_mood).toBeGreaterThan(0);
    expect(["engaged", "guarded", "collapsed"]).toContain(state.mode);
  });

  it("validation raises trust over turns", () => {
    let state = initEmotionState({
      disorderSlug: "mdd-recurrent-moderate",
      now: "2026-08-07T00:00:00.000Z",
    });
    const before = state.variables.trust;
    for (let i = 0; i < 4; i++) {
      const tick = tickEmotion({
        state,
        intervention: "validation",
        now: `2026-08-07T00:0${i}:00.000Z`,
      });
      state = tick.state;
    }
    expect(state.variables.trust).toBeGreaterThan(before);
    expect(state.alliance_streak).toBeGreaterThan(0);
  });

  it("hostility moves toward withdrawal and lowers openness", () => {
    let state = initEmotionState({
      disorderSlug: "mdd-recurrent-moderate",
      overrides: { trust: 45, anger: 30 },
    });
    const openBefore = computeOpenness(state.variables, state.mode);
    for (let i = 0; i < 3; i++) {
      const tick = tickEmotion({
        state,
        intervention: "hostility",
        therapistMessage: "You're being ridiculous.",
      });
      state = tick.state;
    }
    expect(state.mode).toBe("withdrawn");
    expect(state.variables.trust).toBeLessThan(40);
    expect(state.variables.anger).toBeGreaterThan(30);
    const openAfter = computeOpenness(state.variables, state.mode);
    expect(openAfter).toBeLessThan(openBefore);
  });

  it("trust changes future responsiveness — low trust mutes empathy gains", () => {
    const lowTrust = initEmotionState({
      overrides: { trust: 15, hope: 30, rapport: 20 },
    });
    const highTrust = initEmotionState({
      overrides: { trust: 80, hope: 30, rapport: 20 },
    });
    const lowTick = tickEmotion({
      state: lowTrust,
      intervention: "empathy",
    });
    const highTick = tickEmotion({
      state: highTrust,
      intervention: "empathy",
    });
    const lowHopeGain =
      lowTick.state.variables.hope - lowTrust.variables.hope;
    const highHopeGain =
      highTick.state.variables.hope - highTrust.variables.hope;
    expect(highHopeGain).toBeGreaterThan(lowHopeGain);
  });

  it("applyDeltas never mutates baseline_mood", () => {
    const state = initEmotionState({});
    const next = applyDeltas(
      state.variables,
      { baseline_mood: 99, trust: 10 },
      1,
    );
    expect(next.baseline_mood).toBe(state.variables.baseline_mood);
    expect(next.trust).toBeGreaterThan(state.variables.trust);
  });

  it("selectMode returns withdrawn on streak or low trust + high anger", () => {
    const vars = initEmotionState({
      overrides: { trust: 20, anger: 70 },
    }).variables;
    expect(selectMode(vars, 2, 0)).toBe("withdrawn");
    expect(selectMode(vars, 0, 0)).toBe("withdrawn");
  });

  it("round-trips through parseEmotionState", () => {
    const state = initEmotionState({
      disorderSlug: "gad-moderate",
      caseInstanceId: "c1",
    });
    const parsed = parseEmotionState(JSON.parse(JSON.stringify(state)));
    expect(parsed).not.toBeNull();
    expect(parsed!.variables.fear).toBe(state.variables.fear);
    expect(parseEmotionState(null)).toBeNull();
    expect(parseEmotionState({ mode: "engaged" })).toBeNull();
  });
});

describe("Emotion expression layer", () => {
  it("derives voice, face, word choice, hesitation, body language", () => {
    const state = initEmotionState({
      disorderSlug: "mdd-recurrent-moderate",
    });
    const expr = deriveExpression(state);
    expect(expr.facial_affect).toBeTruthy();
    expect(expr.voice.rate).toBeGreaterThan(0);
    expect(expr.voice.stability).toBeGreaterThan(0);
    expect(expr.hesitation_ms).toBeGreaterThan(200);
    expect(expr.word_choice.length).toBeGreaterThan(0);
    expect(expr.body_language.length).toBeGreaterThan(0);
    expect(expr.animation_hooks.length).toBeGreaterThan(0);
    expect(expr.openness).toBeGreaterThanOrEqual(0);
  });

  it("withdrawn mode increases hesitation and shortens word choice", () => {
    let state = initEmotionState({
      overrides: { trust: 40, anger: 40 },
    });
    const engaged = deriveExpression(state);
    for (let i = 0; i < 3; i++) {
      state = tickEmotion({ state, intervention: "hostility" }).state;
    }
    const withdrawn = deriveExpression(state);
    expect(state.mode).toBe("withdrawn");
    expect(withdrawn.hesitation_ms).toBeGreaterThan(engaged.hesitation_ms);
    expect(
      withdrawn.word_choice.some((w) => /short|minimal|distance/i.test(w)),
    ).toBe(true);
    expect(withdrawn.body_language).toContain("look_away");
  });

  it("builds a prompt block for the patient agent", () => {
    const state = initEmotionState({});
    const block = expressionPromptBlock(deriveExpression(state));
    expect(block).toContain("Emotion Engine");
    expect(block).toContain("Word choice:");
    expect(block).toContain("Body language:");
  });
});

describe("Mission examples end-to-end", () => {
  it("Validation → trust↑ anger↓; Empathy → hope↑; Hostility → withdrawal", () => {
    const state = initEmotionState({
      disorderSlug: "mdd-recurrent-moderate",
      overrides: { trust: 40, anger: 50, hope: 30, rapport: 35 },
    });

    const afterValidation = tickEmotion({
      state,
      intervention: "validation",
    });
    expect(afterValidation.state.variables.trust).toBeGreaterThan(
      state.variables.trust,
    );
    expect(afterValidation.state.variables.anger).toBeLessThan(
      state.variables.anger,
    );

    const afterEmpathy = tickEmotion({
      state: afterValidation.state,
      intervention: "empathy",
    });
    expect(afterEmpathy.state.variables.hope).toBeGreaterThan(
      afterValidation.state.variables.hope,
    );

    let hostile = afterEmpathy.state;
    for (let i = 0; i < 2; i++) {
      hostile = tickEmotion({
        state: hostile,
        intervention: "hostility",
      }).state;
    }
    expect(hostile.mode).toBe("withdrawn");
    expect(hostile.variables.trust).toBeLessThan(
      afterEmpathy.state.variables.trust,
    );
  });
});
