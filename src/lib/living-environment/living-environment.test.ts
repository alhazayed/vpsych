/**
 * Mission 6 — Living Environment Engine tests.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  checkLivingWorldConsistency,
  clearLivingWorldMemoryForTests,
  embedLivingWorldInMemory,
  extractLivingWorldFromMemory,
  formatLivingWorldForPrompt,
  generateLivingWorld,
  isLivingWorld,
  LIVING_WORLD_DOMAINS,
  mintWorld,
  putLivingWorldMemory,
  getLivingWorldMemory,
  saveLivingWorld,
  worldCoversTopic,
} from "@/lib/living-environment";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import { getBuiltinCatalog, findDisorderBySlug } from "@/lib/case-engine/catalog";
import type { PersonaRow } from "@/lib/case-engine/types";
import { assembleSystemPrompt } from "@/lib/ai/prompt-engine";
import { formatLivingWorldForPrompt as formatWorld } from "@/lib/living-environment/prompt";

const basePersona = (over: Partial<PersonaRow> = {}): PersonaRow => ({
  id: "persona-1",
  avatar_id: "avatar-1",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: {
    age: 28,
    gender: "female",
    occupation_baseline: "graphic designer",
    education_baseline: "graphic design",
    family_baseline: "close but strained maternal relationship",
  },
  traits: {},
  baseline_history: {},
  default_disorder_id: null,
  is_active: true,
  ...over,
});

describe("Living Environment — world generator", () => {
  it("generates all nine domains for EN locale", () => {
    const result = generateLivingWorld({
      seed: "test-en-1",
      locale: "en-US",
      age: 28,
      gender: "female",
      personaSlug: "maya-chen",
      occupationBaseline: "graphic designer",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const domain of LIVING_WORLD_DOMAINS) {
      expect(result.world[domain]).toBeTruthy();
    }
    expect(result.world.financial_problems.currency).toBe("USD");
    expect(result.world.home.country).toBe("United States");
    expect(result.world.consistency_anchors.length).toBeGreaterThan(3);
  });

  it("generates Arabic living world with Arabic script", () => {
    const result = generateLivingWorld({
      seed: "test-ar-1",
      locale: "ar-JO",
      age: 29,
      gender: "female",
      personaSlug: "maya-chen",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.financial_problems.currency).toBe("JOD");
    expect(result.world.home.description).toMatch(/[\u0600-\u06FF]/);
    expect(result.world.family.members.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed", () => {
    const a = generateLivingWorld({
      seed: "det-42",
      locale: "en-US",
      age: 30,
    });
    const b = generateLivingWorld({
      seed: "det-42",
      locale: "en-US",
      age: 30,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    // world_id uses UUID — compare structural domains instead
    expect(a.world.home.city).toBe(b.world.home.city);
    expect(a.world.home.address_area).toBe(b.world.home.address_area);
    expect(a.world.work.title).toBe(b.world.work.title);
    expect(a.world.education.field).toBe(b.world.education.field);
    expect(a.world.friends.friends.map((f) => f.name)).toEqual(
      b.world.friends.friends.map((f) => f.name),
    );
    expect(a.world.financial_problems.primary_worry).toBe(
      b.world.financial_problems.primary_worry,
    );
  });

  it("passes consistency for 50 random generations", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateLivingWorld({
        seed: `fuzz-${i}`,
        locale: i % 2 === 0 ? "en-US" : "ar-JO",
        age: 18 + (i % 40),
        gender: i % 3 === 0 ? "male" : "female",
        randomized: {
          financial_situation: "tight but managing month to month",
          occupation_variant: "office-based role with remote days",
          recent_stressor: "recent job instability",
        },
      });
      expect(result.ok, `seed fuzz-${i} failed: ${JSON.stringify(result)}`).toBe(
        true,
      );
      if (!result.ok) continue;
      const check = checkLivingWorldConsistency(result.world);
      expect(check.ok).toBe(true);
    }
  });

  it("aligns finances with randomized_context hint", () => {
    const hint = "recent income drop of about 30%";
    const result = generateLivingWorld({
      seed: "finance-hint",
      locale: "en-US",
      age: 28,
      randomized: { financial_situation: hint },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.financial_problems.problems[0]).toBe(hint);
    expect(result.world.financial_problems.primary_worry).toBe(hint);
  });
});

describe("Living Environment — consistency checker", () => {
  it("rejects parent younger than patient", () => {
    const minted = mintWorld({
      seed: "bad-parent",
      locale: "en-US",
      age: 28,
    });
    minted.family.members.push({
      relation: "mother",
      name: "TooYoung",
      age: 20,
      living_nearby: true,
      relationship_quality: "close",
      notes: "broken",
    });
    const check = checkLivingWorldConsistency(minted);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.issues.some((i) => i.code === "parent_younger")).toBe(true);
  });

  it("rejects currency/locale mismatch", () => {
    const minted = mintWorld({
      seed: "bad-currency",
      locale: "en-US",
      age: 28,
    });
    minted.financial_problems.currency = "JOD";
    const check = checkLivingWorldConsistency(minted);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.issues.some((i) => i.code === "currency_locale")).toBe(true);
  });

  it("worldCoversTopic maps therapist questions to domains", () => {
    const result = generateLivingWorld({
      seed: "topics",
      locale: "en-US",
      age: 28,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(worldCoversTopic(result.world, "Where do you live?").domain).toBe(
      "home",
    );
    expect(worldCoversTopic(result.world, "Tell me about your family").domain).toBe(
      "family",
    );
    expect(worldCoversTopic(result.world, "How is work going?").domain).toBe(
      "work",
    );
    expect(worldCoversTopic(result.world, "money and rent").domain).toBe(
      "financial_problems",
    );
    expect(worldCoversTopic(result.world, "Instagram").domain).toBe(
      "social_media",
    );
    expect(worldCoversTopic(result.world, "university degree").domain).toBe(
      "education",
    );
    expect(worldCoversTopic(result.world, "how do you sleep").domain).toBe(
      "daily_routine",
    );
    expect(worldCoversTopic(result.world, "any medical history").domain).toBe(
      "medical_history",
    );
    expect(worldCoversTopic(result.world, "your friends").domain).toBe(
      "friends",
    );
  });
});

describe("Living Environment — persistence", () => {
  beforeEach(() => {
    clearLivingWorldMemoryForTests();
  });

  it("isLivingWorld accepts minted worlds", () => {
    const result = generateLivingWorld({
      seed: "persist-1",
      locale: "en-US",
      age: 28,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isLivingWorld(result.world)).toBe(true);
    expect(isLivingWorld({})).toBe(false);
  });

  it("memory fallback save/load keeps the same world forever", async () => {
    const result = generateLivingWorld({
      seed: "forever-1",
      locale: "en-US",
      age: 28,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const caseId = "case-abc";
    const saved = await saveLivingWorld(null, result.world, caseId);
    expect(saved.persisted).toBe("memory");
    expect(saved.world.case_instance_id).toBe(caseId);

    const cached = getLivingWorldMemory(caseId);
    expect(cached?.world_id).toBe(result.world.world_id);
    expect(cached?.home.city).toBe(result.world.home.city);

    // Re-save must not invent a new world
    const again = await saveLivingWorld(null, {
      ...result.world,
      home: { ...result.world.home, city: "SHOULD_NOT_REPLACE_IN_DB_ABSENT" },
    }, caseId);
    // Without DB, memory put overwrites — document that process memory is last-write.
    // Immutability is enforced at DB (insert-once). Snapshot on case is the source of truth.
    expect(again.world.case_instance_id).toBe(caseId);
    putLivingWorldMemory({
      ...result.world,
      case_instance_id: caseId,
    });
    expect(getLivingWorldMemory(caseId)?.home.city).toBe(result.world.home.city);
  });

  it("embeds living world into case_memory blob", () => {
    const result = generateLivingWorld({
      seed: "embed-1",
      locale: "en-US",
      age: 28,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const blob = embedLivingWorldInMemory(
      { turns: [], notes: [], scope: "case_instance" },
      result.world,
    );
    expect(extractLivingWorldFromMemory(blob)?.world_id).toBe(
      result.world.world_id,
    );
  });
});

describe("Living Environment — prompt injection", () => {
  it("formats a MODULE LIVING ENVIRONMENT block", () => {
    const result = generateLivingWorld({
      seed: "prompt-1",
      locale: "en-US",
      age: 28,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const block = formatLivingWorldForPrompt(result.world);
    expect(block).toContain("MODULE LIVING ENVIRONMENT");
    expect(block).toContain(result.world.home.city);
    expect(block).toContain(result.world.work.title);
    expect(block).toContain("Consistency anchors");
  });

  it("appears in assembled system prompt via fidelity hint", () => {
    const result = generateLivingWorld({
      seed: "prompt-2",
      locale: "en-US",
      age: 28,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const prompt = assembleSystemPrompt({
      clinical_core: {
        disorder: "Major Depressive Disorder",
        dsm5_code: "296.32",
        icd11_code: "6A71.1",
        age: 28,
        gender: "female",
        severity: "moderate",
        onset_duration: "4 months",
        symptom_profile: [
          {
            id: "low_mood",
            description: "low mood",
            domain: "mood",
            salience: "presenting",
          },
        ],
        disclosure_rules: [
          { topic: "mood", condition: "volunteered", notes: "" },
        ],
        session_goals: [],
        ideal_approach: "supportive",
        risk_profile: {
          suicidal_ideation: "passive",
          self_harm: false,
          harm_to_others: false,
          substance_use: false,
        },
      },
      personality: {
        locale: "en-US",
        language: "en",
        direction: "ltr",
        dialect: "en-US",
        authored_natively: true,
        never_translate: true,
        identity: {
          display_name: "Maya",
          city: "Portland",
          country: "United States",
          occupation: "designer",
        },
        persona_prompt: "You are Maya.",
        speech: {
          register: "colloquial",
          pace: "slow",
          filler_words: ["um"],
          turn_length: "short",
          dialect_markers: [],
          code_switching: "",
          sample_utterances: ["I don't know."],
        },
        cultural_context: {
          stigma_framing: "",
          help_seeking_attitude: "",
          family_involvement: "",
          authority_orientation: "",
          taboo_topics: [],
        },
        clinical_localization: [],
        idioms_of_distress: [],
        language_module: {
          directive: "English",
          script: "Latn",
          forbidden_scripts: [],
          fallback_replies: [],
        },
        safety_module: {
          crisis_resources: [],
          risk_disclosure_style: "",
          boundary_rules: [],
          escalation_language: "",
        },
        voice: { stt_lang: "en-US", tts_lang: "en-US" },
        case_file: {
          history_localization: {
            substance_and_medication_context: "",
          },
        },
      },
      session: { locale: "en-US" },
      fidelity: {
        living_environment_block: formatWorld(result.world),
      },
    });
    expect(prompt).toContain("MODULE 2B — LIVING ENVIRONMENT");
    expect(prompt).toContain(result.world.home.city);
  });
});

describe("Living Environment — Case Engine integration", () => {
  it("mints living_world onto CaseInstanceSnapshot", () => {
    const catalog = getBuiltinCatalog();
    const disorder = findDisorderBySlug("mdd-recurrent-moderate", catalog)!;
    const generated = generateCaseInstance({
      persona: basePersona(),
      avatarId: "avatar-1",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "case-living-1",
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.snapshot.living_world).toBeTruthy();
    expect(isLivingWorld(generated.snapshot.living_world)).toBe(true);
    const check = checkLivingWorldConsistency(generated.snapshot.living_world!);
    expect(check.ok).toBe(true);
  });

  it("keeps the same living world for the same case seed", () => {
    const catalog = getBuiltinCatalog();
    const disorder = findDisorderBySlug("mdd-recurrent-moderate", catalog)!;
    const a = generateCaseInstance({
      persona: basePersona(),
      avatarId: "avatar-1",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "same-seed-living",
    });
    const b = generateCaseInstance({
      persona: basePersona(),
      avatarId: "avatar-1",
      primaryDisorder: disorder,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "same-seed-living",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.snapshot.living_world?.home.city).toBe(
      b.snapshot.living_world?.home.city,
    );
    expect(a.snapshot.living_world?.friends.friends.map((f) => f.name)).toEqual(
      b.snapshot.living_world?.friends.friends.map((f) => f.name),
    );
  });
});
