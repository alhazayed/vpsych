import { describe, expect, it } from "vitest";
import {
  assemblePerTurnReinforcement,
  assembleSystemPrompt,
  renderPromptTemplate,
  synthesizePromptInputFromFlat,
} from "@/lib/ai/prompt-engine";
import type { AvatarPersonality, ClinicalCore } from "@/lib/types";

const core: ClinicalCore = {
  disorder: "Major Depressive Disorder",
  age: 28,
  gender: "female",
  severity: "moderate",
  onset_duration: "4+ months",
  symptom_profile: [
    {
      id: "low_mood",
      description: "Low mood",
      domain: "mood",
      salience: "presenting",
    },
    {
      id: "anhedonia",
      description: "Anhedonia",
      salience: "elicited",
    },
  ],
  disclosure_rules: [
    {
      topic: "passive SI",
      condition: "on_safety_assessment",
      notes: "Only with careful inquiry",
    },
  ],
  session_goals: ["Build alliance"],
  ideal_approach: "Warm collaborative interview",
  risk_profile: {
    suicidal_ideation: "passive",
    self_harm: false,
    harm_to_others: false,
    substance_use: false,
  },
};

function personality(locale: "en-US" | "ar-JO"): AvatarPersonality {
  const isAr = locale === "ar-JO";
  return {
    locale,
    language: isAr ? "ar" : "en",
    dialect: isAr ? "Jordanian (Levantine) Arabic" : "American English",
    direction: isAr ? "rtl" : "ltr",
    authored_natively: true,
    never_translate: true,
    identity: {
      display_name: isAr ? "ليان خوري" : "Maya Chen",
      city: isAr ? "عمّان" : "Seattle",
      country: isAr ? "Jordan" : "United States",
      occupation: isAr ? "مصممة" : "Graphic designer",
      living_situation: isAr ? "مع شريكها" : "Lives with partner",
      family_context: isAr ? "أهلها بالخارج" : "Parents overseas",
    },
    persona_prompt: isAr
      ? "أنتِ ليان، مريضة تتحدثين بالعربية الأردنية."
      : "You are Maya, a patient speaking American English.",
    speech: {
      register: isAr ? "colloquial" : "neutral",
      pace: "slow",
      dialect_markers: isAr ? ["هسّه", "يعني"] : ["um", "I guess"],
      filler_words: isAr ? ["يعني"] : ["um"],
      sample_utterances: [],
      turn_length: "1–4",
      code_switching: isAr ? "OK, yeah" : "",
    },
    idioms_of_distress: isAr ? ["تعبانة"] : ["feeling heavy"],
    cultural_context: {
      stigma_framing: "mild",
      help_seeking_attitude: "ambivalent",
      family_involvement: "partner",
      authority_orientation: "collaborative",
      taboo_topics: ["failure"],
    },
    clinical_localization: [
      { symptom_id: "low_mood", expression: isAr ? "مزاج واطي" : "low mood" },
    ],
    language_module: {
      directive: isAr ? "بالعربية فقط" : "English only",
      script: isAr ? "Arab" : "Latn",
      forbidden_scripts: isAr ? [] : ["Arab"],
      per_turn_reinforcement: isAr ? "بالعربية فقط" : "English only",
      fallback_replies: isAr ? ["مش عارفة"] : ["I'm not sure"],
    },
    safety_module: {
      risk_disclosure_style: "careful",
      boundary_rules: ["Stay in role", "Never coach"],
      escalation_language: "Shift to safety",
      crisis_resources: [
        {
          name: isAr ? "الطوارئ" : "988",
          contact: isAr ? "911" : "988",
        },
      ],
    },
    voice: {
      stt_lang: isAr ? "ar-JO" : "en-US",
      tts_lang: isAr ? "ar-SA" : "en-US",
    },
    is_active: true,
  };
}

