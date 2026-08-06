/**
 * Clinical Bug Hunter — therapy-process cue regressions.
 * CB-HCF-001…005: difficulty labels expand; human-patient + process cues
 * reach Module 1 for every active builtin disorder.
 */
import { describe, expect, it } from "vitest";
import { assembleSystemPrompt } from "@/lib/ai/prompt-engine";
import { resolveAvatar } from "@/lib/avatars/resolve";
import {
  formatDifficultyBehaviorForPrompt,
  formatTherapyProcessForPrompt,
  formatTherapyReactionForPrompt,
  HUMAN_PATIENT_BEHAVIOUR_LINES,
  therapyProcessForDisorder,
} from "@/lib/case-engine/therapy-process";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

const ACTIVE_SLUGS = [
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

describe("CB-HCF-001 difficulty label expansion", () => {
  it("expands bare labels into enactable behaviour (not metadata)", () => {
    const text = formatDifficultyBehaviorForPrompt({
      insight: "partial",
      resistance: "high",
      disclosure: "guarded",
      masking: "moderate",
      alliance: "fragile",
    });
    expect(text).toContain("enact — do not announce");
    expect(text).not.toMatch(/^- Insight: partial$/m);
    expect(text).toMatch(/Insight partial:/i);
    expect(text).toMatch(/Resistance high:/i);
    expect(text).toMatch(/false compliance|minimise|Withdraw/i);
    expect(text).toMatch(/Alliance fragile:/i);
    expect(text).toMatch(/Repair/i);
  });

  it("handles expert very_* levels", () => {
    const text = formatDifficultyBehaviorForPrompt({
      insight: "very_low",
      resistance: "very_high",
      disclosure: "minimal",
      masking: "very_high",
      alliance: "testing",
    });
    expect(text).toMatch(/Insight very low:/i);
    expect(text).toMatch(/Resistance very high:/i);
    expect(text).toMatch(/Alliance testing:/i);
  });
});

describe("CB-HCF-002/003 therapy process profiles", () => {
  it("covers every active builtin with non-generic process lines", () => {
    for (const slug of ACTIVE_SLUGS) {
      const profile = therapyProcessForDisorder(slug);
      expect(profile.slug).not.toBe("generic");
      expect(profile.lines.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("universal human-patient block forbids vignette behaviour", () => {
    const block = formatTherapyProcessForPrompt("mdd-recurrent-moderate");
    expect(block).toContain("HUMAN PATIENT & THERAPY PROCESS");
    expect(HUMAN_PATIENT_BEHAVIOUR_LINES.length).toBeGreaterThanOrEqual(8);
    expect(block).toMatch(/symptom list/i);
    expect(block).toMatch(/Hesitate/i);
    expect(block).toMatch(/Never invent clinical records/i);
    expect(block).toMatch(/minimisation|Layered disclosure/i);
  });
});

describe("CB-HCF-005 therapy reaction rules reach prompts", () => {
  it("formats modality engages/resists into enactment cues", () => {
    const text = formatTherapyReactionForPrompt({
      engages_with: ["empathy", "collaboration"],
      resists: ["premature confrontation"],
      alliance_cue: "Supportive: patient reacts to modality-congruent stance.",
    });
    expect(text).toContain("Therapy-modality reaction");
    expect(text).toMatch(/empathy/);
    expect(text).toMatch(/premature confrontation/);
  });
});

describe("CB-HCF resolve → Module 1 wiring", () => {
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
    persona_prompt: "You are Maya.",
    speech: { register: "neutral", sample_utterances: [] },
    cultural_context: {
      stigma_framing: "mild",
      help_seeking_attitude: "ambivalent",
    },
    language_module: {
      directive: "English only",
      fallback_replies: ["um"],
      script: "Latn",
      forbidden_scripts: ["Arab"],
    },
    safety_module: {
      risk_disclosure_style: "careful",
      boundary_rules: ["Stay in role"],
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
    persona_prompt: "You are Maya.",
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

  it("injects therapy-process cues even without a case snapshot", () => {
    const resolved = resolveAvatar(avatar, "en-US");
    expect(resolved.system_prompt).toContain("HUMAN PATIENT & THERAPY PROCESS");
    expect(resolved.system_prompt).toMatch(/Layered disclosure|minimisation/i);
    expect(resolved.system_prompt).toMatch(/Forbidden patient tells/i);
    expect(resolved.per_turn_reinforcement).toMatch(/disclosure layer|Hesitate/i);
  });

  it("expands difficulty + therapy reaction from case snapshot into Module 1", () => {
    const snapshot: CaseInstanceSnapshot = {
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
        slug: "mdd-recurrent-moderate",
        name: "MDD",
        dsm5_code: "296.32",
        icd10_code: "F33.1",
        icd11_code: "6A71.1",
      },
      comorbidities: [],
      difficulty: "advanced",
      difficulty_modifiers: {
        insight: "low",
        resistance: "high",
        disclosure: "guarded",
        diagnostic_ambiguity: "high",
        alliance: "fragile",
        masking: "high",
        comorbidity_weight: 1,
      },
      therapy_modality: "cbt",
      therapy_reaction_rules: {
        engages_with: ["structured questions", "thought records"],
        resists: ["premature confrontation"],
        alliance_cue: "CBT: patient reacts to modality-congruent stance.",
      },
      locale: "en-US",
      severity: "moderate",
      clinical_core: core,
      randomized_context: {
        recent_stressor: "x",
        financial_situation: "y",
        relationship_detail: "z",
        minor_life_event: "w",
        timeline_offset_weeks: 2,
      },
      memory_scope: "case_instance",
      generated_at: new Date().toISOString(),
    };

    const resolved = resolveAvatar(avatar, "en-US", { caseSnapshot: snapshot });
    expect(resolved.system_prompt).toMatch(/Insight low:/i);
    expect(resolved.system_prompt).toMatch(/Resistance high:/i);
    expect(resolved.system_prompt).toContain("Therapy-modality reaction");
    expect(resolved.system_prompt).toMatch(/thought records/);
    expect(resolved.system_prompt).toMatch(/premature confrontation/);
    expect(resolved.system_prompt).not.toMatch(/^- Insight: low$/m);
  });

  it("assembleSystemPrompt always includes a therapy-process fallback", () => {
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality,
      session: { locale: "en-US" },
    });
    expect(prompt).toContain("HUMAN PATIENT & THERAPY PROCESS");
    expect(prompt).toMatch(/No symptom lists|symptom list/i);
  });
});
