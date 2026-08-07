/**
 * Staging certification — performance smoke harness.
 * Wall-clock timings for emotion / humanization / memory (no live LLM/DB).
 *
 * When CERT_WRITE_ARTIFACTS=1, writes:
 *   /opt/cursor/artifacts/staging-cert/phase6-performance.json
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  initEmotionState,
  tickEmotion,
  classifyTherapistIntervention,
} from "@/lib/emotion";
import { buildHumanizationTurn } from "@/lib/humanization";
import {
  extractFromUtterance,
  compressMemoryStore,
  needsCompression,
  appendMemoryEntries,
  emptyPatientMemoryStore,
  retrieveMemories,
  MEMORY_SOFT_CAP,
} from "@/lib/patient-memory";

const ARTIFACT_DIR = "/opt/cursor/artifacts/staging-cert";
const WRITE_ARTIFACTS = process.env.CERT_WRITE_ARTIFACTS === "1";

const EMOTION_TICKS = 100;
const HUMANIZATION_PLANS = 50;
const MEMORY_CYCLES = 20;

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
      age: 30,
      gender: "female",
      severity: "moderate",
      onset_duration: "1 year",
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
  } as unknown as CaseInstanceSnapshot;
}

const THERAPIST_LINES = [
  "That sounds really hard.",
  "I'm glad you're here.",
  "You should stop overreacting.",
  "Let me stop you there — next question?",
  "It makes sense you'd feel that way.",
  "Tell me more about that.",
] as const;

const PATIENT_LINES = [
  "I work as a nurse at the city hospital.",
  "I take sertraline most mornings.",
  "I still get flashbacks from the accident.",
  "My sister lives with me now.",
  "I'm planning to start a support group.",
] as const;

describe("Phase 6 — performance smoke", () => {
  it("measures emotion, humanization, and memory cycle timings", () => {
    // --- Emotion: 100 ticks ---
    let emotion = initEmotionState({ disorderSlug: "mdd-recurrent-moderate" });
    const emotionStart = performance.now();
    for (let i = 0; i < EMOTION_TICKS; i++) {
      const line = THERAPIST_LINES[i % THERAPIST_LINES.length]!;
      const classified = classifyTherapistIntervention(line);
      emotion = tickEmotion({
        state: emotion,
        intervention: classified.primary,
        elapsedSeconds: 10 + (i % 40),
      }).state;
    }
    const emotionMs = performance.now() - emotionStart;
    expect(emotion.variables.baseline_mood).toBeGreaterThanOrEqual(0);

    // --- Humanization: 50 plans + cue sizes ---
    const cueSizes: number[] = [];
    const humStart = performance.now();
    for (let i = 0; i < HUMANIZATION_PLANS; i++) {
      const plan = buildHumanizationTurn({
        sessionId: `perf-hum-${i}`,
        caseSnapshot: minimalSnapshot(
          i % 2 === 0 ? "mdd-recurrent-moderate" : "ptsd",
        ),
        history: [
          {
            role: "assistant",
            content: PATIENT_LINES[i % PATIENT_LINES.length]!,
          },
        ],
        userMessage: THERAPIST_LINES[i % THERAPIST_LINES.length]!,
        sessionLanguage: "en",
        elapsedSeconds: 60 + i * 20,
        maxDurationSec: 2400,
        seed: `perf-hum-${i}`,
      });
      expect(plan).not.toBeNull();
      if (plan) {
        cueSizes.push(plan.prompt_cue.length);
        expect(plan.prompt_cue.length).toBeLessThan(2500);
        expect(plan.memory.recalled_facts).toEqual([]);
      }
    }
    const humanizationMs = performance.now() - humStart;

    const cueAvg =
      cueSizes.reduce((a, b) => a + b, 0) / Math.max(1, cueSizes.length);
    const cueMax = cueSizes.length ? Math.max(...cueSizes) : 0;
    const cueMin = cueSizes.length ? Math.min(...cueSizes) : 0;

    // --- Memory: 20 extract + retrieve + compress cycles ---
    let store = emptyPatientMemoryStore({
      therapistId: "perf-therapist",
      avatarId: "perf-avatar",
    });
    const memoryStart = performance.now();
    for (let cycle = 0; cycle < MEMORY_CYCLES; cycle++) {
      const utterance = PATIENT_LINES[cycle % PATIENT_LINES.length]!;
      const extracted = extractFromUtterance(utterance, { role: "assistant" });
      store = appendMemoryEntries(store, extracted, {
        sessionId: `perf-c${cycle}`,
      }).store;

      // Add unique fillers so compress occasionally triggers
      const fillers = [];
      for (let i = 0; i < 8; i++) {
        fillers.push({
          category: "life_event" as const,
          content: `Perf cycle ${cycle} filler detail ${i} about errands and weekend plans`,
          salience: 0.35,
          topics: ["life_event"],
          source: "transcript" as const,
          turn_index: i,
        });
      }
      store = appendMemoryEntries(store, fillers, {
        sessionId: `perf-c${cycle}`,
      }).store;

      retrieveMemories(store, "hospital nurse trauma medication", { limit: 5 });

      if (needsCompression(store) || store.entries.length > MEMORY_SOFT_CAP) {
        store = compressMemoryStore(store).store;
      }
    }
    const memoryMs = performance.now() - memoryStart;

    const summary = {
      generated_at: new Date().toISOString(),
      harness: "performance-smoke.integration.test.ts",
      cert_write_artifacts: WRITE_ARTIFACTS,
      timings_ms: {
        emotion_ticks_100: Math.round(emotionMs * 100) / 100,
        humanization_plans_50: Math.round(humanizationMs * 100) / 100,
        memory_cycles_20: Math.round(memoryMs * 100) / 100,
      },
      per_op_ms: {
        emotion_tick_avg: Math.round((emotionMs / EMOTION_TICKS) * 1000) / 1000,
        humanization_plan_avg:
          Math.round((humanizationMs / HUMANIZATION_PLANS) * 1000) / 1000,
        memory_cycle_avg:
          Math.round((memoryMs / MEMORY_CYCLES) * 1000) / 1000,
      },
      prompt_cue_chars: {
        samples: cueSizes.length,
        min: cueMin,
        max: cueMax,
        avg: Math.round(cueAvg * 10) / 10,
        bounded_under_2500: cueMax < 2500,
      },
      memory_entries_final: store.entries.length,
      // Soft budgets — smoke, not a hard SLA gate for CI flakes
      budgets: {
        emotion_100_under_ms: 2000,
        humanization_50_under_ms: 5000,
        memory_20_under_ms: 5000,
      },
      verdict: "PASS",
    };

    // Soft budgets — catch pathological regressions only
    expect(emotionMs).toBeLessThan(summary.budgets.emotion_100_under_ms);
    expect(humanizationMs).toBeLessThan(
      summary.budgets.humanization_50_under_ms,
    );
    expect(memoryMs).toBeLessThan(summary.budgets.memory_20_under_ms);
    expect(cueMax).toBeLessThan(2500);

    if (WRITE_ARTIFACTS) {
      mkdirSync(ARTIFACT_DIR, { recursive: true });
      writeFileSync(
        join(ARTIFACT_DIR, "phase6-performance.json"),
        JSON.stringify(summary, null, 2),
      );
    }

    // eslint-disable-next-line no-console
    console.log("PHASE6_PERFORMANCE_JSON=" + JSON.stringify(summary));
  });
});
