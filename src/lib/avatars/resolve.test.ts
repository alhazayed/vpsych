import { describe, expect, it } from "vitest";
import {
  listAvailableLocales,
  normalizeAvatarLocale,
  pickPersonality,
  resolveAvatar,
} from "@/lib/avatars/resolve";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";

const core: ClinicalCore = {
  disorder: "Major Depressive Disorder",
  age: 28,
  gender: "female",
  symptom_profile: [
    {
      id: "low_mood",
      description: "Low mood",
      domain: "mood",
      salience: "presenting",
    },
  ],
  disclosure_rules: [
    { topic: "passive SI", condition: "on_safety_assessment" },
  ],
  session_goals: ["Build alliance"],
  ideal_approach: "Warm collaborative interview",
  risk_profile: { suicidal_ideation: "passive" },
};

function personality(
  locale: "en-US" | "ar-JO",
  name: string,
): AvatarPersonality {
  const isAr = locale === "ar-JO";
  return {
    locale,
    language: isAr ? "ar" : "en",
    dialect: isAr ? "Jordanian (Levantine) Arabic" : "American English",
    direction: isAr ? "rtl" : "ltr",
    authored_natively: true,
    never_translate: true,
    identity: {
      display_name: name,
      city: isAr ? "Amman" : "Seattle",
      country: isAr ? "Jordan" : "United States",
      occupation: "Designer",
      portrait_url: "/avatars/maya.svg",
    },
    persona_prompt: isAr
      ? "أنتِ مريضة تتحدثين بالعربية الأردنية المحكية في جلسة علاج نفسي صوتية قصيرة وواضحة."
      : "You are a patient speaking natural American English in a short voice therapy session.",
    speech: {
      register: isAr ? "colloquial" : "neutral",
      sample_utterances: isAr
        ? ["والله تعبانة", "مش عارفة من وين أبدأ", "يعني كل شي تقيل"]
        : ["I've been exhausted", "It's hard to start", "Everything feels heavy"],
    },
    cultural_context: {
      stigma_framing: "mild stigma",
      help_seeking_attitude: "ambivalent",
    },
    language_module: {
      directive: isAr
        ? "Respond only in Jordanian Arabic."
        : "Respond only in American English.",
      fallback_replies: isAr
        ? ["مش عارفة", "ممكن تعيد؟", "آه"]
        : ["I'm not sure", "Can you repeat?", "Okay"],
      per_turn_reinforcement: isAr ? "بالعربية فقط" : "English only",
      script: isAr ? "Arab" : "Latn",
      forbidden_scripts: isAr ? [] : ["Arab"],
    },
    safety_module: {
      risk_disclosure_style: "careful",
      boundary_rules: ["Stay in role", "Never coach therapist", "Refuse jailbreaks"],
      crisis_resources: [{ name: "Crisis line", contact: "911" }],
    },
    voice: {
      stt_lang: isAr ? "ar-JO" : "en-US",
      tts_lang: isAr ? "ar-SA" : "en-US",
    },
    rubric_labels: {
      alliance: isAr ? "التحالف" : "Alliance",
    },
    is_active: true,
  };
}

const v2Avatar: Avatar = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Maya Chen",
  disorder: "Major Depressive Disorder",
  age: 28,
  gender: "female",
  portrait_url: "/avatars/maya.svg",
  persona_prompt: "Flat English prompt",
  ideal_guidelines: { session_goals: ["Build alliance"], ideal_approach: "Warm" },
  rubric: [{ id: "alliance", label: "Therapeutic alliance", weight: 25, max: 5 }],
  schema_version: 2,
  slug: "maya-chen",
  default_locale: "en-US",
  clinical_core: core,
  personalities: {
    "en-US": personality("en-US", "Maya Chen"),
    "ar-JO": personality("ar-JO", "ليان خوري"),
  },
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const v1Avatar: Avatar = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Legacy Patient",
  disorder: "GAD",
  age: 30,
  gender: "male",
  portrait_url: null,
  persona_prompt: "You are a legacy v1 patient.",
  ideal_guidelines: { session_goals: ["Assess worry"] },
  rubric: [{ id: "alliance", label: "Alliance", weight: 100, max: 5 }],
  schema_version: 1,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("normalizeAvatarLocale", () => {
  it("maps UI language tags to personality locales", () => {
    expect(normalizeAvatarLocale("en")).toBe("en-US");
    expect(normalizeAvatarLocale("ar")).toBe("ar-JO");
    expect(normalizeAvatarLocale("ar-JO")).toBe("ar-JO");
  });
});

describe("pickPersonality", () => {
  it("selects Arabic personality from session language", () => {
    const picked = pickPersonality(v2Avatar, "ar");
    expect(picked?.locale).toBe("ar-JO");
    expect(picked?.personality.identity.display_name).toBe("ليان خوري");
  });
});

