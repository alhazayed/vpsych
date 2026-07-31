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

describe("resolveAvatar", () => {
  it("resolves v2 Arabic personality without translating English identity", () => {
    const resolved = resolveAvatar(v2Avatar, "ar");
    expect(resolved.locale).toBe("ar-JO");
    expect(resolved.name).toBe("ليان خوري");
    expect(resolved.direction).toBe("rtl");
    expect(resolved.stt_lang).toBe("ar-JO");
    expect(resolved.system_prompt).toContain("ليان");
    expect(resolved.rubric[0]?.label).toBe("التحالف");
    expect(resolved.fallback_replies[0]).toMatch(/مش|ممكن|آه/);
  });

  it("keeps v1 flat avatars working", () => {
    const resolved = resolveAvatar(v1Avatar, "en");
    expect(resolved.schema_version).toBe(1);
    expect(resolved.name).toBe("Legacy Patient");
    expect(resolved.persona_prompt).toContain("legacy v1");
    expect(resolved.system_prompt).toContain("Disorder context: GAD");
  });

  it("lists available locales for v2", () => {
    expect(listAvailableLocales(v2Avatar).sort()).toEqual(["ar-JO", "en-US"]);
  });

  it("picks default locale when requested missing", () => {
    const picked = pickPersonality(v2Avatar, "fr-FR");
    expect(picked?.locale).toBe("en-US");
  });
});
