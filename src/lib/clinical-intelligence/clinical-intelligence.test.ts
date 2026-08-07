/**
 * Clinical Intelligence runtime — unit + clinical + regression tests (Stage 6).
 */

import { describe, expect, it } from "vitest";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import { getBuiltinCatalog, findDisorderBySlug } from "@/lib/case-engine/catalog";
import { createAdaptationState, processTherapistTurn } from "@/lib/adaptation";
import { initEmotionState, tickEmotion } from "@/lib/emotion";
import { planConversationBehaviour } from "@/lib/conversation-behaviour";
import { MEMORY_CATEGORIES } from "@/lib/patient-memory/types";
import {
  applyBeliefStrengthOverride,
  buildBehaviorProfile,
  buildTherapyResponseProfile,
  classifyTherapyIntervention,
  createMindState,
  decidePatientTurn,
  defaultTherapyResponseProfile,
  embedMindState,
  extractMindState,
  formatDecisionPlanForPrompt,
  formatFormulationForPrompt,
  formatMseForPrompt,
  formatProtectivesForPrompt,
  normalizeTherapyResponseProfile,
  promoteClinicalIntelligence,
  promoteMentalStatusExam,
  promotePatientFormulation,
  promoteProtectiveFactors,
  protectiveEmotionPriors,
  therapyEffectForIntervention,
  updateHomeworkAdherence,
  validateBeliefSystem,
  validateMentalStatusExam,
  validatePatientDecisionPlan,
  validatePatientFormulation,
  validateTherapyResponseProfile,
  CI_MEMORY_CATEGORIES,
} from "@/lib/clinical-intelligence";

function basePersona() {
  return {
    id: "p1",
    avatar_id: "a1",
    slug: "maya-chen",
    display_name: "Maya Chen",
    identity: {
      age: 28,
      gender: "female" as const,
      values: ["family", "art"],
    },
    traits: {},
    baseline_history: {},
    default_disorder_id: null,
    is_active: true,
  };
}

