/**
 * Trusted voice → language classification.
 *
 * The session locale has always decided which *slot* is read (`voice_id` for
 * English, `voice_id_ar` for Arabic, and the matching env/default pair). What
 * nothing verified is that the id sitting in that slot is a voice of that
 * language. `voice_profiles.language` is a free-text column describing the
 * profile, not the voice, so an Arabic-labelled profile could — and in
 * production did — carry an English ElevenLabs voice.
 *
 * This module supplies the missing fact: for a given voice id, which language
 * is it actually approved to speak. Entries are transcribed from ElevenLabs
 * workspace metadata and matched by exact `voice_id`; the comment on each row
 * records the resolved name and the metadata that justifies the entry.
 *
 * FAIL-CLOSED: an id that is not listed has no trusted language and is
 * therefore approved for nothing. A new voice becomes usable by being verified
 * and added here — never by being written into a database column.
 *
 * Classification is not availability. Listing an id here states what language
 * it speaks; it does not add it to any catalogue, activate a profile, or make
 * it selectable. Selection still requires a voice_profile, an avatar column, or
 * an environment default, exactly as before.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";

/**
 * Verified voice ids, keyed by id. Scope is deliberately narrow: the ids that
 * are reachable from the current production configuration, plus those already
 * used as fixtures by the voice test-suite. Candidate voices awaiting casting
 * are intentionally absent.
 */
export const VERIFIED_VOICE_LANGUAGES: Readonly<
  Record<string, SessionSpeechLocale>
> = Object.freeze({
  // "Sarah - Mature, Reassuring, Confident" — premade, language en, accent american.
  // Currently the English default, and (incorrectly) the voice behind the
  // Arabic-labelled "Amira (Bella)" profile and maya-chen.voice_id_ar.
  EXAVITQu4vr4xnSDxMaL: "en",
  // "Adam - Dominant, Firm" — premade, language en, accent american.
  // Currently DEFAULT_ELEVENLABS_VOICE_AR, which this module makes unusable
  // for Arabic rather than silently speaking English.
  pNInz6obpgDQGcFmaJgB: "en",
  // "Bella - Professional, Bright, Warm" — premade, language en, accent american.
  hpp4J3VqNfWAUOO0d1Us: "en",
  // "Omars - Storytelling & Podcasts" — language ar, accent modern standard.
  // Backs the active "Omars" profile used by jordan-hale.
  HJ8unGw6UFYkApOU0Oea: "ar",
  // "Noura - Soft and Polished" — language ar, accent gulf.
  // Present as an INACTIVE voice_profiles row; listed so that if it is ever
  // activated it is classified correctly. Listing does not activate it.
  isQLuoVuANx6FjDxyasX: "ar",
  // "Amira - Poised and Graceful" — language ar, accent gulf.
  cdxrkuYK4nZwDSkjw5sa: "ar",
});

/**
 * Raised when a session's locale has no approved voice available anywhere in
 * the precedence chain. Preferred over falling through to a voice of the wrong
 * language: silent cross-language speech is a clinical-realism defect that the
 * therapist cannot detect from the transcript.
 */
export class VoiceLanguageError extends Error {
  readonly code = "VOICE_LANGUAGE_UNAVAILABLE";
  readonly status = 503;
  readonly locale: SessionSpeechLocale;

  constructor(locale: SessionSpeechLocale) {
    super(
      `No approved ${locale} voice is configured. Refusing to speak ${locale} with a voice of another language.`,
    );
    this.name = "VoiceLanguageError";
    this.locale = locale;
  }
}

/** The language a voice id is verified to speak, or null when unverified. */
export function trustedVoiceLanguage(
  voiceId: string | null | undefined,
): SessionSpeechLocale | null {
  if (typeof voiceId !== "string" || !voiceId) return null;
  return VERIFIED_VOICE_LANGUAGES[voiceId] ?? null;
}

/**
 * Whether a voice id may be spoken on a session of this locale.
 * Unverified ids are approved for nothing.
 */
export function isVoiceApprovedFor(
  voiceId: string | null | undefined,
  locale: SessionSpeechLocale,
): boolean {
  return trustedVoiceLanguage(voiceId) === locale;
}

/** Every verified voice id for a locale. Useful for diagnostics and admin UI. */
export function approvedVoicesFor(locale: SessionSpeechLocale): string[] {
  return Object.entries(VERIFIED_VOICE_LANGUAGES)
    .filter(([, lang]) => lang === locale)
    .map(([id]) => id);
}
