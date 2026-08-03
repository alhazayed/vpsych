/**
 * Clinical fidelity static suite — codes, catalog parity, prompt safety,
 * objective maps, and case generation across disorders × locales × difficulties.
 */
import { describe, expect, it } from "vitest";
import {
  BUILTIN_DISORDERS,
  DISORDER_IDS,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { OBJECTIVE_DISORDER_CANDIDATES } from "@/lib/instructor-presets/objective-map";
import { BUILTIN_TEMPLATES } from "@/lib/scenario-templates/catalog";
import {
  assembleSystemPrompt,
  synthesizePromptInputFromFlat,
} from "@/lib/ai/prompt-engine";
import type { AvatarPersonality, ClinicalCore } from "@/lib/types";

/** Canonical clinical coding expectations after Mission 10 fixes. */
const CODE_EXPECTATIONS: Record<
  string,
  {
    dsm5: string | null;
    icd10: string | null;
    icd11: string;
    category?: string;
  }
> = {
  "mdd-recurrent-moderate": {
    dsm5: "296.32",
    icd10: "F33.1",
    icd11: "6A71.1",
  },
  "gad-with-panic": { dsm5: "300.02", icd10: "F41.1", icd11: "6B00" },
  ptsd: { dsm5: "309.81", icd10: "F43.10", icd11: "6B40" },
  "complex-ptsd": { dsm5: null, icd10: null, icd11: "6B41" },
  pdd: { dsm5: "300.4", icd10: "F34.1", icd11: "6A72" },
  "panic-disorder": { dsm5: "300.01", icd10: "F41.0", icd11: "6B01" },
  "social-anxiety": { dsm5: "300.23", icd10: "F40.10", icd11: "6B04" },
  ocd: {
    dsm5: "300.3",
    icd10: "F42",
    icd11: "6B20",
    category: "obsessive-compulsive",
  },
  "adult-adhd": { dsm5: "314.00", icd10: "F90.0", icd11: "6A05.0" },
  "alcohol-use-disorder": {
    dsm5: "305.00",
    icd10: "F10.10",
    icd11: "6C40.1",
  },
  bpd: { dsm5: "301.83", icd10: "F60.3", icd11: "6D10.1/6D11.5" },
  asd: { dsm5: "299.00", icd10: "F84.0", icd11: "6A02" },
  schizophrenia: { dsm5: "295.90", icd10: "F20.9", icd11: "6A20" },
  schizoaffective: { dsm5: "295.70", icd10: "F25.9", icd11: "6A21" },
  "bipolar-mania": { dsm5: "296.44", icd10: "F31.2", icd11: "6A60.2" },
  "eating-disorders": { dsm5: "307.1", icd10: "F50.0", icd11: "6B80" },
  delirium: { dsm5: "293.0", icd10: "F05", icd11: "6D70" },
};

const ALL_SLUGS = Object.keys(DISORDER_IDS)
  .map((k) => {
    const id = DISORDER_IDS[k as keyof typeof DISORDER_IDS];
    return BUILTIN_DISORDERS.find((d) => d.id === id)?.slug;
  })
  .filter(Boolean) as string[];

const mayaPersona: PersonaRow = {
  id: "persona-maya",
  avatar_id: "avatar-maya",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

describe("Clinical coding fidelity", () => {
  it("builtin catalog includes every DISORDER_IDS entry", () => {
    for (const key of Object.keys(DISORDER_IDS) as Array<
      keyof typeof DISORDER_IDS
    >) {
      const row = BUILTIN_DISORDERS.find((d) => d.id === DISORDER_IDS[key]);
      expect(row, `missing builtin for ${key}`).toBeTruthy();
      expect(row!.is_active).toBe(true);
    }
  });

  it("matches DSM-5 / ICD-10 / ICD-11 expectations for every disorder", () => {
    for (const [slug, expected] of Object.entries(CODE_EXPECTATIONS)) {
      const row = BUILTIN_DISORDERS.find((d) => d.slug === slug);
      expect(row, slug).toBeTruthy();
      expect(row!.dsm5_code, `${slug} dsm5`).toBe(expected.dsm5);
      expect(row!.icd10_code, `${slug} icd10`).toBe(expected.icd10);
      expect(row!.icd11_code, `${slug} icd11`).toBe(expected.icd11);
      if (expected.category) {
        expect(row!.category).toBe(expected.category);
      }
    }
  });

  it("does not assign DSM-5 PTSD 309.81 to Complex PTSD", () => {
    const cptsd = BUILTIN_DISORDERS.find((d) => d.slug === "complex-ptsd")!;
    expect(cptsd.dsm5_code).not.toBe("309.81");
    expect(cptsd.icd11_code).toBe("6B41");
  });

  it("does not code bipolar psychotic mania as ICD-11 6A60.1", () => {
    const bp = BUILTIN_DISORDERS.find((d) => d.slug === "bipolar-mania")!;
    expect(bp.icd11_code).toBe("6A60.2");
    expect(bp.icd11_code).not.toBe("6A60.1");
  });

  it("codes BPD with severity + borderline pattern", () => {
    const bpd = BUILTIN_DISORDERS.find((d) => d.slug === "bpd")!;
    expect(bpd.icd11_code).toContain("6D11.5");
    expect(bpd.icd11_code).toMatch(/6D10\.[12]/);
  });
});

describe("Persona / template clinical binding", () => {
  it("PTSD risk template is not bound to maya-chen MDD biography", () => {
    const tmpl = BUILTIN_TEMPLATES.find(
      (t) => t.slug === "ptsd-risk-assessment-en",
    )!;
    expect(tmpl.default_persona_slug).not.toBe("maya-chen");
    expect(tmpl.primary_diagnosis_slug).toBe("ptsd");
  });

  it("autism_assessment objective prefers asd disorder", () => {
    expect(OBJECTIVE_DISORDER_CANDIDATES.autism_assessment).toContain("asd");
  });
});

describe("Safety prompt module", () => {
  it("includes harm_to_others in assembled Module 4", () => {
    const core: ClinicalCore = {
      disorder: "Borderline Personality Disorder",
      age: 24,
      gender: "female",
      severity: "moderate",
      onset_duration: "years",
      symptom_profile: [],
      disclosure_rules: [],
      session_goals: [],
      ideal_approach: "DBT",
      risk_profile: {
        suicidal_ideation: "passive",
        self_harm: true,
        harm_to_others: false,
        substance_use: false,
      },
    };
    const personality: AvatarPersonality = {
      locale: "en-US",
      language: "en",
      dialect: "American English",
      direction: "ltr",
      authored_natively: true,
      never_translate: true,
      identity: {
        display_name: "Test",
        city: "X",
        country: "US",
        occupation: "student",
        living_situation: "",
        family_context: "",
      },
      persona_prompt: "You are a patient.",
      speech: {
        register: "neutral",
        pace: "measured",
        dialect_markers: [],
        filler_words: [],
        sample_utterances: [],
        turn_length: "1–3",
        code_switching: "",
      },
      idioms_of_distress: [],
      cultural_context: {
        stigma_framing: "",
        help_seeking_attitude: "",
        family_involvement: "",
        authority_orientation: "",
        taboo_topics: [],
      },
      clinical_localization: [],
      language_module: {
        directive: "English only",
        script: "Latn",
        forbidden_scripts: ["Arab"],
        fallback_replies: [],
      },
      safety_module: {
        crisis_resources: [{ name: "988", contact: "988" }],
        risk_disclosure_style: "careful",
        boundary_rules: ["Stay in role"],
        escalation_language: "Shift to safety",
      },
      voice: { stt_lang: "en-US", tts_lang: "en-US" },
      is_active: true,
    };
    const prompt = assembleSystemPrompt({
      clinical_core: core,
      personality,
      session: { locale: "en-US" },
    });
    expect(prompt).toMatch(/Harm to others/i);
  });

  it("flat synthesis includes harm_to_others default", () => {
    const input = synthesizePromptInputFromFlat({
      name: "Test",
      disorder: "MDD",
      age: 30,
      gender: "female",
      locale: "en-US",
      persona_prompt: "You are a patient.",
    });
    expect(input.clinical_core.risk_profile.harm_to_others).toBe(false);
  });
});

describe("Case generation clinical corpus (≥100 snapshots)", () => {
  it("generates valid cases across disorders × locales × difficulties", () => {
    const catalog = getBuiltinCatalog();
    const difficulties = [
      "beginner",
      "intermediate",
      "advanced",
      "expert",
    ] as const;
    const locales = ["en-US", "ar-JO"] as const;
    const therapies = [
      "cbt",
      "dbt",
      "act",
      "supportive",
      "motivational_interviewing",
      "crisis_intervention",
    ] as const;

    const snapshots: Array<{
      slug: string;
      locale: string;
      difficulty: string;
      dsm5: string | null;
      icd11: string | null;
    }> = [];

    let i = 0;
    for (const disorder of BUILTIN_DISORDERS) {
      for (const locale of locales) {
        for (const difficulty of difficulties) {
          const therapy = therapies[i % therapies.length]!;
          i += 1;
          const age = Math.min(
            disorder.max_age ?? 40,
            Math.max(disorder.min_age ?? 18, 28),
          );
          const persona: PersonaRow = {
            ...mayaPersona,
            identity: {
              age,
              gender: (disorder.allowed_genders[0] as
                | "female"
                | "male"
                | "non-binary"
                | "unspecified") || "female",
            },
          };
          const generated = generateCaseInstance({
            persona,
            avatarId: "avatar-maya",
            primaryDisorder: disorder,
            difficulty,
            therapyModality: therapy,
            locale,
            seed: `${disorder.slug}-${locale}-${difficulty}`,
          });
          expect(generated.ok, `${disorder.slug} ${locale} ${difficulty}`).toBe(
            true,
          );
          if (!generated.ok) continue;
          const snap = generated.snapshot;
          expect(snap.primary_diagnosis.slug).toBe(disorder.slug);
          expect(snap.primary_diagnosis.icd11_code).toBe(disorder.icd11_code);
          expect(snap.clinical_core.disorder).toBeTruthy();
          expect(snap.clinical_core.risk_profile).toBeTruthy();
          snapshots.push({
            slug: disorder.slug,
            locale,
            difficulty,
            dsm5: snap.primary_diagnosis.dsm5_code,
            icd11: snap.primary_diagnosis.icd11_code,
          });
        }
      }
    }

    // 17 disorders × 2 locales × 4 difficulties = 136
    expect(snapshots.length).toBeGreaterThanOrEqual(100);
    expect(new Set(snapshots.map((s) => s.slug)).size).toBe(
      BUILTIN_DISORDERS.length,
    );
    expect(ALL_SLUGS.length).toBe(BUILTIN_DISORDERS.length);
    expect(catalog.disorders.length).toBe(BUILTIN_DISORDERS.length);
  });
});
