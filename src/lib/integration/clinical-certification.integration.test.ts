/**
 * Staging certification — clinical + longitudinal simulation harness.
 * No live LLM / DB. Exercises existing engines only.
 *
 * When CERT_WRITE_ARTIFACTS=1, writes:
 *   /opt/cursor/artifacts/staging-cert/phase4-clinical-results.json
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
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
  type PatientAdaptationState,
} from "@/lib/adaptation";
import {
  extractFromUtterance,
  extractFromTranscript,
  compressMemoryStore,
  needsCompression,
  appendMemoryEntries,
  emptyPatientMemoryStore,
  hasEquivalentFact,
  MEMORY_SOFT_CAP,
  MEMORY_HARD_CAP,
  retrieveMemories,
  type PatientMemoryStore,
} from "@/lib/patient-memory";
import { planConversationBehaviour } from "@/lib/conversation-behaviour";
import { buildHumanizationTurn } from "@/lib/humanization";
import { planNonverbal, runBehaviorEngine } from "@/lib/nbe";
import {
  resolveLiveEmotion,
  applyEmotionModulation,
  DEFAULT_CLINICAL_VOICE_PARAMS,
} from "@/lib/clinical-voice";

const ARTIFACT_DIR = "/opt/cursor/artifacts/staging-cert";
const WRITE_ARTIFACTS = process.env.CERT_WRITE_ARTIFACTS === "1";

/**
 * Diagnostic scenarios.
 *
 * Slug notes / aliases (emotion baselines.ts + speechBehaviorForDisorder):
 * - ocd → emotion `/ocd/`; speech falls through to generic (no dedicated BY_SLUG)
 * - psychosis → use schizophrenia (speech + emotion `/schizo/`); "psychosis" alone
 *   would miss schizo regex and land on DEFAULT emotion baseline
 * - adjustment-disorder → no dedicated prior; emotion DEFAULT_BASELINE; speech generic
 * - healthy-control → alias for speech DEFAULT_PROFILE.slug "generic"; emotion DEFAULT
 */
const SCENARIOS = [
  {
    id: "mdd",
    disorderSlug: "mdd-recurrent-moderate",
    personaSlug: "maya-chen" as const,
    aliasNote: null,
  },
  {
    id: "gad",
    disorderSlug: "gad-with-panic",
    personaSlug: "jordan-hale" as const,
    aliasNote: null,
  },
  {
    id: "panic",
    disorderSlug: "panic-disorder",
    personaSlug: null,
    aliasNote: null,
  },
  {
    id: "ptsd",
    disorderSlug: "ptsd",
    personaSlug: null,
    aliasNote: null,
  },
  {
    id: "ocd",
    disorderSlug: "ocd",
    personaSlug: null,
    aliasNote: "emotion /ocd/; speech → generic (no BY_SLUG entry)",
  },
  {
    id: "bipolar-mania",
    disorderSlug: "bipolar-mania",
    personaSlug: null,
    aliasNote: null,
  },
  {
    id: "psychosis",
    disorderSlug: "schizophrenia",
    personaSlug: null,
    aliasNote: "requested psychosis → schizophrenia (closest speech/emotion slug)",
  },
  {
    id: "bpd",
    disorderSlug: "bpd",
    personaSlug: null,
    aliasNote: "personality closest = bpd",
  },
  {
    id: "adjustment",
    disorderSlug: "adjustment-disorder",
    personaSlug: null,
    aliasNote: "no dedicated baseline; emotion DEFAULT; speech generic",
  },
  {
    id: "healthy",
    disorderSlug: "healthy-control",
    personaSlug: null,
    aliasNote: "closest to speech generic / emotion DEFAULT_BASELINE",
  },
] as const;

/** ≥6 therapist turns mixing validation, empathy, hostility, interruption-like text. */
const THERAPIST_TURNS = [
  "That sounds really hard. Anyone would feel overwhelmed by that.",
  "I'm glad you're here. Take your time — I'm with you.",
  "You should stop overreacting. Why didn't you just handle it?",
  "Let me stop you there. Anyway, moving on — next question?",
  "It makes sense that you'd feel that way after everything you've been through.",
  "Tell me more about what that was like for you in your body.",
] as const;

