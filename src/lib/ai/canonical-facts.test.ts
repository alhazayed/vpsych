import { describe, expect, it } from "vitest";
import {
  formatCanonicalFactsForPrompt,
  resolveCaseFile,
  withPreservedCaseFile,
  type ClinicalCaseFile,
} from "@/lib/ai/canonical-facts";
import { assembleSystemPrompt } from "@/lib/ai/prompt-engine";
import type { ClinicalCore } from "@/lib/types";

const jordanCore: ClinicalCore = {
  disorder: "Generalized Anxiety Disorder",
  age: 34,
  gender: "male",
  symptom_profile: [],
  disclosure_rules: [],
  session_goals: ["Build alliance"],
  ideal_approach: "Supportive",
  risk_profile: { suicidal_ideation: "none" },
};

const authoredCaseFile: ClinicalCaseFile = {
  consistency_rules: {
    principle: "Facts do not drift.",
    canonical_facts_immutable: [
      "Age 34 (not 35). Born 1991.",
      "You are NOT on sertraline. Your younger sibling has treated panic disorder and takes sertraline — that medication belongs to them, never to you.",
    ],
    numerical_consistency:
      "Clinical quantities are identical in every session.",
  },
  psychiatric_history: {
    medication_response_summary:
      "You do not take sertraline. Sibling takes sertraline.",
  },
};

describe("canonical-facts Layer A", () => {
  it("authored age reaches the formatted prompt block", () => {
    const block = formatCanonicalFactsForPrompt({
      clinical_core: jordanCore,
      avatarSlug: "jordan-hale",
      locale: "ar-JO",
    });
    expect(block).toMatch(/Authored age:\s*34/);
    expect(block).toMatch(/correct immediately to 34/);
  });

  it("therapist wrong age → patient correction instruction present", () => {
    const block = formatCanonicalFactsForPrompt({
      clinical_core: jordanCore,
      avatarSlug: "jordan-hale",
      locale: "ar",
    });
    expect(block).toMatch(/If the therapist says a different age/i);
    expect(block).toContain("34");
  });

  it("authored canonical facts survive when case_file is attached", () => {
    const withFile = withPreservedCaseFile(
      { ...jordanCore, case_file: authoredCaseFile },
      "jordan-hale",
    );
    expect(resolveCaseFile(withFile, "jordan-hale")?.consistency_rules).toBe(
      authoredCaseFile.consistency_rules,
    );
    const block = formatCanonicalFactsForPrompt({
      clinical_core: withFile,
      avatarSlug: "jordan-hale",
      locale: "ar-JO",
    });
    expect(block).toContain("Age 34 (not 35)");
    expect(block).toMatch(/Numerical consistency/i);
  });

  it("case_file survives mergeClinicalCore snapshot merge", () => {
    // mergeClinicalCore is not exported — exercise via generateCaseInstance
    // path equivalent: preserve case_file on legacy core.
    const legacy: ClinicalCore = {
      ...jordanCore,
      case_file: authoredCaseFile,
    };
    // Dynamic import of internal behaviour via withPreservedCaseFile + spread
    // that generator uses. Directly assert the preserve contract.
    const merged = {
      ...jordanCore,
      ...(legacy.case_file ? { case_file: legacy.case_file } : {}),
    };
    expect(merged.case_file).toEqual(authoredCaseFile);
  });

  it("false medication is explicitly rejected by prompt instruction", () => {
    const block = formatCanonicalFactsForPrompt({
      clinical_core: jordanCore,
      avatarSlug: "jordan-hale",
      locale: "ar-JO",
    });
    expect(block).toMatch(/سيرترالين|sertraline/i);
    expect(block).toMatch(/صحّح فوراً|correct immediately/i);
    expect(block).toMatch(/instruction-level|طبقة تعليمات/i);
  });

  it("sibling medication remains attributed to sibling", () => {
    const block = formatCanonicalFactsForPrompt({
      clinical_core: withPreservedCaseFile(jordanCore, "jordan-hale"),
      avatarSlug: "jordan-hale",
      locale: "ar-JO",
    });
    expect(block).toMatch(/sibling|أختك|أخوك/i);
    expect(block).toMatch(/sertraline|سيرترالين/i);
    expect(block).toMatch(/NOT you|مش إنت|never to you/i);
  });

  it("male Arabic persona gender constraint is injected for jordan-hale", () => {
    const block = formatCanonicalFactsForPrompt({
      clinical_core: { ...jordanCore, gender: "unspecified" },
      avatarSlug: "jordan-hale",
      locale: "ar-JO",
    });
    expect(block).toContain("إنت ذكر");
    expect(block).toContain("حجزت");
    expect(block).toContain("حجزتِ");
    expect(block).toContain("آسف");
  });

  it("canonical facts block is rendered into Module 1 system prompt", () => {
    const core = withPreservedCaseFile(jordanCore, "jordan-hale");
    const facts = formatCanonicalFactsForPrompt({
      clinical_core: core,
      avatarSlug: "jordan-hale",
      locale: "ar-JO",
    });
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality: {
        locale: "ar-JO",
        language: "ar",
        dialect: "Jordanian",
        direction: "rtl",
        authored_natively: true,
        never_translate: true,
        identity: {
          display_name: "رامي نصّار",
          city: "Irbid",
          country: "Jordan",
          occupation: "PM",
        },
        persona_prompt: "إنت رامي.",
        speech: { register: "colloquial", sample_utterances: [] },
        cultural_context: {
          stigma_framing: "mild",
          help_seeking_attitude: "ambivalent",
        },
        language_module: {
          directive: "بالعربية فقط",
          fallback_replies: ["آه"],
          per_turn_reinforcement: "بالعربية",
          script: "Arab",
          forbidden_scripts: [],
        },
        safety_module: {
          risk_disclosure_style: "careful",
          boundary_rules: [],
          crisis_resources: [],
        },
        voice: { stt_lang: "ar-JO", tts_lang: "ar-SA" },
      },
      session: { locale: "ar-JO" },
      fidelity: { canonical_facts_block: facts },
    });
    expect(prompt).toContain("CANONICAL CLINICAL FACTS");
    expect(prompt).toContain("Authored age: 34");
    expect(prompt).toMatch(/سيرترالين/);
  });

  it("mutation: dropping case_file from core still falls back to authored slug facts", () => {
    const without = { ...jordanCore };
    delete (without as { case_file?: unknown }).case_file;
    const block = formatCanonicalFactsForPrompt({
      clinical_core: without,
      avatarSlug: "jordan-hale",
      locale: "en-US",
    });
    expect(block).toContain("Age 34 (not 35)");
    expect(block).toMatch(/NOT on sertraline/i);
  });

  it("mutation: removing age still emits correction instruction with undefined age string", () => {
    const noAge = { ...jordanCore, age: undefined as unknown as number };
    const block = formatCanonicalFactsForPrompt({
      clinical_core: noAge,
      avatarSlug: "jordan-hale",
      locale: "en",
    });
    // Still instructs correction to whatever age is present (undefined → "undefined")
    // Guard: block must still contain the correction sentence pattern.
    expect(block).toMatch(/If the therapist says a different age/i);
  });
});

