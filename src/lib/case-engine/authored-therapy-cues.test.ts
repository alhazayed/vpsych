import { describe, expect, it } from "vitest";
import {
  authoredTherapyCuesFor,
  formatAuthoredTherapyCuesForPrompt,
} from "@/lib/case-engine/authored-therapy-cues";
import { resolveAvatar } from "@/lib/avatars/resolve";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

describe("CB-HCF-006 authored therapy cues", () => {
  it("loads condensed Maya and Jordan process cues", () => {
    expect(authoredTherapyCuesFor("maya-chen")?.process_lines.length).toBeGreaterThan(
      5,
    );
    expect(
      authoredTherapyCuesFor("jordan-hale")?.process_lines.length,
    ).toBeGreaterThan(5);
    expect(authoredTherapyCuesFor("unknown")).toBeNull();
  });

  it("includes Arabic cultural notes for ar-JO", () => {
    const ar = formatAuthoredTherapyCuesForPrompt("maya-chen", "ar-JO");
    expect(ar).toMatch(/الشمعة|تيتا|موافقة زايدة/);
    expect(ar).toMatch(/Disclosure layers|تقليل|minimisation|Alliance/i);

    const jordanAr = formatAuthoredTherapyCuesForPrompt("jordan-hale", "ar-JO");
    expect(jordanAr).toMatch(/الرجال ما بيشتكي|باقي عمري/);
  });

  it("injects authored cues on default-syndrome resolve, skips on mania override", () => {
    const core: ClinicalCore = {
      disorder: "Major Depressive Disorder",
      age: 28,
      gender: "female",
      symptom_profile: [
        { id: "low_mood", description: "Low mood", salience: "presenting" },
      ],
      disclosure_rules: [],
      session_goals: [],
      ideal_approach: "Warm",
      risk_profile: { suicidal_ideation: "passive" },
    };
    const personality: AvatarPersonality = {
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
      persona_prompt: "You are Maya.\n\nHOW YOU RESPOND TO THE THERAPIST\nWarm.",
      speech: { register: "neutral", sample_utterances: [] },
      cultural_context: {
        stigma_framing: "mild",
        help_seeking_attitude: "ambivalent",
      },
      language_module: {
        directive: "English",
        fallback_replies: [],
        script: "Latn",
        forbidden_scripts: [],
      },
      safety_module: {
        risk_disclosure_style: "careful",
        boundary_rules: [],
        crisis_resources: [],
      },
      voice: { stt_lang: "en-US", tts_lang: "en-US" },
    };
    const avatar = {
      id: "a1",
      name: "Maya Chen",
      disorder: "Major Depressive Disorder",
      age: 28,
      gender: "female",
      portrait_url: null,
      persona_prompt: personality.persona_prompt,
      ideal_guidelines: {},
      rubric: [],
      schema_version: 2,
      slug: "maya-chen",
      default_locale: "en-US",
      clinical_core: core,
      personalities: { "en-US": personality },
      is_active: true,
      created_at: "",
      updated_at: "",
    } as Avatar;

    const defaultResolved = resolveAvatar(avatar, "en-US");
    expect(defaultResolved.system_prompt).toContain("Authored SP process");
    expect(defaultResolved.system_prompt).toMatch(/Disclosure layers/i);
    expect(defaultResolved.system_prompt).toMatch(/oranges|grandmother/i);

    const maniaSnapshot: CaseInstanceSnapshot = {
      version: 2,
      assessment_id: "asm",
      persona: {
        id: "p",
        slug: "maya-chen",
        display_name: "Maya",
        avatar_id: "a1",
      },
      primary_diagnosis: {
        id: "d",
        slug: "bipolar-mania",
        name: "Bipolar mania",
        dsm5_code: "296.44",
        icd10_code: "F31.2",
        icd11_code: "6A60.1",
      },
      comorbidities: [],
      difficulty: "intermediate",
      difficulty_modifiers: {
        insight: "low",
        resistance: "moderate",
        disclosure: "mixed",
        diagnostic_ambiguity: "moderate",
        alliance: "neutral",
        masking: "low",
        comorbidity_weight: 0,
      },
      therapy_modality: "supportive",
      therapy_reaction_rules: {},
      locale: "en-US",
      severity: "severe",
      clinical_core: {
        ...core,
        disorder: "Bipolar I, manic",
        symptom_profile: [
          {
            id: "pressured_speech",
            description: "Pressured speech",
            salience: "presenting",
          },
        ],
      },
      randomized_context: {
        recent_stressor: "x",
        financial_situation: "y",
        relationship_detail: "z",
        minor_life_event: "w",
        timeline_offset_weeks: 1,
      },
      memory_scope: "case_instance",
      generated_at: new Date().toISOString(),
    };

    const maniaResolved = resolveAvatar(avatar, "en-US", {
      caseSnapshot: maniaSnapshot,
    });
    expect(maniaResolved.system_prompt).not.toContain("Authored SP process");
    expect(maniaResolved.system_prompt).toContain("HUMAN PATIENT & THERAPY PROCESS");
    expect(maniaResolved.system_prompt).toMatch(/Pressured|mania|grandios/i);
  });
});