const PATIENT_UTTERANCES = [
  "I work as a nurse at the city hospital.",
  "I take sertraline 50mg most mornings.",
  "I still get flashbacks from the accident last year.",
  "My sister lives with me now.",
  "I'm planning to start a support group next month.",
  "Actually, that is not what I said — you misunderstood.",
] as const;

type ScenarioResult = {
  id: string;
  disorderSlug: string;
  aliasNote: string | null;
  speechSlug: string;
  baselineMoodFrozen: boolean;
  trustRoseOnValidation: boolean;
  hostilityWithdrew: boolean;
  adaptationWarm: boolean;
  adaptationJudgment: boolean;
  adaptationInterrupt: boolean;
  personalityFreezeOk: boolean | null;
  memoryDurableFacts: number;
  traumaSurvivedCompress: boolean;
  cbePrimaryCount: number;
  cbeDistinctPrimaries: number;
  humanizationRecalledEmpty: boolean;
  humanizationNoInventedMeds: boolean;
  humanizationPromptChars: number;
  nbeOk: boolean;
  clinicalVoiceOk: boolean;
  passed: boolean;
};

type LongitudinalResult = {
  sessions: number;
  personalityFreezeEqual: boolean;
  rapportNeverHardReset: boolean;
  finalRapport: number;
  minRapportAfterCarry: number;
  memoryEntriesAfterCompress: number;
  memoryHardCapOk: boolean;
  noDuplicateFacts: boolean;
  maxHumanizationPromptChars: number;
  promptBounded: boolean;
  passed: boolean;
};

function minimalSnapshot(slug: string): CaseInstanceSnapshot {
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
        { id: "distress", description: "distress", salience: "presenting" },
      ],
      disclosure_rules: [],
      risk_profile: {
        suicidal_ideation: "none",
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
  } as CaseInstanceSnapshot;
}