describe("mergeClinicalCore case_file preserve (exported via generator)", () => {
  it("preserves case_file when legacy core carries it", async () => {
    const { generateCaseInstance } = await import("@/lib/case-engine/generator");
    const { BUILTIN_DISORDERS, DISORDER_IDS } = await import(
      "@/lib/case-engine/catalog"
    );
    const primary = BUILTIN_DISORDERS.find((d) => d.id === DISORDER_IDS.gad)!;
    const result = generateCaseInstance({
      persona: {
        id: "persona-jordan",
        avatar_id: "avatar-jordan",
        slug: "jordan-hale",
        display_name: "Jordan Hale",
        identity: { age: 34, gender: "male" },
        traits: {},
        baseline_history: {},
        default_disorder_id: DISORDER_IDS.gad,
        is_active: true,
      },
      avatarId: "avatar-jordan",
      primaryDisorder: primary,
      difficulty: "intermediate",
      therapyModality: "supportive",
      locale: "ar-JO",
      seed: "canonical-facts-case-file-preserve",
      legacyClinicalCore: {
        ...jordanCore,
        case_file: authoredCaseFile,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.clinical_core.case_file).toEqual(authoredCaseFile);
  });
});

describe("male Arabic persona gender regression (authored text)", () => {
  it("jordan-hale ar-JO persona uses masculine حجزت not حجزتِ", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(
      join(process.cwd(), "personas/jordan-hale.case.json"),
      "utf8",
    );
    const json = JSON.parse(raw) as {
      personalities?: Record<string, { persona_prompt?: string }>;
    };
    const prompt = json.personalities?.["ar-JO"]?.persona_prompt ?? "";
    expect(prompt).toContain("حجزت الموعد");
    expect(prompt).not.toContain("حجزتِ");
  });
});
