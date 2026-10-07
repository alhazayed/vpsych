/**
 * Patient gender ↔ voice gender.
 *
 * A standardized patient is either male or female, and the voice that speaks
 * for them must be of the same gender: a female voice means a female patient
 * and vice versa. This module is the single rule both the admin editors and
 * the server-side write paths apply.
 *
 * Voice gender comes from the ElevenLabs workspace metadata transcribed below,
 * keyed by exact voice id (the same evidence as VERIFIED_VOICE_LANGUAGES in
 * ./voice-language). `voice_profiles.gender` is an admin-typed label, so it is
 * only consulted for a voice id this table does not list.
 */

export const PATIENT_GENDERS = ["female", "male"] as const;
export type PatientGender = (typeof PATIENT_GENDERS)[number];

export function isPatientGender(value: unknown): value is PatientGender {
  return value === "female" || value === "male";
}

/** Normalize a free-text gender label ("Female", " male ") to male/female. */
export function normalizeVoiceGender(
  value: string | null | undefined,
): PatientGender | null {
  const v = value?.trim().toLowerCase();
  return isPatientGender(v) ? v : null;
}

/** Gender of each known ElevenLabs voice, from workspace metadata. */
export const VOICE_GENDERS: Readonly<Record<string, PatientGender>> =
  Object.freeze({
    // Premade English voices used as defaults / fixtures.
    EXAVITQu4vr4xnSDxMaL: "female", // Sarah (built-in English default)
    pNInz6obpgDQGcFmaJgB: "male", // Adam - Dominant, Firm
    hpp4J3VqNfWAUOO0d1Us: "female", // Bella
    // Arabic catalogue.
    HJ8unGw6UFYkApOU0Oea: "male", // Omars
    isQLuoVuANx6FjDxyasX: "female", // Noura
    cdxrkuYK4nZwDSkjw5sa: "female", // Amira
    R6nda3uM038xEEKi7GFl: "male", // Anas
    // Owner's voice list of 2026-10-04 ("Vpsych Voices").
    m3yAHyFEFKtbCIM5n7GF: "female", // Aisha (Ash)
    "3svOJAOhuPHXwQC2H5eq": "male", // Brady
    s3TPKV1kjDlVtZbl4Ksh: "male", // Adam - Engaging
    oJQlz7pz2yWd7MRmDUXm: "male", // Fadi
    "3vR1KVyyNDhdkucpugQI": "male", // Ahmad (Saad)
    Wim44P0dU9HtjyzNnFsv: "female", // Hiba (Ghaida)
    JTMaHm6sHVI3NZgPaWDz: "male", // Jamal (Gamal)
  });

type ProfileLike =
  | { voice_id?: string | null; gender?: string | null }
  | null
  | undefined;

/** Gender of a voice id; falls back to the profile label for unlisted ids. */
export function voiceGenderOf(
  voiceId: string | null | undefined,
  profile?: ProfileLike,
): PatientGender | null {
  const id = voiceId?.trim();
  if (!id) return null;
  const known = VOICE_GENDERS[id];
  if (known) return known;
  if (profile && profile.voice_id?.trim() === id) {
    return normalizeVoiceGender(profile.gender);
  }
  return null;
}

/** Gender of a voice profile row (registry first, then its own label). */
export function voiceProfileGender(profile: ProfileLike): PatientGender | null {
  if (!profile) return null;
  return voiceGenderOf(profile.voice_id, profile) ?? normalizeVoiceGender(profile.gender);
}

export type PatientVoiceSlot = "voice_profile" | "voice_id" | "voice_id_ar";

export type VoiceGenderMismatch = {
  slot: PatientVoiceSlot;
  voiceId: string;
  voiceGender: PatientGender;
};

/**
 * Every assigned voice whose known gender differs from the patient's.
 * A patient whose gender is not male/female yields no mismatches; that case
 * is reported separately by the gender check itself.
 */
export function findVoiceGenderMismatches(input: {
  gender: string | null | undefined;
  voiceProfile?: ProfileLike;
  voice_id?: string | null;
  voice_id_ar?: string | null;
}): VoiceGenderMismatch[] {
  if (!isPatientGender(input.gender)) return [];
  const out: VoiceGenderMismatch[] = [];
  const seen = new Set<string>();
  const check = (slot: PatientVoiceSlot, voiceId: string | null | undefined) => {
    const id = voiceId?.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const g = voiceGenderOf(id, input.voiceProfile);
    if (g && g !== input.gender) out.push({ slot, voiceId: id, voiceGender: g });
  };
  if (input.voiceProfile) {
    const g = voiceProfileGender(input.voiceProfile);
    const id = input.voiceProfile.voice_id?.trim() ?? "";
    if (id) seen.add(id);
    if (g && g !== input.gender) {
      out.push({ slot: "voice_profile", voiceId: id, voiceGender: g });
    }
  }
  check("voice_id", input.voice_id);
  check("voice_id_ar", input.voice_id_ar);
  return out;
}

/** Voice profiles a patient of this gender may use (unknown-gender voices excluded). */
export function voicesForPatientGender<
  T extends { voice_id?: string | null; gender?: string | null },
>(
  profiles: readonly T[],
  gender: string | null | undefined,
): T[] {
  if (!isPatientGender(gender)) return [...profiles];
  return profiles.filter((p) => voiceProfileGender(p) === gender);
}
