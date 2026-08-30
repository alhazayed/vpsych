/**
 * Explicit TTS-only speech-name overrides.
 *
 * Never guess a name pronunciation. Only apply when the display form is
 * listed here or passed via `speechNameOverrides` at prepare/TTS time.
 *
 * display_name → speech_name (TTS surface only; never mutates stored identity).
 */

export const SPEECH_NAME_DICTIONARY_VERSION = "1.0.0" as const;

export type SpeechNameEntry = {
  /** Exact display / dialogue surface (undiacritized match key). */
  display_name: string;
  /** TTS-only pronunciation form. */
  speech_name: string;
  /** Optional note (docs / admin); never spoken. */
  note?: string;
};

/**
 * Known VPsych standardized-patient name overrides (ar-JO personas + family).
 * Additive only — unknown names are left unchanged.
 */
export const SPEECH_NAME_OVERRIDES: readonly SpeechNameEntry[] = [
  {
    display_name: "ليان",
    speech_name: "لِيان",
    note: "Maya Chen ar-JO given name",
  },
  {
    display_name: "خوري",
    speech_name: "خُورِي",
    note: "Maya Chen ar-JO family name",
  },
  {
    display_name: "رامي",
    speech_name: "رامِي",
    note: "Jordan Hale ar-JO given name",
  },
  {
    display_name: "نصار",
    speech_name: "نَصّار",
    note: "Jordan Hale ar-JO family name",
  },
  { display_name: "فادي", speech_name: "فادِي" },
  { display_name: "نبيل", speech_name: "نَبِيل" },
  { display_name: "هيام", speech_name: "هِيام" },
  { display_name: "نتالي", speech_name: "نَتالِي" },
  { display_name: "وديعة", speech_name: "وَدِيعة" },
] as const;

/** Merge catalog + runtime overrides into a lexicon (longest display first). */
export function resolveSpeechNameLexicon(
  runtimeOverrides?: Readonly<Record<string, string>> | null,
): ReadonlyArray<readonly [string, string]> {
  const map = new Map<string, string>();
  for (const e of SPEECH_NAME_OVERRIDES) {
    map.set(e.display_name, e.speech_name);
  }
  if (runtimeOverrides) {
    for (const [display, speech] of Object.entries(runtimeOverrides)) {
      const d = display.trim();
      const s = speech.trim();
      if (d && s) map.set(d, s);
    }
  }
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
}
