/**
 * Builds the SQL migration that seeds the program patients from their
 * authored files. The migration file is generated, never hand-edited:
 * `patient-files.test.ts` fails when it drifts from `personas/ladder/*.json`,
 * and `WRITE_LADDER_PATIENTS_MIGRATION=1 npx vitest run
 * src/lib/training-ladder/patient-files.test.ts` rewrites it.
 *
 * Everything is additive and idempotent: an avatar, persona or ladder row
 * that already exists is left alone.
 */
import { findDisorderBySlug } from "@/lib/case-engine/catalog";
import type { LadderAvatarRecord } from "@/lib/training-ladder/patient-files";

export const LADDER_PATIENTS_MIGRATION =
  "supabase/migrations/20261007160000_training_ladder_patients.sql";

const JSON_TAG = "$ladder$";

function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function jsonb(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  if (text.includes(JSON_TAG)) {
    throw new Error(`Authored content contains the SQL quote tag ${JSON_TAG}`);
  }
  return `${JSON_TAG}${text}${JSON_TAG}::jsonb`;
}

function text(value: string): string {
  if (value.includes(JSON_TAG)) {
    throw new Error(`Authored content contains the SQL quote tag ${JSON_TAG}`);
  }
  return `${JSON_TAG}${value}${JSON_TAG}`;
}

function personaTraits(r: LadderAvatarRecord): Record<string, unknown> {
  const en = r.human_personality["en-US"];
  return {
    human_personality: r.human_personality,
    temperament: en.temperament,
    attachment_style: en.attachment_style,
    communication_style: en.speech_style,
  };
}

function avatarInsert(r: LadderAvatarRecord): string {
  const en = r.personalities["en-US"];
  return `-- ${r.slot}. ${en.identity.display_name} / ${r.personalities["ar-JO"].identity.display_name} (${r.clinical_core.disorder})
INSERT INTO public.avatars (
  slug, schema_version, default_locale, lifecycle_status,
  name, disorder, age, gender, persona_prompt, portrait_url,
  clinical_core, personalities, human_personality, rubric,
  voice_id, voice_id_ar, voice_profile_id
)
SELECT
  ${lit(r.slug)}, 2, ${lit(r.default_locale)}, 'published',
  ${lit(en.identity.display_name)}, ${lit(r.clinical_core.disorder)}, ${r.clinical_core.age}, ${lit(r.clinical_core.gender)},
  ${text(en.persona_prompt)},
  ${lit(r.portrait_url)},
  ${jsonb(r.clinical_core)},
  ${jsonb(r.personalities)},
  ${jsonb(r.human_personality)},
  ${jsonb(r.rubric)},
  ${lit(r.voices.en)}, ${lit(r.voices.ar)},
  (SELECT vp.id FROM public.voice_profiles vp
   WHERE vp.id = ${lit(r.voices.voice_profile_id)} AND vp.voice_id = ${lit(r.voices.ar)})
WHERE NOT EXISTS (SELECT 1 FROM public.avatars WHERE slug = ${lit(r.slug)});`;
}

function personaInsert(r: LadderAvatarRecord): string {
  const disorder = findDisorderBySlug(r.primary_disorder_slug);
  if (!disorder) {
    throw new Error(`Unknown primary disorder ${r.primary_disorder_slug}`);
  }
  const identity = {
    age: r.clinical_core.age,
    gender: r.clinical_core.gender,
    source: "training_ladder",
  };
  return `INSERT INTO public.personas (
  avatar_id, slug, display_name, identity, traits, baseline_history,
  default_disorder_id, is_active
)
SELECT
  a.id, ${lit(r.slug)}, ${lit(r.personalities["en-US"].identity.display_name)},
  ${jsonb(identity)},
  ${jsonb(personaTraits(r))},
  '{}'::jsonb,
  ${lit(disorder.id)}, true
FROM public.avatars a
WHERE a.slug = ${lit(r.slug)}
  AND NOT EXISTS (
    SELECT 1 FROM public.personas p WHERE p.avatar_id = a.id OR p.slug = ${lit(r.slug)}
  );`;
}

function ladderInsert(r: LadderAvatarRecord): string {
  return `INSERT INTO public.training_ladder_patients (key, slot, avatar_id)
SELECT ${lit(r.ladder_key)}, ${r.slot}, a.id
FROM public.avatars a
WHERE a.slug = ${lit(r.slug)}
ON CONFLICT (key) DO NOTHING;`;
}

export function buildLadderPatientsMigrationSql(
  records: readonly LadderAvatarRecord[],
): string {
  const sorted = [...records].sort((a, b) => a.slot - b.slot);
  const parts: string[] = [
    `-- Patient training ladder, phase 2: the ten program patients.
--
-- GENERATED from personas/ladder/*.json by
-- src/lib/training-ladder/patient-migration.ts. Do not edit by hand.
--
-- Each patient is one avatar (schema v2, published) with natively authored
-- en-US and ar-JO personalities, human-personality traits for both locales,
-- a persona row (default disorder = the patient's primary disorder, traits
-- mirrored so the case freezes the authored personality), and a ladder row.
-- Maya Chen's provisional ladder row is retired; she stays in the library.
-- The ladder tables keep SELECT only for signed-in users (no table-level
-- write grants; RLS already allowed no writes).
--
-- Additive and idempotent. To reverse: delete the ten training_ladder_patients
-- rows (and their attempts), personas and avatars by slug, and set the 'maya'
-- row back to slot 1, active.`,
    `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.training_ladder_patients, public.training_ladder_attempts
  FROM authenticated;`,
  ];
  for (const r of sorted) {
    parts.push(avatarInsert(r));
    parts.push(personaInsert(r));
  }
  parts.push(`-- Retire the provisional patient before the program takes slot 1.
UPDATE public.training_ladder_patients
SET is_active = false, slot = 99
WHERE key = 'maya' AND slot <> 99;`);
  for (const r of sorted) parts.push(ladderInsert(r));
  return `${parts.join("\n\n")}\n`;
}
