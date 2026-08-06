/**
 * Wave 3 Human Conversation Fidelity — regression probes.
 * Ensures every builtin disorder carries patient-language phenotype + speech cues
 * that reach Module 1 (not generic chatbot defaults).
 */
import { describe, expect, it } from "vitest";
import {
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import {
  generateCaseInstance,
  mergeDisclosureRules,
} from "@/lib/case-engine/generator";
import type { CaseGenerationRequest, PersonaRow } from "@/lib/case-engine/types";
import {
  formatSpeechBehaviorForPrompt,
  speechBehaviorForDisorder,
} from "@/lib/case-engine/speech-behavior";
import { assembleSystemPrompt } from "@/lib/ai/prompt-engine";
import {
  adaptPersonalityForCaseSnapshot,
  stripPersonaSyndromeSpeechBlocks,
} from "@/lib/avatars/resolve";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

const THIN_BEFORE = [
  "ptsd",
  "adult-adhd",
  "alcohol-use-disorder",
  "panic-disorder",
  "bpd",
  "delirium",
] as const;

const ALL_ACTIVE = [
  "mdd-recurrent-moderate",
  "gad-with-panic",
  "ptsd",
  "adult-adhd",
  "alcohol-use-disorder",
  "panic-disorder",
  "bpd",
  "complex-ptsd",
  "schizophrenia",
  "bipolar-mania",
  "delirium",
] as const;

const persona: PersonaRow = {
  id: "p-maya",
  avatar_id: "a-maya",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: null,
  is_active: true,
};

function baseCore(disorder: string): ClinicalCore {
  return {
    disorder,
    age: 28,
    gender: "female",
    severity: "moderate",
    symptom_profile: [
      { id: "x", description: "presenting", salience: "presenting" },
    ],
    disclosure_rules: [],
    session_goals: [],
    ideal_approach: "Supportive",
    risk_profile: { suicidal_ideation: "none" },
  };
}

describe("W3-HCF speech profiles", () => {
  it("covers every active builtin disorder slug", () => {
    for (const slug of ALL_ACTIVE) {
      const profile = speechBehaviorForDisorder(slug);
      expect(profile.slug).not.toBe("generic");
      expect(profile.behaviour_lines.length).toBeGreaterThanOrEqual(2);
      expect(formatSpeechBehaviorForPrompt(profile)).toMatch(/pace=/);
    }
  });
});

describe("W3-HCF catalog phenotype thickness", () => {
  it("formerly-thin packages have ≥4 symptoms and ≥3 disclosure rules", () => {
    const catalog = getBuiltinCatalog();
    for (const slug of THIN_BEFORE) {
      const d = findDisorderBySlug(slug, catalog)!;
      expect(d.package.symptom_profile?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(d.package.disclosure_rules?.length ?? 0).toBeGreaterThanOrEqual(3);
      // Patient language — not bare diagnostic labels alone
      const text = (d.package.symptom_profile ?? [])
        .map((s) => s.description)
        .join(" ");
      expect(text.length).toBeGreaterThan(80);
    }
  });

  it("generated teaching speech cue is disorder-specific", () => {
    const catalog = getBuiltinCatalog();
    for (const slug of THIN_BEFORE) {
      const primary = findDisorderBySlug(slug, catalog)!;
      const req: CaseGenerationRequest = {
        persona,
        avatarId: "a-maya",
        primaryDisorder: primary,
        comorbidities: [],
        difficulty: "intermediate",
        therapyModality: "supportive",
        locale: "en-US",
        seed: `hcf-${slug}`,
      };
      const g = generateCaseInstance(req);
      expect(g.ok).toBe(true);
      if (!g.ok) continue;
      expect(g.snapshot.clinical_teaching?.speech_behavior_cue).toMatch(
        new RegExp(slug.split("-")[0]!, "i"),
      );
      expect(
        g.snapshot.clinical_core.disclosure_rules.length,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("W3-HCF Module 1 injection", () => {
  it("assembleSystemPrompt includes speech profile and difficulty behaviour", () => {
    const cue = formatSpeechBehaviorForPrompt(
      speechBehaviorForDisorder("bipolar-mania"),
    );
    const prompt = assembleSystemPrompt({
      clinical_core: baseCore("Bipolar I Disorder, current manic episode"),
      personality: {
        locale: "en-US",
        language: "en",
        dialect: "American English",
        direction: "ltr",
        authored_natively: true,
        never_translate: true,
        identity: {
          display_name: "Maya Chen",
          city: "Seattle",
          country: "United States",
          occupation: "Designer",
        },
        persona_prompt: "You are Maya.",
        speech: { register: "neutral", pace: "slow", turn_length: "1–4" },
        idioms_of_distress: [],
        clinical_localization: [],
        cultural_context: {
          stigma_framing: "mild",
          help_seeking_attitude: "ambivalent",
          family_involvement: "partner",
        },
        case_file: {
          history_localization: {
            substance_and_medication_context: "none",
          },
        },
        voice: { voice_id: null, stt_lang: "en-US", tts_lang: "en-US" },
        language_module: {},
        safety_module: {
          risk_disclosure_style: "careful",
          escalation_language: "deflect",
          crisis_resources: [],
        },
      } as unknown as AvatarPersonality,
      session: { locale: "en-US" },
      fidelity: {
        speech_behavior_cue: cue,
        difficulty_behavior:
          "Session difficulty behaviour (enact — do not announce these labels):\n- Resistance high: passive…",
        therapy_process_cue:
          "HUMAN PATIENT & THERAPY PROCESS (mandatory — consultants are watching):\n- Hesitate.",
      },
    });
    expect(prompt).toContain("HOW YOU SPEAK THIS SESSION");
    expect(prompt).toMatch(/Pressured speech|pressured/i);
    expect(prompt).toContain("Session difficulty behaviour");
    expect(prompt).toContain("HUMAN PATIENT & THERAPY PROCESS");
    expect(prompt).toMatch(/Avoid AI tells/i);
    expect(prompt).toMatch(/Forbidden patient tells/i);
  });
});

describe("W3-HCF diagnosis-override speech strip", () => {
  it("strips HOW YOU TALK / DO-DONT so Module 1 owns syndrome speech", () => {
    const raw = [
      "You are Maya.",
      "",
      "HOW YOU ARE RIGHT NOW",
      "Grey and heavy. Haven't painted since April.",
      "",
      "HOW YOU TALK",
      "Quietly, with 2–3 second pauses. Apologise a lot.",
      "",
      "WHAT YOU DO AND DO NOT SAY",
      "Do not sound manic.",
      "",
      "HOW YOU RESPOND TO THE THERAPIST",
      "Warm when they reflect.",
    ].join("\n");
    const stripped = stripPersonaSyndromeSpeechBlocks(raw);
    expect(stripped).not.toContain("HOW YOU ARE RIGHT NOW");
    expect(stripped).not.toContain("HOW YOU TALK");
    expect(stripped).not.toContain("WHAT YOU DO AND DO NOT SAY");
    expect(stripped).toContain("HOW YOU RESPOND TO THE THERAPIST");
    expect(stripped).not.toContain("Haven't painted since April");
  });

  it("adaptPersonality clears depressive pace samples on mania override", () => {
    const personality = {
      locale: "en-US",
      language: "en",
      dialect: "American English",
      direction: "ltr",
      authored_natively: true,
      never_translate: true,
      identity: {
        display_name: "Maya",
        city: "Seattle",
        country: "US",
        occupation: "Designer",
      },
      persona_prompt:
        "You are Maya.\n\nHOW YOU TALK\nSlow quiet pauses.\n\nHOW YOU RESPOND TO THE THERAPIST\nWarm.",
      speech: {
        register: "neutral" as const,
        pace: "slow" as const,
        sample_utterances: ["I haven't painted since April"],
        turn_length: "1–4",
      },
      idioms_of_distress: ["heavy"],
      clinical_localization: [],
      cultural_context: {
        stigma_framing: "mild",
        help_seeking_attitude: "ambivalent",
        family_involvement: "partner",
      },
      case_file: {
        history_localization: { substance_and_medication_context: "none" },
      },
      voice: { voice_id: null, stt_lang: "en-US", tts_lang: "en-US" },
      language_module: {},
      safety_module: {
        risk_disclosure_style: "careful",
        escalation_language: "deflect",
        crisis_resources: [],
      },
    } as unknown as AvatarPersonality;

    const snapshot = {
      version: 2,
      assessment_id: "x",
      persona: { id: "p", slug: "maya-chen", display_name: "Maya", avatar_id: "a" },
      primary_diagnosis: {
        id: "d",
        slug: "bipolar-mania",
        name: "Bipolar mania",
        dsm5_code: "296.44",
        icd10_code: "F31.2",
        icd11_code: "6A60.2",
      },
      comorbidities: [],
      difficulty: "intermediate",
      difficulty_modifiers: {
        insight: "partial",
        resistance: "moderate",
        disclosure: "guarded",
        diagnostic_ambiguity: "low",
        alliance: "fragile",
        masking: "low",
        comorbidity_weight: 0,
      },
      therapy_modality: "supportive",
      therapy_reaction_rules: {},
      locale: "en-US",
      severity: "severe",
      clinical_core: {
        ...baseCore("Bipolar mania"),
        symptom_profile: [
          {
            id: "pressured_speech",
            description: "Talks fast",
            salience: "presenting",
          },
        ],
      },
      randomized_context: {
        recent_stressor: "x",
        financial_situation: "y",
        relationship_detail: "z",
        minor_life_event: "w",
        timeline_offset_weeks: 2,
      },
      memory_scope: "case_instance",
      generated_at: new Date().toISOString(),
    } as CaseInstanceSnapshot;

    const avatar = { slug: "maya-chen", disorder: "Major Depressive Disorder" } as Avatar;
    const adapted = adaptPersonalityForCaseSnapshot(personality, snapshot, avatar);
    expect(adapted.speech.pace).toBe("fast");
    expect(adapted.speech.sample_utterances).toEqual([]);
    expect(adapted.persona_prompt).not.toContain("HOW YOU TALK");
    expect(adapted.persona_prompt).toContain("CURRENT STATE FOR THIS SESSION");
  });
});

describe("W3-HCF disclosure merge", () => {
  it("keeps richer notes when topics overlap", () => {
    const merged = mergeDisclosureRules(
      [{ topic: "trauma", condition: "on_empathic_rapport", notes: "short" }],
      [
        {
          topic: "trauma",
          condition: "on_empathic_rapport",
          notes: "Never flood; titrate; first answers stay vague.",
        },
        { topic: "SI", condition: "on_safety_assessment" },
      ],
    );
    expect(merged).toHaveLength(2);
    const trauma = merged.find((r) => r.topic === "trauma");
    expect(trauma?.notes).toMatch(/Never flood/);
  });
});