describe("renderPromptTemplate", () => {
  it("interpolates paths, each-blocks, and locale conditionals", () => {
    const rendered = renderPromptTemplate(
      `Hello {{name}}
{{#each items}} - {{label}} {{/each}}
[IF session.locale STARTS WITH "ar"]ARABIC[/IF]
[IF session.locale STARTS WITH "en"]ENGLISH[/IF]`,
      {
        name: "Maya",
        items: [{ label: "one" }, { label: "two" }],
        session: { locale: "en-US" },
      },
    );
    expect(rendered).toContain("Hello Maya");
    expect(rendered).toContain("- one");
    expect(rendered).toContain("- two");
    expect(rendered).toContain("ENGLISH");
    expect(rendered).not.toContain("ARABIC");
  });
});

describe("assembleSystemPrompt", () => {
  it("builds English modules for en sessions", () => {
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality: personality("en-US"),
      session: { locale: "en-US" },
    });
    expect(prompt).toContain("MODULE 1 — CLINICAL");
    expect(prompt).toContain("MODULE 1B — HUMAN CONVERSATION");
    expect(prompt).toContain("SYNDROME AUTHORITY");
    expect(prompt).toContain("Major Depressive Disorder");
    expect(prompt).toContain("Low mood");
    expect(prompt).toContain("passive SI");
    expect(prompt).toContain("You are Maya Chen from Seattle");
    expect(prompt).toContain("Language rules — mandatory");
    expect(prompt).toContain("MODULE 4 — SAFETY");
    expect(prompt).toContain("Harm to others: false");
    expect(prompt).toContain("988");
    expect(prompt).not.toContain("قواعد اللغة — إلزامية");
    expect(prompt).toContain("feeling heavy");
  });

  it("builds Arabic language module for ar sessions", () => {
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality: personality("ar-JO"),
      session: { locale: "ar-JO" },
    });
    expect(prompt).toContain("MODULE 1 — CLINICAL");
    expect(prompt).toContain("Major Depressive Disorder");
    expect(prompt).toContain("ليان خوري");
    expect(prompt).toContain("قواعد اللغة — إلزامية");
    expect(prompt).toContain("أنتِ ليان");
    expect(prompt).not.toContain("Language rules — mandatory");
    expect(prompt).toContain("الطوارئ");
  });

  it("injects locale substance facts from personality history_localization", () => {
    const ar = personality("ar-JO");
    ar.case_file = {
      history_localization: {
        substance_and_medication_context:
          "الكحول: ما ذاقته ولا مرة بحياتها، لا بالمناسبات ولا غيرها.",
      },
    };
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality: ar,
      session: { locale: "ar-JO" },
    });
    expect(prompt).toContain("Locale-specific substance & medication facts");
    expect(prompt).toContain("الكحول: ما ذاقته ولا مرة بحياتها");
    expect(prompt).not.toContain("glasses of wine");
  });
});

describe("assemblePerTurnReinforcement", () => {
  it("uses Arabic reminder for ar locale", () => {
    const text = assemblePerTurnReinforcement({
      clinical_core: core,
      personality: personality("ar-JO"),
      session: { locale: "ar" },
    });
    expect(text).toContain("تذكير");
    expect(text).toContain("ليان خوري");
    expect(text).toContain("بالعربية فقط");
  });

  it("uses English reminder for en locale", () => {
    const text = assemblePerTurnReinforcement({
      clinical_core: core,
      personality: personality("en-US"),
      session: { locale: "en-US" },
    });
    expect(text).toContain("Reminder");
    expect(text).toContain("Maya Chen");
  });
});

describe("synthesizePromptInputFromFlat", () => {
  it("produces a runnable assembly for legacy avatars", () => {
    const input = synthesizePromptInputFromFlat({
      name: "Legacy",
      disorder: "GAD",
      age: 30,
      gender: "male",
      persona_prompt: "You are a legacy patient.",
      locale: "en-US",
    });
    const prompt = assembleSystemPrompt(input);
    expect(prompt).toContain("GAD");
    expect(prompt).toContain("Legacy");
    expect(prompt).toContain("Language rules — mandatory");
  });
});
