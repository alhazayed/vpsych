import { describe, expect, it } from "vitest";
import {
  assessCaseReadiness,
  assessPublishReadiness,
  isArabicPersonalityStub,
  type VirtualPatientWriteInput,
} from "@/lib/admin/virtual-patient";
import { getBuiltinPersonality } from "@/lib/personality-engine";
import type { AvatarPersonality, ClinicalCore, VoiceProfile } from "@/lib/types";

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

function arabicStubPersonality(): AvatarPersonality {
  const ar = basePersonality("ar-JO", "ليان (مسودة عربية)");
  ar.persona_prompt = [
    `أنت مريض تدريبي تخيلي للتعليم فقط — لست مريضاً حقيقياً.`,
    `يجب على المؤلف إكمال الشخصية العربية بشكل مستقل قبل النشر (لا تنسخ الإنجليزية).`,
  ].join("\n");
  return ar;
}

function clinicalCore(overrides: Partial<ClinicalCore> = {}): ClinicalCore {
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
    ...overrides,
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

const publishCtx = {
  voiceProfile: activeVoice,
  defaultDisorderId: "disorder-1",
  defaultDisorderActive: true,
};

function section(
  result: ReturnType<typeof assessCaseReadiness>,
  id: string,
) {
  return result.items.find((i) => i.id === id);
}

describe("Phase 10B case readiness", () => {
  it("marks a complete draft as ready to publish", () => {
    const input = publishReadyInput();
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
      avatarId: "avatar-1",
    });
    expect(result.readyToPublish).toBe(true);
    expect(result.publishGatesPassed).toBe(true);
    expect(result.summary).toBe("READY TO PUBLISH");
    expect(result.blockedCount).toBe(0);
    expect(result.arabicAuthorship).toBe("complete");
    for (const item of result.items) {
      expect(item.status).toBe("COMPLETE");
    }
    // UI and server agree with authoritative publish validator
    expect(assessPublishReadiness(input, publishCtx).publishReady).toBe(true);
  });

  it("allows incomplete draft slug-only payloads without claiming publish ready", () => {
    const result = assessCaseReadiness(
      { slug: "draft-only" },
      {},
      { lifecycleStatus: "draft", schemaVersion: 2 },
    );
    expect(result.readyToPublish).toBe(false);
    expect(result.summary).toBe("NOT READY TO PUBLISH");
    expect(result.blockedCount).toBeGreaterThan(0);
    expect(section(result, "clinical_presentation")?.status).toBe("BLOCKED");
  });

  it("blocks when symptoms are missing", () => {
    const input = publishReadyInput();
    input.clinical_core = clinicalCore({ symptom_profile: [] });
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(section(result, "symptoms")?.status).toBe("BLOCKED");
    expect(section(result, "symptoms")?.explanation).toMatch(/symptom/i);
    expect(result.publishBlockers.some((b) => /symptom/i.test(b))).toBe(true);
  });

  it("blocks when session goals are missing", () => {
    const input = publishReadyInput();
    input.clinical_core = clinicalCore({ session_goals: [] });
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "testing",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(section(result, "session_goals")?.status).toBe("BLOCKED");
  });

  it("blocks when therapeutic framework is missing", () => {
    const input = publishReadyInput();
    input.clinical_core = clinicalCore({ ideal_approach: "" });
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(section(result, "therapeutic_framework")?.status).toBe("BLOCKED");
  });

  it("blocks when English personality is missing", () => {
    const input = publishReadyInput();
    delete input.personalities!["en-US"];
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(section(result, "english_personality")?.status).toBe("BLOCKED");
    expect(assessPublishReadiness(input, publishCtx).publishReady).toBe(false);
  });

  it("blocks Arabic stub authoring (Guided مسودة عربية)", () => {
    const input = publishReadyInput();
    input.personalities!["ar-JO"] = arabicStubPersonality();
    expect(isArabicPersonalityStub(input.personalities)).toBe(true);

    const publish = assessPublishReadiness(input, publishCtx);
    expect(publish.publishReady).toBe(false);
    expect(publish.issues.some((i) => i.code === "personality_ar_stub")).toBe(
      true,
    );

    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.arabicAuthorship).toBe("stub");
    expect(section(result, "arabic_personality")?.status).toBe("BLOCKED");
    expect(section(result, "arabic_personality")?.explanation).toMatch(
      /incomplete|stub/i,
    );
  });

  it("blocks when Arabic authoring is missing entirely", () => {
    const input = publishReadyInput();
    delete input.personalities!["ar-JO"];
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.arabicAuthorship).toBe("missing");
    expect(section(result, "arabic_personality")?.status).toBe("BLOCKED");
  });

  it("blocks preview validation when schema_version < 2", () => {
    const input = publishReadyInput();
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 1,
    });
    expect(result.readyToPublish).toBe(false);
    expect(section(result, "preview")?.status).toBe("BLOCKED");
    expect(section(result, "validation")?.status).toBe("BLOCKED");
    expect(result.publishBlockers.some((b) => /schema|preview/i.test(b))).toBe(
      true,
    );
  });

  it("reports published lifecycle without inviting publish", () => {
    const input = publishReadyInput();
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "published",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.summary).toBe("PUBLISHED");
    expect(result.publishBlockers.some((b) => /already published/i.test(b))).toBe(
      true,
    );
  });

  it("reports archived lifecycle and asks to restore", () => {
    const input = publishReadyInput();
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "archived",
      schemaVersion: 2,
    });
    expect(result.readyToPublish).toBe(false);
    expect(result.summary).toBe("ARCHIVED");
    expect(result.nextAction).toMatch(/restore/i);
  });

  it("never exposes raw implementation errors in explanations", () => {
    const input = publishReadyInput();
    input.clinical_core = clinicalCore({ symptom_profile: [] });
    const result = assessCaseReadiness(input, publishCtx, {
      lifecycleStatus: "draft",
      schemaVersion: 2,
    });
    for (const item of result.items) {
      expect(item.explanation).not.toMatch(/ECONNREFUSED|stack|postgres|supabase/i);
      expect(item.explanation).not.toMatch(/at Object\./);
    }
  });

  it("keeps readiness publish decision aligned with assessPublishReadiness", () => {
    const cases: VirtualPatientWriteInput[] = [
      publishReadyInput(),
      (() => {
        const i = publishReadyInput();
        i.clinical_core = clinicalCore({ session_goals: [] });
        return i;
      })(),
      (() => {
        const i = publishReadyInput();
        delete i.personalities!["en-US"];
        return i;
      })(),
      (() => {
        const i = publishReadyInput();
        i.personalities!["ar-JO"] = arabicStubPersonality();
        return i;
      })(),
    ];
    for (const input of cases) {
      const publish = assessPublishReadiness(input, publishCtx);
      const ready = assessCaseReadiness(input, publishCtx, {
        lifecycleStatus: "draft",
        schemaVersion: 2,
      });
      if (publish.publishReady) {
        expect(ready.publishGatesPassed).toBe(true);
        expect(ready.readyToPublish).toBe(true);
      } else {
        expect(ready.readyToPublish).toBe(false);
      }
    }
  });
});
