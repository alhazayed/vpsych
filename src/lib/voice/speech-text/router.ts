/**
 * Language router for the speech-text layer.
 *
 * Routing is driven by the SESSION locale, never by sniffing the reply text.
 * Sniffing would let a single embedded Latin token flip an Arabic turn onto the
 * English pipeline mid-session.
 */

import { normalizeArabicSpeech } from "@/lib/voice/speech-text/ar/normalize";
import { normalizeEnglishSpeech } from "@/lib/voice/speech-text/en/normalize";
import type { NormalizeResult } from "@/lib/voice/speech-text/types";
import {
  normalizeSpeechLocale,
  type SessionSpeechLocale,
} from "@/lib/voice/config";

export type SpeechNormalizer = (input: string) => NormalizeResult;

export function normalizerFor(
  locale: SessionSpeechLocale | string,
): SpeechNormalizer {
  return normalizeSpeechLocale(locale) === "ar"
    ? normalizeArabicSpeech
    : normalizeEnglishSpeech;
}

export function normalizeSpeechText(
  input: string,
  locale: SessionSpeechLocale | string,
): NormalizeResult {
  return normalizerFor(locale)(input);
}