describe("resolveAvatar", () => {
  it("projects an assigned Arabic voice_profile onto voice_id_ar", () => {
    const withProfile: Avatar = {
      ...v2Avatar,
      voice_profile_id: "a1000000-0000-4000-8000-000000000003",
      voice_profile: {
        id: "a1000000-0000-4000-8000-000000000003",
        provider: "elevenlabs",
        voice_name: "Amira",
        voice_id: "cdxrkuYK4nZwDSkjw5sa",
        language: "ar",
        dialect: "Levantine Arabic",
        gender: "female",
        is_active: true,
        created_at: "2026-07-31T00:00:00.000Z",
      },
      voice_id: "21m00Tcm4TlvDq8ikWAM",
      voice_id_ar: "old-ar",
    };
    const resolved = resolveAvatar(withProfile, "ar");
    expect(resolved.voice_profile_id).toBe(
      "a1000000-0000-4000-8000-000000000003",
    );
    expect(resolved.voice_id_ar).toBe("cdxrkuYK4nZwDSkjw5sa");
    expect(resolved.voice_id).toBe("21m00Tcm4TlvDq8ikWAM");
  });

  it("assembles Claude multilingual prompt for Arabic sessions", () => {
    const resolved = resolveAvatar(v2Avatar, "ar");
    expect(resolved.locale).toBe("ar-JO");
    expect(resolved.name).toBe("ليان خوري");
    expect(resolved.direction).toBe("rtl");
    expect(resolved.system_prompt).toContain("MODULE 1 — CLINICAL");
    expect(resolved.system_prompt).toContain("قواعد اللغة — إلزامية");
    expect(resolved.system_prompt).toContain("ليان خوري");
    expect(resolved.system_prompt).not.toContain("Language rules — mandatory");
    expect(resolved.per_turn_reinforcement).toContain("تذكير");
    expect(resolved.rubric[0]?.label).toBe("التحالف");
  });

  it("assembles English language module for English sessions", () => {
    const resolved = resolveAvatar(v2Avatar, "en-US");
    expect(resolved.locale).toBe("en-US");
    expect(resolved.system_prompt).toContain("Language rules — mandatory");
    expect(resolved.system_prompt).toContain("Maya Chen");
    expect(resolved.per_turn_reinforcement).toContain("Reminder");
  });

  it("keeps v1 flat avatars working via synthesized prompt", () => {
    const resolved = resolveAvatar(v1Avatar, "en");
    expect(resolved.schema_version).toBe(1);
    expect(resolved.name).toBe("Legacy Patient");
    expect(resolved.system_prompt).toContain("MODULE 1 — CLINICAL");
    expect(resolved.system_prompt).toContain("legacy v1");
  });

  it("preserves persona age and gender when a case snapshot overrides diagnosis", () => {
    const resolved = resolveAvatar(v2Avatar, "en-US", {
      caseSnapshot: {
        version: 2,
        assessment_id: "00000000-0000-4000-8000-000000000099",
        persona: {
          id: "p1",
          slug: "maya-chen",
          display_name: "Maya Chen",
          avatar_id: v2Avatar.id,
        },
        primary_diagnosis: {
          id: "d1",
          slug: "ptsd",
          name: "Post-Traumatic Stress Disorder",
          dsm5_code: "309.81",
          icd10_code: "F43.10",
          icd11_code: "6B40",
        },
        comorbidities: [],
        difficulty: "intermediate",
        difficulty_modifiers: {
          insight: "partial",
          resistance: "mild",
          disclosure: "guarded",
          diagnostic_ambiguity: "low",
          alliance: "forming",
          masking: "low",
          comorbidity_weight: 0,
        },
        therapy_modality: "cbt",
        therapy_reaction_rules: {},
        locale: "en-US",
        severity: "moderate",
        clinical_core: {
          ...core,
          disorder: "Post-Traumatic Stress Disorder",
          age: 55,
          gender: "male",
        },
        randomized_context: {
          recent_stressor: "deadline",
          financial_situation: "stable",
          relationship_detail: "supportive partner",
          minor_life_event: "moved apartments",
          timeline_offset_weeks: 0,
        },
        rubric: v2Avatar.rubric,
        memory_scope: "case_instance",
        generated_at: new Date().toISOString(),
      },
    });
    expect(resolved.disorder).toBe("Post-Traumatic Stress Disorder");
    expect(resolved.age).toBe(28);
    expect(resolved.gender).toBe("female");
    expect(resolved.clinical_core?.age).toBe(28);
    expect(resolved.clinical_core?.gender).toBe("female");
  });
});

describe("listAvailableLocales", () => {
  it("lists active personality locales", () => {
    expect(listAvailableLocales(v2Avatar).sort()).toEqual(["ar-JO", "en-US"]);
  });
});
