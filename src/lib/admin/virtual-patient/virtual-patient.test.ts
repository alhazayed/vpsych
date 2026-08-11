import { describe, expect, it } from "vitest";
import {
  assessDraftWrite,
  assessPublishReadiness,
  validateSlug,
  type VirtualPatientWriteInput,
} from "@/lib/admin/virtual-patient";
import { getBuiltinPersonality } from "@/lib/personality-engine";
import type { AvatarPersonality, ClinicalCore } from "@/lib/types";
import type { VoiceProfile } from "@/lib/types";

function basePersonality(locale: "en-US" | "ar-JO", name: string): AvatarPersonality {
  const isAr = locale === "ar-JO";
  return {
    locale,
    language: isAr ? "ar" : "en",
    language_native_name: isAr ? "العربية" : "English",
    dialect: isAr ? "Jordanian Arabic" : "American English",
    direction: isAr ? "rtl" : "ltr",
    authored_natively: true,
    never_translate: true,
    identity: {
      display_name: name,
      city: isAr ? "عمّان" : "Seattle",
      country: isAr ? "Jordan" : "United States",
      occupation: isAr ? "مصممة" : "Designer",
    },
    persona_prompt: isAr
      ? "أنتِ مريضة في جلسة علاج تدريبية. تحدّثي باللهجة الأردنية."
      : "You are a patient in a therapy training session. Speak naturally.",
    speech: {
      register: "colloquial",
      sample_utterances: isAr ? ["تعبانة كتير"] : ["I've been tired a lot"],
    },
    cultural_context: {
      stigma_framing: isAr ? "الوصمة موجودة" : "Stigma exists",
      help_seeking_attitude: isAr ? "مترددة" : "Hesitant",
    },
    language_module: {
      directive: isAr ? "تكلّمي بالعربي" : "Speak English",
      fallback_replies: isAr ? ["ما بعرف"] : ["I don't know"],
    },
    safety_module: {
      crisis_resources: [{ name: "Crisis", contact: "911" }],
      risk_disclosure_style: "cautious",
      boundary_rules: ["Stay in character"],
    },
    voice: {
      stt_lang: isAr ? "ar" : "en",
      tts_lang: isAr ? "ar" : "en",
    },
  };
}

function clinicalCore(): ClinicalCore {
  return {
    disorder: "Major Depressive Disorder",
    age: 28,
    gender: "female",
    severity: "moderate",
    symptom_profile: [
      { id: "low_mood", description: "Low mood most days", salience: "presenting" },
    ],
    disclosure_rules: [
      { topic: "suicidality", condition: "on_safety_assessment" },
    ],
    session_goals: ["Build alliance"],
    ideal_approach: "Warm, paced, safety-aware",
    risk_profile: { suicidal_ideation: "passive" },
  };
}

function publishReadyInput(): VirtualPatientWriteInput {
  const enHp = getBuiltinPersonality("maya-chen", "en-US")!;
  const arHp = getBuiltinPersonality("maya-chen", "ar-JO")!;
  return {
    slug: "new-patient-alpha",
    default_locale: "en-US",
    clinical_core: clinicalCore(),
    personalities: {
      "en-US": basePersonality("en-US", "Alex Rivera"),
      "ar-JO": basePersonality("ar-JO", "ليان"),
    },
    human_personality: {
      "en-US": { ...enHp, locale: "en-US", avatar_slug: "new-patient-alpha" },
      "ar-JO": { ...arHp, locale: "ar-JO", avatar_slug: "new-patient-alpha" },
    },
    rubric: [{ id: "alliance", label: "Alliance", weight: 1, max: 5 }],
    voice_profile_id: "voice-1",
    persona: {
      create: true,
      default_disorder_id: "disorder-1",
    },
  };
}

const activeVoice: VoiceProfile = {
  id: "voice-1",
  provider: "elevenlabs",
  voice_name: "Test",
  voice_id: "abc123",
  language: "en",
  dialect: null,
  gender: "female",
  is_active: true,
  created_at: new Date().toISOString(),
};

describe("virtual patient validation", () => {
  it("requires kebab-case slug", () => {
    expect(validateSlug("Bad Slug").length).toBeGreaterThan(0);
    expect(validateSlug("good-slug")).toEqual([]);
  });

  it("allows incomplete draft when slug is valid", () => {
    const result = assessDraftWrite({ slug: "draft-one" });
    expect(result.ok).toBe(true);
    expect(result.publishReady).toBe(false);
  });

  it("rejects invalid clinical_core on publish", () => {
    const input = publishReadyInput();
    input.clinical_core = { disorder: "", age: 0, gender: "female" } as ClinicalCore;
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(false);
    expect(result.issues.some((i) => i.gate === "clinical")).toBe(true);
  });

  it("blocks publish when EN personality missing", () => {
    const input = publishReadyInput();
    delete input.personalities!["en-US"];
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(false);
    expect(result.issues.some((i) => i.gate === "personality_en")).toBe(true);
  });

  it("blocks publish when AR personality missing", () => {
    const input = publishReadyInput();
    delete input.personalities!["ar-JO"];
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(false);
    expect(result.issues.some((i) => i.gate === "personality_ar")).toBe(true);
  });

  it("blocks publish when AR equals EN persona_prompt", () => {
    const input = publishReadyInput();
    input.personalities!["ar-JO"]!.persona_prompt =
      input.personalities!["en-US"]!.persona_prompt;
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(false);
    expect(
      result.issues.some((i) => i.code === "personality_ar_not_independent"),
    ).toBe(true);
  });

  it("blocks publish when human personality invalid", () => {
    const input = publishReadyInput();
    input.human_personality = {
      "en-US": { version: 1, locale: "en-US" },
      "ar-JO": input.human_personality!["ar-JO"],
    };
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(false);
    expect(result.issues.some((i) => i.gate === "human_personality_en")).toBe(
      true,
    );
  });

  it("blocks publish when voice missing", () => {
    const input = publishReadyInput();
    input.voice_profile_id = null;
    input.voice_id = null;
    input.voice_id_ar = null;
    const result = assessPublishReadiness(input, {
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(false);
    expect(result.issues.some((i) => i.gate === "voice")).toBe(true);
  });

  it("blocks publish when disorder inactive/missing", () => {
    const input = publishReadyInput();
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: null,
      defaultDisorderActive: false,
    });
    expect(result.publishReady).toBe(false);
    expect(result.issues.some((i) => i.gate === "disorder")).toBe(true);
  });

  it("passes publish gate when fully configured", () => {
    const input = publishReadyInput();
    const result = assessPublishReadiness(input, {
      voiceProfile: activeVoice,
      defaultDisorderId: "disorder-1",
      defaultDisorderActive: true,
    });
    expect(result.publishReady).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("virtual patient lifecycle contracts (pure)", () => {
  it("draft create path never reports is_active true in validation payload shape", () => {
    const draft = assessDraftWrite({ slug: "x-patient" });
    expect(draft.ok).toBe(true);
    // Publish readiness separate from draft ok
    expect(draft.publishReady).toBe(false);
  });

  it("duplicate slug format must be unique kebab-case (caller enforces uniqueness via RPC)", () => {
    expect(validateSlug("maya-chen-copy").length).toBe(0);
  });
});
