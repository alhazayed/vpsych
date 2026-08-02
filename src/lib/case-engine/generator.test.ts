import { describe, expect, it } from "vitest";
import {
  BUILTIN_COMORBIDITY_RULES,
  BUILTIN_DISORDERS,
  DISORDER_IDS,
  findDifficulty,
  findTherapy,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { createRng, generateCaseInstance } from "@/lib/case-engine/generator";
import { validateCaseGeneration } from "@/lib/case-engine/validation";
import type {
  CaseDifficulty,
  PersonaRow,
  TherapyModality,
} from "@/lib/case-engine/types";
import { resolveAvatar } from "@/lib/avatars/resolve";
import type { Avatar } from "@/lib/types";

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

const jordanPersona: PersonaRow = {
  id: "persona-jordan",
  avatar_id: "avatar-jordan",
  slug: "jordan-hale",
  display_name: "Jordan Hale",
  identity: { age: 34, gender: "male" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.gad,
  is_active: true,
};

const PERSONAS = [mayaPersona, jordanPersona];
const DIFFICULTIES: CaseDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];
const THERAPIES: TherapyModality[] = [
  "cbt",
  "dbt",
  "act",
  "psychodynamic",
  "supportive",
  "motivational_interviewing",
  "family_therapy",
  "crisis_intervention",
];
const LOCALES = ["en-US", "ar-JO"];

/** Compatible comorbidity pairs from builtin rules. */
const COMPATIBLE_PAIRS = BUILTIN_COMORBIDITY_RULES.filter((r) => r.compatible);

function disorderById(id: string) {
  return BUILTIN_DISORDERS.find((d) => d.id === id)!;
}

describe("Dynamic Clinical Case Engine", () => {
  it("rejects incompatible comorbidity", () => {
    const catalog = getBuiltinCatalog();
    const result = validateCaseGeneration(
      {
        persona: mayaPersona,
        avatarId: "avatar-maya",
        primaryDisorder: disorderById(DISORDER_IDS.adhd),
        comorbidities: [disorderById(DISORDER_IDS.ptsd)],
        difficulty: "intermediate",
        therapyModality: "cbt",
        locale: "en-US",
      },
      catalog,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "comorbidity_incompatible")).toBe(
        true,
      );
    }
  });

  it("rejects age/disorder incompatibility for AUD under 18", () => {
    const catalog = getBuiltinCatalog();
    const teen: PersonaRow = {
      ...mayaPersona,
      identity: { age: 16, gender: "female" },
    };
    const result = validateCaseGeneration(
      {
        persona: teen,
        avatarId: "avatar-maya",
        primaryDisorder: disorderById(DISORDER_IDS.aud),
        difficulty: "beginner",
        therapyModality: "supportive",
        locale: "en-US",
      },
      catalog,
    );
    expect(result.ok).toBe(false);
  });

  it("generates 100 random valid cases with unique assessment IDs", () => {
    const catalog = getBuiltinCatalog();
    const assessmentIds = new Set<string>();
    const rng = createRng("vpsych-case-engine-100");

    let generated = 0;
    let attempts = 0;
    while (generated < 100 && attempts < 500) {
      attempts += 1;
      const persona = PERSONAS[Math.floor(rng() * PERSONAS.length)]!;
      const primary = BUILTIN_DISORDERS[Math.floor(rng() * BUILTIN_DISORDERS.length)]!;
      const difficulty = DIFFICULTIES[Math.floor(rng() * DIFFICULTIES.length)]!;
      const therapy = THERAPIES[Math.floor(rng() * THERAPIES.length)]!;
      const locale = LOCALES[Math.floor(rng() * LOCALES.length)]!;

      let comorbidities: typeof BUILTIN_DISORDERS = [];
      if (rng() > 0.45) {
        const pair = COMPATIBLE_PAIRS.find(
          (p) => p.primary_disorder_id === primary.id,
        );
        if (pair) {
          comorbidities = [disorderById(pair.comorbid_disorder_id)];
        }
      }

      const req = {
        persona,
        avatarId: persona.avatar_id!,
        primaryDisorder: primary,
        comorbidities,
        difficulty,
        therapyModality: therapy,
        locale,
        seed: `case-${generated}-${attempts}`,
        difficultyProfile: findDifficulty(difficulty, catalog),
        therapyProfile: findTherapy(therapy, catalog),
      };

      const validation = validateCaseGeneration(req, catalog);
      if (!validation.ok) continue;

      const result = generateCaseInstance(req);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      const snap = result.snapshot;
      expect(snap.version).toBe(2);
      expect(snap.assessment_id).toMatch(/^VPSY-ASM-/);
      expect(assessmentIds.has(snap.assessment_id)).toBe(false);
      assessmentIds.add(snap.assessment_id);

      expect(snap.primary_diagnosis.dsm5_code).toBeTruthy();
      expect(snap.primary_diagnosis.icd11_code).toBeTruthy();
      expect(snap.clinical_core.disorder).toBe(primary.name);
      expect(snap.locale).toBe(locale);
      expect(snap.difficulty).toBe(difficulty);
      expect(snap.therapy_modality).toBe(therapy);
      expect(snap.memory_scope).toBe("case_instance");
      expect(snap.randomized_context.recent_stressor).toBeTruthy();
      expect(snap.persona.slug).toBe(persona.slug);

      // Language never changes diagnosis codes
      expect(snap.primary_diagnosis.dsm5_code).toBe(primary.dsm5_code);
      expect(snap.primary_diagnosis.icd11_code).toBe(primary.icd11_code);

      generated += 1;
    }

    expect(generated).toBe(100);
    expect(assessmentIds.size).toBe(100);
  });

  it("keeps persona identity while swapping diagnosis via resolveAvatar", () => {
    const catalog = getBuiltinCatalog();
    const ptsd = disorderById(DISORDER_IDS.ptsd);
    const result = generateCaseInstance({
      persona: mayaPersona,
      avatarId: "avatar-maya",
      primaryDisorder: ptsd,
      comorbidities: [disorderById(DISORDER_IDS.mdd)],
      difficulty: "advanced",
      therapyModality: "cbt",
      locale: "ar-JO",
      seed: "maya-ptsd-ar",
      difficultyProfile: findDifficulty("advanced", catalog),
      therapyProfile: findTherapy("cbt", catalog),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const avatar = {
      id: "avatar-maya",
      name: "Maya Chen",
      disorder: "Major Depressive Disorder, recurrent episode, with anxious distress",
      age: 28,
      gender: "female",
      portrait_url: null,
      persona_prompt: "You are Maya.",
      ideal_guidelines: {},
      rubric: [],
      schema_version: 2,
      slug: "maya-chen",
      default_locale: "en-US",
      clinical_core: {
        disorder: "Major Depressive Disorder, recurrent episode, with anxious distress",
        age: 28,
        gender: "female",
        symptom_profile: [],
        disclosure_rules: [],
        session_goals: [],
        ideal_approach: "supportive",
        risk_profile: { suicidal_ideation: "passive" },
      },
      personalities: {
        "ar-JO": {
          locale: "ar-JO",
          language: "ar",
          direction: "rtl",
          authored_natively: true,
          never_translate: true,
          identity: {
            display_name: "ليان خوري",
            city: "عمّان",
            country: "الأردن",
            occupation: "مصممة",
          },
          persona_prompt: "أنتِ ليان.",
          speech: {
            register: "colloquial",
            sample_utterances: ["مرحبا"],
          },
          cultural_context: {
            stigma_framing: "test",
            help_seeking_attitude: "test",
          },
          language_module: { directive: "Arabic only" },
          safety_module: {
            crisis_resources: [],
            risk_disclosure_style: "calm",
            boundary_rules: [],
          },
          voice: { stt_lang: "ar-JO", tts_lang: "ar-SA" },
        },
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Avatar;

    const resolved = resolveAvatar(avatar, "ar-JO", {
      caseSnapshot: result.snapshot,
    });

    expect(resolved.name).toBe("ليان خوري");
    expect(resolved.disorder).toContain("Posttraumatic");
    expect(resolved.locale).toBe("ar-JO");
    expect(resolved.language).toBe("ar");
    expect(resolved.clinical_core?.disorder).toBe(ptsd.name);
  });

  it("isolates memory scope to case_instance", () => {
    const a = generateCaseInstance({
      persona: mayaPersona,
      avatarId: "a",
      primaryDisorder: disorderById(DISORDER_IDS.mdd),
      difficulty: "beginner",
      therapyModality: "supportive",
      locale: "en-US",
      seed: "mem-a",
    });
    const b = generateCaseInstance({
      persona: mayaPersona,
      avatarId: "a",
      primaryDisorder: disorderById(DISORDER_IDS.ptsd),
      difficulty: "expert",
      therapyModality: "cbt",
      locale: "en-US",
      seed: "mem-b",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.snapshot.assessment_id).not.toBe(b.snapshot.assessment_id);
    expect(a.snapshot.memory_scope).toBe("case_instance");
    expect(b.snapshot.primary_diagnosis.slug).toBe("ptsd");
    expect(a.snapshot.primary_diagnosis.slug).toBe("mdd-recurrent-moderate");
  });
});
