import { describe, expect, it } from "vitest";
import {
  BUILTIN_HUMAN_PERSONALITIES,
  MDD_CONTRAST_PERSONALITY,
  formatHumanPersonalityForPrompt,
  formatHumanPersonalityPerTurnCue,
  freezeHumanPersonalityForCase,
  getBuiltinPersonality,
  personalityDistinctnessScore,
  resolveHumanPersonality,
  synthesizeHumanPersonalityFromAvatar,
  validateHumanPersonality,
} from "@/lib/personality-engine";
import { assembleSystemPrompt, assemblePerTurnReinforcement } from "@/lib/ai/prompt-engine";
import { resolveAvatar } from "@/lib/avatars/resolve";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { findDisorderBySlug, getBuiltinCatalog } from "@/lib/case-engine/catalog";

function basePersonality(locale: "en-US" | "ar-JO"): AvatarPersonality {
  const isAr = locale.startsWith("ar");
  return {
    locale,
    language: isAr ? "ar" : "en",
    dialect: isAr ? "Jordanian Arabic" : "American English",
    direction: isAr ? "rtl" : "ltr",
    authored_natively: true,
    never_translate: true,
    identity: {
      display_name: isAr ? "ليان" : "Maya Chen",
      city: isAr ? "Amman" : "Seattle",
      country: isAr ? "Jordan" : "United States",
      occupation: isAr ? "مصممة" : "Designer",
      education: isAr ? "بكالوريوس" : "BFA",
    },
    persona_prompt: "You are a patient.",
    speech: {
      register: "colloquial",
      pace: "slow",
      filler_words: ["um"],
      sample_utterances: ["I'm tired."],
      turn_length: "1–3 sentences",
    },
    cultural_context: {
      stigma_framing: "private",
      help_seeking_attitude: "reluctant",
      taboo_topics: ["family shame"],
    },
    language_module: {
      directive: "Stay in character",
      script: isAr ? "Arab" : "Latn",
      forbidden_scripts: [],
      fallback_replies: ["..."],
      per_turn_reinforcement: "stay human",
    },
    safety_module: {
      crisis_resources: [{ name: "988", contact: "988" }],
      risk_disclosure_style: "soft",
      boundary_rules: ["Remain the patient"],
    },
    voice: { stt_lang: locale, tts_lang: locale },
  };
}

function mayaAvatar(): Avatar {
  return {
    id: "maya-id",
    name: "Maya Chen",
    disorder: "Major Depressive Disorder",
    age: 28,
    gender: "female",
    portrait_url: null,
    persona_prompt: "You are Maya.",
    ideal_guidelines: {},
    rubric: [],
    schema_version: 2,
    slug: "maya-chen",
    default_locale: "en-US",
    clinical_core: {
      disorder: "Major Depressive Disorder",
      age: 28,
      gender: "female",
      symptom_profile: [],
      disclosure_rules: [],
      session_goals: [],
      ideal_approach: "",
      risk_profile: { suicidal_ideation: "passive" },
    } satisfies ClinicalCore,
    personalities: {
      "en-US": basePersonality("en-US"),
    },
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

describe("Human Personality Engine validation", () => {
  it("accepts authored Maya en-US profile", () => {
    const profile = getBuiltinPersonality("maya-chen", "en-US");
    expect(profile).toBeTruthy();
    const result = validateHumanPersonality(profile);
    expect(result.ok).toBe(true);
  });

  it("accepts all builtin locale profiles", () => {
    for (const [slug, locales] of Object.entries(BUILTIN_HUMAN_PERSONALITIES)) {
      for (const [locale, profile] of Object.entries(locales)) {
        const result = validateHumanPersonality(profile);
        expect(result.ok, `${slug}/${locale}`).toBe(true);
      }
    }
  });

  it("rejects missing Big Five / required traits (fails closed)", () => {
    const profile = { ...getBuiltinPersonality("maya-chen", "en-US")! };
    delete (profile as { neuroticism?: number }).neuroticism;
    const result = validateHumanPersonality(profile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === "neuroticism")).toBe(true);
    }
  });
});

describe("Human Personality Engine resolve + format", () => {
  it("resolves builtin by slug without GPT", () => {
    const avatar = mayaAvatar();
    const profile = resolveHumanPersonality({
      avatar,
      locale: "en-US",
      personality: basePersonality("en-US"),
    });
    expect(profile.temperament).toMatch(/Slow-to-warm/i);
    expect(profile.attachment_style).toBe("anxious_preoccupied");
    expect(profile.memory_of_therapist.alliance_sensitivity).toBe(5);
  });

  it("prefers frozen snapshot over catalog drift", () => {
    const avatar = mayaAvatar();
    const frozen = {
      ...getBuiltinPersonality("maya-chen", "en-US")!,
      trust_level: 5 as const,
      trust_notes: "Frozen high trust for this session only.",
    };
    const profile = resolveHumanPersonality({
      avatar,
      locale: "en-US",
      snapshotProfile: frozen,
    });
    expect(profile.trust_level).toBe(5);
    expect(profile.trust_notes).toContain("Frozen");
  });

  it("formats every required trait into the prompt block", () => {
    const profile = getBuiltinPersonality("maya-chen", "en-US")!;
    const text = formatHumanPersonalityForPrompt(profile);
    for (const key of [
      "Temperament",
      "Attachment style",
      "Intelligence",
      "Education",
      "Occupation",
      "Culture",
      "Religion",
      "Resilience",
      "Openness",
      "Agreeableness",
      "Conscientiousness",
      "Neuroticism",
      "Coping style",
      "Humor",
      "Baseline trust",
      "Emotional regulation",
      "Speech style",
      "Vocabulary",
      "Preferred topics",
      "Avoidant topics",
      "Memory of therapist",
      "Treatment expectations",
    ]) {
      expect(text).toContain(key);
    }
  });

  it("per-turn cue stays compact and trait-bearing", () => {
    const cue = formatHumanPersonalityPerTurnCue(
      getBuiltinPersonality("jordan-hale", "en-US")!,
    );
    expect(cue).toMatch(/Stay THIS personality/);
    expect(cue).toMatch(/reassurance-seeking|anxious-preoccupied/);
  });
});

