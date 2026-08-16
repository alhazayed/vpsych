/**
 * Google Cloud TTS capability matrix — what the provider *documents* as
 * supported, per voice family and locale.
 *
 * Deliberately separate from rollout enablement (`config.ts` feature flags).
 * Capability answers "will Google accept this?"; enablement answers "have we
 * approved this for VPsych yet?". Conflating them is what produced the earlier
 * wrong conclusion that Chirp 3 HD cannot vary pace.
 *
 * Sources (Google Cloud Text-to-Speech documentation, verified 2026-08):
 * - Chirp 3: HD voices — pace control via `speaking_rate` [0.25, 2.0],
 *   available across ALL locales.
 * - Chirp 3: HD voices — pause control via the `markup` input field using
 *   `[pause]`, `[pause short]`, `[pause long]`, available across all locales
 *   EXCEPT those in PAUSE_CONTROL_EXCLUDED_LOCALES below.
 * - Chirp 3: HD voices — custom pronunciations via IPA / X-SAMPA, available
 *   across all locales EXCEPT CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES below.
 * - `SynthesisInput.markup` (cloud_tts.proto): "Markup for Chirp 3: HD voices
 *   specifically. This field may not be used with any other voices."
 * - Chirp 3: HD voices do NOT support the `pitch` audio parameter; sending it
 *   returns "This voice does not support pitch parameters at this time."
 *
 * `ar-XA` is absent from both exclusion lists, so Arabic supports pause
 * control and custom pronunciations. See KNOWN_DIVERGENCES for field reports
 * that contradict the documentation — the reason both features ship disabled.
 */

export type GoogleVoiceFamily = "chirp3-hd" | "classic";

export type GoogleFeature =
  | "speaking_rate"
  | "pitch"
  | "pause_control"
  | "custom_pronunciation"
  | "ssml";

/** Google audioConfig ranges (cloud_tts.proto). */
export const SPEAKING_RATE_RANGE = { min: 0.25, max: 2.0 } as const;
export const PITCH_SEMITONE_RANGE = { min: -20, max: 20 } as const;

/** Locales where Chirp 3 HD pause control is NOT offered. */
export const PAUSE_CONTROL_EXCLUDED_LOCALES: readonly string[] = [
  "bg-bg", "cs-cz", "el-gr", "et-ee", "he-il", "hr-hr", "hu-hu", "lt-lt",
  "lv-lv", "pa-in", "ro-ro", "sk-sk", "sl-si", "sr-rs", "yue-hk",
] as const;

/** Locales where Chirp 3 HD custom pronunciations are NOT offered. */
export const CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES: readonly string[] = [
  "bg-bg", "bn-in", "cs-cz", "da-dk", "el-gr", "et-ee", "fi-fi", "gu-in",
  "he-il", "hr-hr", "hu-hu", "lt-lt", "lv-lv", "nb-no", "nl-be", "pa-in",
  "ro-ro", "sk-sk", "sl-si", "sr-rs", "sv-se", "sw-ke", "th-th", "uk-ua",
  "ur-in", "vi-vn", "yue-hk",
] as const;

/**
 * Documented behavior that field reports contradict. Recorded here because it
 * is the justification for shipping pause control and custom pronunciations
 * disabled-by-default rather than trusting the docs outright.
 */
export const KNOWN_DIVERGENCES = [
  "Chirp 3 HD pause control reported unavailable for some locales that the docs list as supported.",
  "Chirp 3 HD reported to emit garbled words when the markup field is used.",
  "Chirp 3 HD custom pronunciations reported not to take effect in some configurations.",
] as const;

export function googleVoiceFamily(voiceName: string): GoogleVoiceFamily {
  return /-chirp/i.test(voiceName) ? "chirp3-hd" : "classic";
}

function localeKey(languageCode: string): string {
  return languageCode.trim().toLowerCase();
}

/**
 * Does Google document `feature` as supported for this voice + locale?
 * This is a provider fact, independent of whether VPsych has enabled it.
 */
export function googleSupports(
  feature: GoogleFeature,
  voiceName: string,
  languageCode: string,
): boolean {
  const family = googleVoiceFamily(voiceName);
  const locale = localeKey(languageCode);

  switch (feature) {
    case "speaking_rate":
      // Chirp 3 HD pace control is documented across all locales.
      return true;
    case "pitch":
      // Chirp 3 HD rejects pitch outright; classic families accept it.
      return family === "classic";
    case "pause_control":
      // The markup field is Chirp 3 HD only, and not in every locale.
      return (
        family === "chirp3-hd" &&
        !PAUSE_CONTROL_EXCLUDED_LOCALES.includes(locale)
      );
    case "custom_pronunciation":
      return !CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES.includes(locale);
    case "ssml":
      return family === "classic";
  }
}
