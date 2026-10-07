import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assessPublishReadiness } from "@/lib/admin/virtual-patient/validation";
import { isCaseDiagnosisOverride, resolveAvatar } from "@/lib/avatars/resolve";
import {
  findDifficulty,
  findDisorderBySlug,
  findTherapy,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { validateHumanPersonality } from "@/lib/personality-engine";
import {
  LADDER_LEVELS,
  LADDER_PATIENTS,
  ladderComorbidities,
  ladderLevelDef,
  ladderRiskOverlay,
} from "@/lib/training-ladder";
import {
  LADDER_PATIENT_LOCALES,
  loadLadderAvatarRecords,
  loadLadderPatientSources,
  type LadderAvatarRecord,
} from "@/lib/training-ladder/patient-files";
import {
  LADDER_PATIENTS_MIGRATION,
  buildLadderPatientsMigrationSql,
} from "@/lib/training-ladder/patient-migration";
import type { Avatar, VoiceProfile } from "@/lib/types";
import { voiceGenderOf } from "@/lib/voice/voice-gender";
import { isVoiceApprovedFor } from "@/lib/voice/voice-language";

const root = join(__dirname, "../../..");
// LADDER_PATIENT_SLUGS=a,b checks only those files (while others are being
// written); the full run, and CI, always checks every file.
const onlySlugs = process.env.LADDER_PATIENT_SLUGS?.split(",").filter(Boolean);
const records = loadLadderAvatarRecords(undefined, onlySlugs);
const sources = loadLadderPatientSources(undefined, onlySlugs);

const EN_HEADERS = [
  "WHO YOU ARE",
  "HOW YOU ARE RIGHT NOW",
  "HOW YOU TALK",
  "WHAT YOU DO AND DO NOT SAY",
  "HOW YOU RESPOND TO THE THERAPIST",
];
const AR_HEADERS: Array<string | RegExp> = [
  /^مين إنتِ?$/m,
  "كيف حالك هلأ",
  "كيف بتحكي",
  "شو بتحكي وشو ما بتحكي",
  /^كيف بتردّي? على المعالج$/m,
];

// Method or means of self-harm never appear in authored content, in either
// language, even as history ("no graphic or procedural self-harm detail").
const METHOD_WORDS =
  /\b(overdos\w*|pills? to|hang(ed|ing)? (him|her|my)self|noose|razor|blade|cut(ting)? (him|her|my)self|wrists?|jump(ed|ing)? (off|from)|bridge|gun|firearm|poison|bleach)\b/i;
const METHOD_WORDS_AR =
  /(جرعة زائدة|شنق|حبل|شفرة|جرح(ت)? (حالي|حالها|حاله|إيدي|إيدها|إيده)|قطع(ت)? (إيدي|إيدها|إيده)|معصم|أرمي حالي|نط من|جسر|مسدس|كلور)/;

function voiceProfileFor(r: LadderAvatarRecord): VoiceProfile {
  return {
    id: r.voices.voice_profile_id,
    provider: "elevenlabs",
    voice_name: "ladder",
    voice_id: r.voices.ar,
    language: "ar",
    dialect: null,
    gender: r.clinical_core.gender,
    is_active: true,
    created_at: "2026-10-07T00:00:00.000Z",
  };
}

function avatarFor(r: LadderAvatarRecord): Avatar {
  const en = r.personalities["en-US"];
  return {
    id: `avatar-${r.slug}`,
    name: en.identity.display_name,
    disorder: r.clinical_core.disorder,
    age: r.clinical_core.age,
    gender: r.clinical_core.gender,
    portrait_url: r.portrait_url,
    persona_prompt: en.persona_prompt,
    ideal_guidelines: {
      session_goals: r.clinical_core.session_goals,
      ideal_approach: r.clinical_core.ideal_approach,
    },
    rubric: r.rubric,
    voice_profile_id: r.voices.voice_profile_id,
    voice_profile: voiceProfileFor(r),
    voice_id: r.voices.en,
    voice_id_ar: r.voices.ar,
    schema_version: 2,
    slug: r.slug,
    default_locale: r.default_locale,
    clinical_core: r.clinical_core,
    personalities: r.personalities,
    human_personality: r.human_personality,
    lifecycle_status: "published",
    is_active: true,
    created_at: "2026-10-07T00:00:00.000Z",
    updated_at: "2026-10-07T00:00:00.000Z",
  };
}

describe("program patient files", () => {
  it("has exactly one authored file per program patient, five female and five male", () => {
    expect(records.map((r) => r.ladder_key)).toEqual(
      LADDER_PATIENTS.map((p) => p.key),
    );
    for (const p of LADDER_PATIENTS) {
      const r = records.find((x) => x.ladder_key === p.key)!;
      expect(r.slug).toBe(p.avatarSlug);
      expect(r.slot).toBe(p.slot);
      expect(r.primary_disorder_slug).toBe(p.primaryDisorderSlug);
      // The avatar's disorder is the catalogue name, so a ladder case on
      // the primary disorder is never treated as a diagnosis override.
      expect(r.clinical_core.disorder).toBe(
        findDisorderBySlug(p.primaryDisorderSlug)!.name,
      );
      expect(r.clinical_core.risk_profile.self_harm ?? false).toBe(
        p.risk.selfHarmHistory,
      );
      expect(r.portrait_url).toBe(`/avatars/${r.slug}.svg`);
      expect(readFileSync(join(root, "public", r.portrait_url), "utf8")).toMatch(
        /^<svg /,
      );
    }
    const genders = records.map((r) => r.clinical_core.gender);
    expect(genders.filter((g) => g === "female")).toHaveLength(5);
    expect(genders.filter((g) => g === "male")).toHaveLength(5);
  });

  it("gives every patient two different people, one per language", () => {
    const names = new Set<string>();
    for (const r of records) {
      const en = r.personalities["en-US"];
      const ar = r.personalities["ar-JO"];
      expect(en.identity.display_name).not.toBe(ar.identity.display_name);
      expect(ar.identity.display_name).toMatch(/[؀-ۿ]/);
      expect(ar.identity.country).toBe("الأردن");
      expect(en.persona_prompt).not.toMatch(/[؀-ۿ]/);
      for (const name of [en.identity.display_name, ar.identity.display_name]) {
        expect(names.has(name)).toBe(false);
        names.add(name);
      }
    }
  });

  it("passes the virtual patient publish gate", () => {
    for (const r of records) {
      const disorder = findDisorderBySlug(r.primary_disorder_slug)!;
      const result = assessPublishReadiness(
        {
          slug: r.slug,
          default_locale: r.default_locale,
          clinical_core: r.clinical_core,
          personalities: r.personalities,
          human_personality: r.human_personality,
          rubric: r.rubric,
          voice_profile_id: r.voices.voice_profile_id,
          voice_id: r.voices.en,
          voice_id_ar: r.voices.ar,
          persona: { default_disorder_id: disorder.id },
        },
        {
          voiceProfile: voiceProfileFor(r),
          defaultDisorderId: disorder.id,
          defaultDisorderActive: true,
        },
      );
      const errors = result.issues.filter((i) => i.severity === "error");
      expect({ slug: r.slug, errors }).toEqual({ slug: r.slug, errors: [] });
      for (const locale of LADDER_PATIENT_LOCALES) {
        const hp = validateHumanPersonality(r.human_personality[locale]);
        expect({
          slug: r.slug,
          locale,
          issues: hp.ok ? [] : hp.issues,
        }).toEqual({ slug: r.slug, locale, issues: [] });
        expect(r.human_personality[locale].locale).toBe(locale);
        expect(r.human_personality[locale].avatar_slug).toBe(r.slug);
      }
    }
  });

  it("uses approved voices of the patient's gender in each language", () => {
    for (const r of records) {
      expect(isVoiceApprovedFor(r.voices.en, "en")).toBe(true);
      expect(isVoiceApprovedFor(r.voices.ar, "ar")).toBe(true);
      expect(voiceGenderOf(r.voices.en)).toBe(r.clinical_core.gender);
      expect(voiceGenderOf(r.voices.ar)).toBe(r.clinical_core.gender);
      expect(r.personalities["en-US"].voice.voice_id).toBe(r.voices.en);
      expect(r.personalities["ar-JO"].voice.voice_id).toBe(r.voices.ar);
      expect(r.personalities["en-US"].voice.stt_lang).toBe("en-US");
      expect(r.personalities["ar-JO"].voice.stt_lang).toBe("ar-JO");
    }
  });

  it("keeps the persona prompt sections the runtime recognises", () => {
    for (const r of records) {
      const en = r.personalities["en-US"].persona_prompt;
      const ar = r.personalities["ar-JO"].persona_prompt;
      for (const h of EN_HEADERS) expect(en.split("\n")).toContain(h);
      for (const h of AR_HEADERS) {
        if (typeof h === "string") expect(ar.split("\n")).toContain(h);
        else expect(ar).toMatch(h);
      }
      // Risk disclosure is decided by the level (Module 1), not the persona.
      expect(en).toContain("Module 1");
      expect(ar).toContain("Module 1");
    }
  });

  it("never describes a method or means of self-harm", () => {
    for (const s of sources) {
      const text = JSON.stringify(s);
      expect({ slug: s.slug, match: text.match(METHOD_WORDS)?.[0] ?? null }).toEqual({
        slug: s.slug,
        match: null,
      });
      expect({
        slug: s.slug,
        match: text.match(METHOD_WORDS_AR)?.[0] ?? null,
      }).toEqual({ slug: s.slug, match: null });
    }
  });

  it("keeps suicidal ideation passive in the authored core", () => {
    for (const r of records) {
      expect(r.clinical_core.risk_profile.suicidal_ideation).toBe("passive");
      expect(r.clinical_core.risk_profile.harm_to_others ?? false).toBe(false);
    }
  });

  it("mints every level's case and prompt from the authored patient", () => {
    for (const r of records) {
      const p = LADDER_PATIENTS.find((x) => x.key === r.ladder_key)!;
      const avatar = avatarFor(r);
      const primary = findDisorderBySlug(p.primaryDisorderSlug)!;
      const persona: PersonaRow = {
        id: `persona-${p.key}`,
        avatar_id: avatar.id,
        slug: r.slug,
        display_name: avatar.name,
        identity: { age: r.clinical_core.age, gender: r.clinical_core.gender },
        traits: { human_personality: r.human_personality },
        baseline_history: {},
        default_disorder_id: primary.id,
        is_active: true,
      };
      for (const { level } of LADDER_LEVELS) {
        const def = ladderLevelDef(level);
        for (const locale of LADDER_PATIENT_LOCALES) {
          const result = generateCaseInstance({
            persona,
            avatarId: avatar.id,
            primaryDisorder: primary,
            comorbidities: ladderComorbidities(p, level).map(
              (s) => findDisorderBySlug(s)!,
            ),
            difficulty: def.difficulty,
            therapyModality: "supportive",
            locale,
            seed: `${p.key}:${level}:${locale}`,
            difficultyProfile: findDifficulty(def.difficulty),
            therapyProfile: findTherapy("supportive"),
            legacyClinicalCore: r.clinical_core,
            avatarHumanPersonality: r.human_personality,
            avatarSlug: r.slug,
            avatarName: avatar.name,
            avatarDisorder: avatar.disorder,
            riskOverlay: ladderRiskOverlay(level, p.risk),
          });
          expect({ key: p.key, level, ok: result.ok }).toEqual({
            key: p.key,
            level,
            ok: true,
          });
          if (!result.ok) continue;
          const snapshot = result.snapshot;
          expect(snapshot.clinical_core.risk_profile.suicidal_ideation).toBe(
            "passive",
          );
          expect(isCaseDiagnosisOverride(avatar, snapshot)).toBe(false);
          const resolved = resolveAvatar(avatar, locale, {
            caseSnapshot: snapshot,
          });
          const name = r.personalities[locale].identity.display_name;
          expect(resolved.name).toBe(name);
          expect(resolved.system_prompt).toContain(name);
          // The authored current state survives (no override stripping).
          expect(resolved.system_prompt).toContain(
            locale === "en-US" ? "HOW YOU ARE RIGHT NOW" : "كيف حالك هلأ",
          );
          expect(resolved.system_prompt).not.toMatch(/\{\{[^}]+\}\}/);
          expect(resolved.human_personality?.avatar_slug).toBe(r.slug);
          expect(resolved.voice_id).toBe(r.voices.en);
          expect(resolved.voice_id_ar).toBe(r.voices.ar);
        }
      }
    }
  });
});