describe("Different patients with MDD still feel different", () => {
  it("Maya vs MDD-contrast fixture differ on many axes", () => {
    const maya = getBuiltinPersonality("maya-chen", "en-US")!;
    const alex = MDD_CONTRAST_PERSONALITY;
    // Both can present with depression; personalities must diverge hard.
    expect(maya.occupation).not.toBe(alex.occupation);
    expect(maya.humor).not.toBe(alex.humor);
    expect(maya.coping_style).not.toBe(alex.coping_style);
    expect(maya.speech_style).not.toBe(alex.speech_style);
    expect(personalityDistinctnessScore(maya, alex)).toBeGreaterThanOrEqual(8);
  });

  it("Maya vs Jordan remain distinct people even if both get MDD", () => {
    const maya = getBuiltinPersonality("maya-chen", "en-US")!;
    const jordan = getBuiltinPersonality("jordan-hale", "en-US")!;
    expect(personalityDistinctnessScore(maya, jordan)).toBeGreaterThanOrEqual(6);

    const catalog = getBuiltinCatalog();
    const mdd = findDisorderBySlug("mdd-recurrent-moderate", catalog)!;
    const personaMaya: PersonaRow = {
      id: "p-maya",
      avatar_id: "maya-id",
      slug: "maya-chen",
      display_name: "Maya Chen",
      identity: { age: 28, gender: "female" },
      traits: {},
      baseline_history: {},
      default_disorder_id: null,
      is_active: true,
    };
    const personaJordan: PersonaRow = {
      ...personaMaya,
      id: "p-jordan",
      avatar_id: "jordan-id",
      slug: "jordan-hale",
      display_name: "Jordan Hale",
      identity: { age: 34, gender: "non-binary" },
    };

    const caseMaya = generateCaseInstance({
      persona: personaMaya,
      avatarId: "maya-id",
      primaryDisorder: mdd,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "mdd-maya",
    });
    const caseJordan = generateCaseInstance({
      persona: personaJordan,
      avatarId: "jordan-id",
      primaryDisorder: mdd,
      difficulty: "intermediate",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "mdd-jordan",
    });
    expect(caseMaya.ok && caseJordan.ok).toBe(true);
    if (!caseMaya.ok || !caseJordan.ok) return;

    expect(caseMaya.snapshot.primary_diagnosis.slug).toBe("mdd-recurrent-moderate");
    expect(caseJordan.snapshot.primary_diagnosis.slug).toBe("mdd-recurrent-moderate");
    expect(caseMaya.snapshot.human_personality?.speech_style).not.toBe(
      caseJordan.snapshot.human_personality?.speech_style,
    );
    expect(caseMaya.snapshot.human_personality?.humor).toBe("rare_soft");
    expect(caseJordan.snapshot.human_personality?.humor).toBe("self_deprecating");
  });
});

describe("Prompt + resolveAvatar inject human personality every turn", () => {
  it("system prompt includes Module 2b traits", () => {
    const avatar = mayaAvatar();
    const resolved = resolveAvatar(avatar, "en-US");
    expect(resolved.human_personality?.avatar_slug).toBe("maya-chen");
    expect(resolved.system_prompt).toContain("MODULE 2b — HUMAN PERSONALITY");
    expect(resolved.system_prompt).toContain("Slow-to-warm");
    expect(resolved.system_prompt).toContain("Treatment expectations");
    expect(resolved.per_turn_reinforcement).toMatch(/Stay THIS personality/);
  });

  it("assembleSystemPrompt embeds formatted profile", () => {
    const profile = getBuiltinPersonality("jordan-hale", "en-US")!;
    const input = {
      clinical_core: {
        disorder: "GAD",
        age: 34,
        gender: "non-binary" as const,
        symptom_profile: [],
        disclosure_rules: [],
        session_goals: [],
        ideal_approach: "",
        risk_profile: { suicidal_ideation: "none" as const },
      },
      personality: basePersonality("en-US"),
      session: { locale: "en-US" },
      human_personality: profile,
    };
    const system = assembleSystemPrompt(input);
    expect(system).toContain("reassurance");
    expect(system).toContain("does that make sense");
    const turn = assemblePerTurnReinforcement(input);
    expect(turn).toContain("Stay THIS personality");
  });

  it("synthesize fallback still validates", () => {
    const avatar: Avatar = {
      id: "x",
      name: "Unknown",
      disorder: "MDD",
      age: 40,
      gender: "male",
      portrait_url: null,
      persona_prompt: "Hi",
      ideal_guidelines: {},
      rubric: [],
      slug: "unknown-patient",
      is_active: true,
      created_at: "",
      updated_at: "",
    };
    const profile = synthesizeHumanPersonalityFromAvatar({
      avatar,
      personality: null,
      locale: "en-US",
    });
    expect(validateHumanPersonality(profile).ok).toBe(true);
  });

  it("freezeHumanPersonalityForCase is deterministic", () => {
    const a = freezeHumanPersonalityForCase({
      personaSlug: "maya-chen",
      locale: "en-US",
    });
    const b = freezeHumanPersonalityForCase({
      personaSlug: "maya-chen",
      locale: "en-US",
    });
    expect(a).toEqual(b);
  });
});