function runScenario(scenario: (typeof SCENARIOS)[number]): ScenarioResult {
  const { disorderSlug, personaSlug } = scenario;
  const speech = speechBehaviorForDisorder(disorderSlug, null);

  // --- Emotion: baseline immutable; validation↑trust; hostility→withdrawn ---
  let emotion = initEmotionState({ disorderSlug });
  const baselineMood = emotion.variables.baseline_mood;
  const trust0 = emotion.variables.trust;

  const validationClass = classifyTherapistIntervention(THERAPIST_TURNS[0]);
  expect(validationClass.primary).toMatch(/empathy|validation/);

  for (const msg of [THERAPIST_TURNS[0], THERAPIST_TURNS[1], THERAPIST_TURNS[4]]) {
    const classified = classifyTherapistIntervention(msg);
    emotion = tickEmotion({
      state: emotion,
      intervention: classified.primary,
      elapsedSeconds: 20,
    }).state;
  }
  const trustAfterValidation = emotion.variables.trust;
  expect(emotion.variables.baseline_mood).toBe(baselineMood);

  for (const msg of [THERAPIST_TURNS[2], THERAPIST_TURNS[2], THERAPIST_TURNS[2]]) {
    const classified = classifyTherapistIntervention(msg);
    emotion = tickEmotion({
      state: emotion,
      intervention: classified.primary,
      elapsedSeconds: 15,
    }).state;
  }
  const expr = deriveExpression(emotion);
  expect(expr.facial_affect).toBeTruthy();
  expect(emotion.variables.baseline_mood).toBe(baselineMood);

  const baselineMoodFrozen = emotion.variables.baseline_mood === baselineMood;
  const trustRoseOnValidation = trustAfterValidation >= trust0;
  const hostilityWithdrew =
    emotion.mode === "withdrawn" ||
    emotion.variables.trust < trustAfterValidation ||
    emotion.withdrawal_streak >= 1;

  // --- Adaptation: warm / judgment / interruption ---
  let warm = createAdaptationState();
  for (let i = 0; i < 4; i++) {
    warm = processTherapistTurn(warm, THERAPIST_TURNS[1]).state;
  }
  const adaptationWarm = warm.rapport.velocity > 1;

  let judge = createAdaptationState();
  const withdraw0 = judge.effects.withdrawal;
  for (let i = 0; i < 3; i++) {
    judge = processTherapistTurn(judge, THERAPIST_TURNS[2]).state;
  }
  const adaptationJudgment = judge.effects.withdrawal > withdraw0;

  let interrupt = createAdaptationState();
  const anger0 = interrupt.effects.anger;
  interrupt = processTherapistTurn(interrupt, THERAPIST_TURNS[3]).state;
  const adaptationInterrupt = interrupt.effects.anger > anger0;

  // --- Personality freeze (maya-chen / jordan-hale when applicable) ---
  let personalityFreezeOk: boolean | null = null;
  if (personaSlug) {
    const a = freezeHumanPersonalityForCase({
      personaSlug,
      locale: "en-US",
    });
    const b = freezeHumanPersonalityForCase({
      personaSlug,
      locale: "en-US",
    });
    const block = formatHumanPersonalityForPrompt(a);
    personalityFreezeOk = JSON.stringify(a) === JSON.stringify(b) && block.length > 40;
    expect(a).toEqual(b);
    expect(block.length).toBeGreaterThan(40);

    const resolved = resolveHumanPersonality({
      avatar: { slug: personaSlug } as never,
      locale: "en-US",
      personality: null,
      snapshotProfile: null,
    });
    expect(resolved).toBeTruthy();
  }

  // --- Memory: durable facts; trauma survives compress ---
  let store = emptyPatientMemoryStore({
    therapistId: "cert-therapist",
    avatarId: `avatar-${scenario.id}`,
  });
  const durable = extractFromUtterance(PATIENT_UTTERANCES[0], {
    role: "assistant",
  });
  expect(durable.length).toBeGreaterThan(0);
  store = appendMemoryEntries(store, durable, { sessionId: "s0" }).store;

  const traumaFacts = extractFromUtterance(PATIENT_UTTERANCES[2], {
    role: "assistant",
  });
  expect(traumaFacts.some((f) => f.category === "trauma")).toBe(true);
  store = appendMemoryEntries(store, traumaFacts, { sessionId: "s0" }).store;

  const more = extractFromTranscript([
    { role: "user", content: "Tell me about work and meds." },
    { role: "assistant", content: PATIENT_UTTERANCES[1] },
    { role: "assistant", content: PATIENT_UTTERANCES[3] },
  ]);
  store = appendMemoryEntries(store, more, { sessionId: "s0" }).store;

  // Force compress path with filler + keep trauma sticky
  const fillers = [];
  for (let i = 0; i < MEMORY_SOFT_CAP + 10; i++) {
    fillers.push({
      category: (i % 2 === 0 ? "life_event" : "other") as const,
      content: `Session filler life detail ${i} about weekend errands and plans`,
      salience: 0.35,
      topics: ["life_event"],
      source: "transcript" as const,
      turn_index: i,
    });
  }
  store = appendMemoryEntries(store, fillers, { sessionId: "fill" }).store;
  let traumaSurvivedCompress = store.entries.some((e) => e.category === "trauma");
  if (needsCompression(store)) {
    const compressed = compressMemoryStore(store);
    store = compressed.store;
    traumaSurvivedCompress = store.entries.some((e) => e.category === "trauma");
  }
  expect(traumaSurvivedCompress).toBe(true);

  // --- Multi-turn CBE + humanization + NBE/voice ---
  const cbePrimaries: string[] = [];
  let humanizationRecalledEmpty = true;
  let humanizationNoInventedMeds = true;
  let humanizationPromptChars = 0;
  let nbeOk = true;
  let clinicalVoiceOk = true;

  for (let turn = 0; turn < THERAPIST_TURNS.length; turn++) {
    const userMessage = THERAPIST_TURNS[turn]!;
    const plan = planConversationBehaviour({
      sessionId: `cert-${scenario.id}`,
      turnIndex: turn,
      userMessage,
      history: [],
      difficulty: null,
      disorderSlug,
      therapistInterrupted: turn === 3,
      language: "en",
    });
    expect(plan.primary).toBeTruthy();
    cbePrimaries.push(plan.primary);

    const hum = buildHumanizationTurn({
      sessionId: `cert-${scenario.id}`,
      caseSnapshot: minimalSnapshot(disorderSlug),
      clinicalCore: { disorder: disorderSlug } as never,
      history: [
        { role: "user", content: "How have things been?" },
        { role: "assistant", content: PATIENT_UTTERANCES[turn % PATIENT_UTTERANCES.length]! },
      ],
      userMessage,
      sessionLanguage: "en",
      elapsedSeconds: 60 + turn * 45,
      maxDurationSec: 2400,
      caseMemory: null,
      seed: `cert-${scenario.id}-${turn}`,
    });
    expect(hum).not.toBeNull();
    if (hum) {
      humanizationPromptChars = Math.max(humanizationPromptChars, hum.prompt_cue.length);
      if (hum.memory.recalled_facts.length !== 0) humanizationRecalledEmpty = false;
      if (/sertraline|prozac|lithium|invented|prescribe/i.test(hum.prompt_cue)) {
        // Presentation-only: must not invent meds from memory into cue
        if (/sertraline|prozac|lithium/i.test(hum.prompt_cue)) {
          humanizationNoInventedMeds = false;
        }
      }
      expect(hum.memory.recalled_facts).toEqual([]);
      expect(hum.prompt_cue).not.toMatch(/sertraline|prozac|lithium/i);
      expect(hum.prompt_cue.length).toBeLessThan(2500);
    }

    try {
      const nbe = planNonverbal({
        disorderSlug,
        phase: turn % 2 === 0 ? "listening" : "speaking",
        seed: `nbe-${scenario.id}-${turn}`,
        intensity: 0.5,
      });
      expect(nbe).toBeTruthy();
      const behavior = runBehaviorEngine({
        disorderSlug,
        phase: "thinking",
        seed: `be-${scenario.id}-${turn}`,
        intensity: 0.45,
      });
      expect(behavior.intents).toBeTruthy();
      expect(behavior.sustained).toBeTruthy();
    } catch {
      nbeOk = false;
    }

    const live = resolveLiveEmotion({ disorderSlug });
    expect(typeof live).toBe("string");
    const modulated = applyEmotionModulation(
      DEFAULT_CLINICAL_VOICE_PARAMS,
      live === "neutral" ? "anxious" : live,
    );
    if (!modulated.params) clinicalVoiceOk = false;
  }

  const passed =
    baselineMoodFrozen &&
    trustRoseOnValidation &&
    hostilityWithdrew &&
    adaptationWarm &&
    adaptationJudgment &&
    adaptationInterrupt &&
    (personalityFreezeOk === null || personalityFreezeOk) &&
    traumaSurvivedCompress &&
    cbePrimaries.every(Boolean) &&
    humanizationRecalledEmpty &&
    humanizationNoInventedMeds &&
    nbeOk &&
    clinicalVoiceOk;

  return {
    id: scenario.id,
    disorderSlug,
    aliasNote: scenario.aliasNote,
    speechSlug: speech.slug,
    baselineMoodFrozen,
    trustRoseOnValidation,
    hostilityWithdrew,
    adaptationWarm,
    adaptationJudgment,
    adaptationInterrupt,
    personalityFreezeOk,
    memoryDurableFacts: durable.length,
    traumaSurvivedCompress,
    cbePrimaryCount: cbePrimaries.length,
    cbeDistinctPrimaries: new Set(cbePrimaries).size,
    humanizationRecalledEmpty,
    humanizationNoInventedMeds,
    humanizationPromptChars,
    nbeOk,
    clinicalVoiceOk,
    passed,
  };
}