describe("generated migration", () => {
  it("matches the authored files", () => {
    const sql = buildLadderPatientsMigrationSql(records);
    const path = join(root, LADDER_PATIENTS_MIGRATION);
    if (process.env.WRITE_LADDER_PATIENTS_MIGRATION === "1" && !onlySlugs) {
      writeFileSync(path, sql);
    }
    expect(readFileSync(path, "utf8")).toBe(sql);
  });

  it("publishes, personas and ladders every patient and retires the stand-in", () => {
    const sql = readFileSync(join(root, LADDER_PATIENTS_MIGRATION), "utf8");
    for (const p of LADDER_PATIENTS) {
      expect(sql).toContain(`SELECT '${p.key}', ${p.slot}, a.id`);
      expect(sql).toContain(`WHERE a.slug = '${p.avatarSlug}'`);
    }
    expect(sql.match(/'published'/g)).toHaveLength(LADDER_PATIENTS.length);
    expect(sql).toMatch(/SET is_active = false, slot = 99\s+WHERE key = 'maya'/);
    // Retiring Maya happens before any patient takes slot 1.
    expect(sql.indexOf("WHERE key = 'maya'")).toBeLessThan(
      sql.indexOf("INSERT INTO public.training_ladder_patients"),
    );
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON public\.training_ladder_patients, public\.training_ladder_attempts\s+FROM authenticated;/,
    );
    expect(sql).not.toMatch(/\bGRANT\b/);
  });
});