describe("Clinical Intelligence — promotion", () => {
  it("promotes protective factors, MSE, and formulation onto ClinicalCore", () => {
    const catalog = getBuiltinCatalog();
    const disorder = findDisorderBySlug("mdd-recurrent-moderate", catalog)!;
    const gen = generateCaseInstance({
      persona: basePersona(),
      avatarId: "a1",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "ci-promote-1",
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    const core = gen.snapshot.clinical_core;
    expect(core.protective_factors?.length).toBeGreaterThanOrEqual(3);
    expect(core.mse?.version).toBe(1);
    expect(core.mse?.insight).toBeTruthy();
    expect(core.formulation?.version).toBe(1);
    expect(core.formulation?.belief_system.core_beliefs.length).toBeGreaterThan(0);
    expect(core.formulation?.patient_goals?.length).toBeGreaterThan(0);
    // patient_goals ≠ session_goals
    expect(core.session_goals).not.toEqual(core.formulation?.patient_goals);
    expect(gen.snapshot.therapy_reaction_rules.version).toBe(1);
    expect(
      (gen.snapshot.therapy_reaction_rules as { response_biases?: unknown })
        .response_biases,
    ).toBeTruthy();
  });

  it("keeps legacy 3-field therapy reaction bags loadable", () => {
    const legacy = {
      engages_with: ["empathy"],
      resists: ["advice-giving"],
      alliance_cue: "MI cue",
    };
    const profile = normalizeTherapyResponseProfile(
      legacy,
      "motivational_interviewing",
    );
    expect(profile.version).toBe(1);
    expect(profile.response_biases.advice_sensitivity).toBe("high");
    expect(validateTherapyResponseProfile(profile).ok).toBe(true);
  });

  it("validates formulation and MSE shapes", () => {
    const f = promotePatientFormulation({ disorderSlug: "gad" });
    expect(validatePatientFormulation(f).ok).toBe(true);
    expect(validateBeliefSystem(f.belief_system).ok).toBe(true);
    const mse = promoteMentalStatusExam({
      disorderSlug: "ptsd",
      difficultyInsight: "partial",
    });
    expect(validateMentalStatusExam(mse).ok).toBe(true);
  });
});

describe("Clinical Intelligence — therapy effects", () => {
  it("maps structured interventions to internal deltas (never speech edits)", () => {
    const mi = defaultTherapyResponseProfile("motivational_interviewing");
    const advice = therapyEffectForIntervention("advice", mi);
    expect((advice.deltas.motivation ?? 0) < 0).toBe(true);
    expect(advice.notes.some((n) => /advice/i.test(n))).toBe(true);

    const dbt = defaultTherapyResponseProfile("dbt");
    const changeFirst = therapyEffectForIntervention("confrontation", dbt);
    expect((changeFirst.deltas.anger ?? 0) > 0).toBe(true);

    expect(classifyTherapyIntervention("That makes sense given what happened")).toBe(
      "validation",
    );
    expect(
      classifyTherapyIntervention("Did you complete the thought record homework?"),
    ).toBe("homework_review");
  });

  it("builds modality profiles for CBT/DBT/ACT/MI/supportive/psychodynamic", () => {
    for (const m of [
      "cbt",
      "dbt",
      "act",
      "psychodynamic",
      "supportive",
      "motivational_interviewing",
    ] as const) {
      const p = buildTherapyResponseProfile(m);
      expect(p.modality).toBe(m);
      expect(p.engages_with.length).toBeGreaterThan(0);
    }
  });
});

describe("Clinical Intelligence — DecisionPlan façade", () => {
  it("aggregates Adaptation + Emotion + CBE deterministically", () => {
    let adaptation = createAdaptationState({
      caseInstanceId: "c1",
      therapistId: "t1",
    });
    adaptation = processTherapistTurn(
      adaptation,
      "I hear how hard this has been for you",
    ).state;

    const emotion = initEmotionState({
      caseInstanceId: "c1",
      sessionId: "s1",
      disorderSlug: "mdd-recurrent-moderate",
    });
    const tick = tickEmotion({
      state: emotion,
      therapistMessage: "I hear how hard this has been for you",
    });

    const behaviour = planConversationBehaviour({
      sessionId: "s1",
      turnIndex: 2,
      userMessage: "I hear how hard this has been for you",
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      difficulty: {
        insight: "partial",
        resistance: "moderate",
        disclosure: "guarded",
        alliance: "fragile",
        masking: "moderate",
      },
      disorderSlug: "mdd-recurrent-moderate",
    });

    const formulation = promotePatientFormulation({
      disorderSlug: "mdd-recurrent-moderate",
    });
    const plan = decidePatientTurn({
      adaptation,
      emotion: tick.state,
      behaviour,
      formulation,
      therapyProfile: defaultTherapyResponseProfile("cbt"),
      modality: "cbt",
      therapistMessage: "I hear how hard this has been for you",
      disorderSlug: "mdd-recurrent-moderate",
    });

    expect(validatePatientDecisionPlan(plan).ok).toBe(true);
    expect(plan.version).toBe(1);
    expect(["withhold", "deflect", "partial", "open"]).toContain(plan.disclosure);
    expect(plan.affect_mode).toBe(tick.state.mode);
    expect(plan.stance).toBe(adaptation.stance);

    const again = decidePatientTurn({
      adaptation,
      emotion: tick.state,
      behaviour,
      formulation,
      therapyProfile: defaultTherapyResponseProfile("cbt"),
      modality: "cbt",
      therapistMessage: "I hear how hard this has been for you",
      disorderSlug: "mdd-recurrent-moderate",
    });
    expect(again).toEqual(plan);

    const profile = buildBehaviorProfile({
      plan,
      behaviour,
      engagement: adaptation.effects.engagement,
    });
    expect(profile.disclosure).toBe(plan.disclosure);

    const prompt = formatDecisionPlanForPrompt(plan);
    expect(prompt).not.toMatch(/\bDecisionPlan\b/);
    expect(prompt.toLowerCase()).not.toMatch(/announce/);
  });

  it("biases MI advice resistance via therapy profile meta", () => {
    const plan = decidePatientTurn({
      therapyProfile: defaultTherapyResponseProfile("motivational_interviewing"),
      modality: "motivational_interviewing",
      therapistMessage: "You should just stop drinking already",
      disorderSlug: "alcohol-use-disorder",
    });
    expect(plan.meta.therapy_bias).toContain("resist_advice");
  });
});

describe("Clinical Intelligence — mind state namespace", () => {
  it("embeds without clobbering emotion / adaptation keys", () => {
    const mind = createMindState({
      caseInstanceId: "c1",
      formulation: promotePatientFormulation({ disorderSlug: "bpd" }),
    });
    const blob = embedMindState(
      {
        emotion: { mode: "engaged" },
        patient_adaptation: { rapport: { level: 50 } },
      },
      mind,
    );
    expect(blob.emotion).toEqual({ mode: "engaged" });
    expect(blob.patient_adaptation).toEqual({ rapport: { level: 50 } });
    expect(extractMindState(blob)?.version).toBe(1);
  });

  it("softens belief strengths without rewriting statements", () => {
    const f = promotePatientFormulation({ disorderSlug: "mdd-recurrent-moderate" });
    const id = f.belief_system.core_beliefs[0]!.id;
    const statement = f.belief_system.core_beliefs[0]!.statement;
    const next = applyBeliefStrengthOverride(f, { [id]: 40 });
    expect(next.belief_system.core_beliefs[0]!.statement).toBe(statement);
    expect(next.belief_system.core_beliefs[0]!.strength).toBe(40);
  });
});

describe("Clinical Intelligence — protectives / prompt fidelity", () => {
  it("computes emotion priors from protective strength", () => {
    const factors = promoteProtectiveFactors({ disorderSlug: "gad" });
    const priors = protectiveEmotionPriors(factors);
    expect(Number.isFinite(priors.hope_offset)).toBe(true);
    expect(formatProtectivesForPrompt(factors)).toMatch(/Protective factors/);
    expect(formatMseForPrompt(promoteMentalStatusExam({ disorderSlug: "gad" }))).toMatch(
      /Mental status/,
    );
    expect(
      formatFormulationForPrompt(
        promotePatientFormulation({ disorderSlug: "gad" }),
      ),
    ).not.toMatch(/DSM-5/);
  });

  it("updates homework adherence from alliance + conscientiousness", () => {
    const hw = updateHomeworkAdherence({
      current: { assigned: false, completed_band: "none" },
      allianceTrust: 80,
      conscientiousness: 5,
      assignedThisTurn: true,
    });
    expect(hw.assigned).toBe(true);
    expect(hw.completed_band).toBe("full");
  });
});

describe("Clinical Intelligence — memory category extensions", () => {
  it("extends LTM categories without removing legacy ones", () => {
    expect(MEMORY_CATEGORIES).toContain("trauma");
    expect(MEMORY_CATEGORIES).toContain("promise");
    for (const c of CI_MEMORY_CATEGORIES) {
      expect(MEMORY_CATEGORIES).toContain(c);
    }
  });
});

describe("Clinical Intelligence — promoteClinicalIntelligence API", () => {
  it("extends risk profile educationally without inventing SI", () => {
    const promoted = promoteClinicalIntelligence({
      clinicalCore: {
        disorder: "PTSD",
        age: 30,
        gender: "female",
        symptom_profile: [],
        disclosure_rules: [],
        session_goals: ["Assess trauma"],
        ideal_approach: "Trauma-informed",
        risk_profile: { suicidal_ideation: "none" },
      },
      disorderSlug: "ptsd",
      difficultyInsight: "partial",
      modality: "supportive",
    });
    expect(promoted.clinical_core.risk_profile.suicidal_ideation).toBe("none");
    expect(promoted.clinical_core.protective_factors!.length).toBeGreaterThan(0);
    expect(promoted.dissociation_bias).toBe("mild_detachment");
  });
});