function runLongitudinal(): LongitudinalResult {
  const freezeA = freezeHumanPersonalityForCase({
    personaSlug: "maya-chen",
    locale: "en-US",
  });
  const freezeB = freezeHumanPersonalityForCase({
    personaSlug: "maya-chen",
    locale: "en-US",
  });
  const personalityFreezeEqual =
    JSON.stringify(freezeA) === JSON.stringify(freezeB);

  let adaptation: PatientAdaptationState = createAdaptationState({
    caseInstanceId: "long-case",
    therapistId: "cert-therapist",
  });
  let memory: PatientMemoryStore = emptyPatientMemoryStore({
    therapistId: "cert-therapist",
    avatarId: "maya-chen",
    personaId: "maya-chen",
    longitudinalGroupId: "long-group-1",
  });

  let minRapportAfterCarry = Number.POSITIVE_INFINITY;
  let maxHumanizationPromptChars = 0;
  const coldBaseline = 38; // createAdaptationState default priorRapport

  for (let session = 0; session < 10; session++) {
    for (let turn = 0; turn < THERAPIST_TURNS.length; turn++) {
      adaptation = processTherapistTurn(
        adaptation,
        THERAPIST_TURNS[turn]!,
      ).state;

      const utterance =
        PATIENT_UTTERANCES[(session + turn) % PATIENT_UTTERANCES.length]!;
      const extracted = extractFromUtterance(utterance, { role: "assistant" });
      memory = appendMemoryEntries(memory, extracted, {
        sessionId: `long-s${session}`,
      }).store;

      // Re-append same fact — must not duplicate
      memory = appendMemoryEntries(memory, extracted, {
        sessionId: `long-s${session}`,
      }).store;

      const hum = buildHumanizationTurn({
        sessionId: `long-s${session}`,
        caseSnapshot: minimalSnapshot("mdd-recurrent-moderate"),
        history: [{ role: "assistant", content: utterance }],
        userMessage: THERAPIST_TURNS[turn]!,
        sessionLanguage: "en",
        elapsedSeconds: 90 + turn * 30,
        maxDurationSec: 2400,
        seed: `long-${session}-${turn}`,
      });
      if (hum) {
        maxHumanizationPromptChars = Math.max(
          maxHumanizationPromptChars,
          hum.prompt_cue.length,
        );
        expect(hum.prompt_cue.length).toBeLessThan(2500);
        expect(hum.memory.recalled_facts).toEqual([]);
      }
    }

    // Extra unique facts per session to pressure compress
    const extras = [];
    for (let i = 0; i < 12; i++) {
      extras.push({
        category: "life_event" as const,
        content: `Longitudinal session ${session} unique life detail ${i} about commuting and hobbies`,
        salience: 0.4,
        topics: ["life_event"],
        source: "transcript" as const,
        turn_index: i,
      });
    }
    memory = appendMemoryEntries(memory, extras, {
      sessionId: `long-s${session}`,
    }).store;

    if (needsCompression(memory)) {
      memory = compressMemoryStore(memory).store;
    }

    if (session < 9) {
      const beforeCarry = adaptation.rapport.level;
      adaptation = beginNextSession(adaptation);
      minRapportAfterCarry = Math.min(
        minRapportAfterCarry,
        adaptation.rapport.level,
      );
      // Soft carry — must not hard-reset toward cold stranger zero
      expect(adaptation.rapport.level).toBeGreaterThan(0);
      expect(adaptation.rapport.level).toBeGreaterThan(coldBaseline * 0.5);
      expect(Math.abs(adaptation.rapport.level - beforeCarry)).toBeLessThan(30);
    }
  }

  if (needsCompression(memory) || memory.entries.length > MEMORY_SOFT_CAP) {
    memory = compressMemoryStore(memory).store;
  }

  // Duplicate-equivalence check across store
  let noDuplicateFacts = true;
  for (let i = 0; i < memory.entries.length; i++) {
    const e = memory.entries[i]!;
    const others = {
      ...memory,
      entries: memory.entries.filter((_, j) => j !== i),
    };
    if (hasEquivalentFact(others, e.content, e.category)) {
      noDuplicateFacts = false;
      break;
    }
  }

  const rapportNeverHardReset =
    minRapportAfterCarry > 0 &&
    minRapportAfterCarry > coldBaseline * 0.5 &&
    adaptation.rapport.level > 0;

  const memoryEntriesAfterCompress = memory.entries.length;
  const memoryHardCapOk = memoryEntriesAfterCompress <= MEMORY_HARD_CAP;
  const promptBounded = maxHumanizationPromptChars < 2500;

  // Retrieve still works after longitudinal accumulation
  const retrieved = retrieveMemories(memory, "hospital nurse medication trauma", {
    limit: 8,
  });
  expect(Array.isArray(retrieved.hits)).toBe(true);

  const freezeEnd = freezeHumanPersonalityForCase({
    personaSlug: "maya-chen",
    locale: "en-US",
  });
  expect(freezeEnd).toEqual(freezeA);

  const passed =
    personalityFreezeEqual &&
    rapportNeverHardReset &&
    memoryHardCapOk &&
    noDuplicateFacts &&
    promptBounded;

  return {
    sessions: 10,
    personalityFreezeEqual,
    rapportNeverHardReset,
    finalRapport: adaptation.rapport.level,
    minRapportAfterCarry:
      minRapportAfterCarry === Number.POSITIVE_INFINITY
        ? adaptation.rapport.level
        : minRapportAfterCarry,
    memoryEntriesAfterCompress,
    memoryHardCapOk,
    noDuplicateFacts,
    maxHumanizationPromptChars,
    promptBounded,
    passed,
  };
}

