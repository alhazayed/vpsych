/**
 * The program patients' authored files (`personas/ladder/<slug>.json`).
 *
 * Each file is one person with two natively authored personalities (en-US
 * and ar-JO), their human-personality traits and a language-neutral clinical
 * core for the primary disorder. Persona prompts are stored as arrays of
 * lines so they can be reviewed line by line; `toLadderAvatarRecord` joins
 * them into the avatar row shape the runtime reads.
 *
 * Read by tests and by the migration builder only (Node `fs`). The app reads
 * these patients from the database like every other avatar.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { HumanPersonalityProfile } from "@/lib/personality-engine";
import type {
  AvatarPersonality,
  ClinicalCore,
  RubricItem,
} from "@/lib/types";

export const LADDER_PATIENT_LOCALES = ["en-US", "ar-JO"] as const;
export type LadderPatientLocale = (typeof LADDER_PATIENT_LOCALES)[number];

type SourcePersonality = Omit<AvatarPersonality, "persona_prompt"> & {
  persona_prompt: string[];
};

export type LadderPatientSource = {
  slug: string;
  ladder_key: string;
  slot: number;
  primary_disorder_slug: string;
  default_locale: "en-US";
  portrait_url: string;
  voices: {
    /** ElevenLabs voice for English sessions. */
    en: string;
    /** ElevenLabs voice for Arabic sessions. */
    ar: string;
    /** voice_profiles row of the Arabic voice (resolved by voice id in SQL). */
    voice_profile_id: string;
  };
  authoring_notes?: string;
  clinical_core: ClinicalCore & { icd10_code?: string };
  rubric: RubricItem[];
  personalities: Record<LadderPatientLocale, SourcePersonality>;
  human_personality: Record<LadderPatientLocale, HumanPersonalityProfile>;
};

/** The avatar-row shape (persona prompts joined) for one program patient. */
export type LadderAvatarRecord = Omit<LadderPatientSource, "personalities"> & {
  personalities: Record<LadderPatientLocale, AvatarPersonality>;
};

export const LADDER_PATIENT_DIR = join(
  __dirname,
  "../../../personas/ladder",
);

export function loadLadderPatientSources(
  dir: string = LADDER_PATIENT_DIR,
  /** Only these slugs (file names without `.json`); all when omitted. */
  slugs?: readonly string[],
): LadderPatientSource[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !slugs || slugs.includes(f.slice(0, -".json".length)))
    .sort()
    .map(
      (f) =>
        JSON.parse(readFileSync(join(dir, f), "utf8")) as LadderPatientSource,
    )
    .sort((a, b) => a.slot - b.slot);
}

export function toLadderAvatarRecord(
  source: LadderPatientSource,
): LadderAvatarRecord {
  const personalities = {} as Record<LadderPatientLocale, AvatarPersonality>;
  for (const locale of LADDER_PATIENT_LOCALES) {
    const p = source.personalities[locale];
    personalities[locale] = {
      ...p,
      persona_prompt: p.persona_prompt.join("\n"),
    } as AvatarPersonality;
  }
  return { ...source, personalities };
}

export function loadLadderAvatarRecords(
  dir?: string,
  slugs?: readonly string[],
): LadderAvatarRecord[] {
  return loadLadderPatientSources(dir, slugs).map(toLadderAvatarRecord);
}