describe("Phase 4 — clinical + longitudinal certification harness", () => {
  it("simulates 10 diagnostic scenarios across the engine stack", () => {
    const scenarioResults: ScenarioResult[] = [];
    for (const scenario of SCENARIOS) {
      scenarioResults.push(runScenario(scenario));
    }

    for (const r of scenarioResults) {
      expect(r.passed, `scenario ${r.id} (${r.disorderSlug}) failed`).toBe(
        true,
      );
      expect(r.cbePrimaryCount).toBeGreaterThanOrEqual(6);
      expect(r.cbeDistinctPrimaries).toBeGreaterThanOrEqual(1);
    }

    // Maya ≠ Jordan under shared locale
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

    const longitudinal = runLongitudinal();
    expect(longitudinal.passed).toBe(true);
    expect(longitudinal.sessions).toBe(10);
    expect(longitudinal.memoryEntriesAfterCompress).toBeLessThanOrEqual(
      MEMORY_HARD_CAP,
    );
    expect(longitudinal.maxHumanizationPromptChars).toBeLessThan(2500);

    const summary = {
      generated_at: new Date().toISOString(),
      harness: "clinical-certification.integration.test.ts",
      cert_write_artifacts: WRITE_ARTIFACTS,
      scenarios: scenarioResults,
      scenario_pass_count: scenarioResults.filter((r) => r.passed).length,
      scenario_total: scenarioResults.length,
      longitudinal,
      verdict:
        scenarioResults.every((r) => r.passed) && longitudinal.passed
          ? "PASS"
          : "FAIL",
    };

    expect(summary.verdict).toBe("PASS");

    if (WRITE_ARTIFACTS) {
      mkdirSync(ARTIFACT_DIR, { recursive: true });
      writeFileSync(
        join(ARTIFACT_DIR, "phase4-clinical-results.json"),
        JSON.stringify(summary, null, 2),
      );
    }

    // Always print structured JSON for optional shell capture
    // eslint-disable-next-line no-console
    console.log("PHASE4_CLINICAL_RESULTS_JSON=" + JSON.stringify(summary));
  });
});
