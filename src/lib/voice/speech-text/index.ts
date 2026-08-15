/**
 * Speech-text layer — public API.
 *
 * ┌─────────────────────┐
 * │ patient-agent reply │  (authoritative)
 * └──────────┬──────────┘
 *            ├──► DISPLAY TEXT ──► session_messages · transcript · assessment
 *            └──► prepareSpeech() ──► SPEECH TEXT ──► TTS provider only
 *
 * `prepareSpeech` is pure and side-effect free. It returns a derived speech
 * representation and never returns, mutates, or persists display text.
 */

import { normalizeSpeechText } from "@/lib/voice/speech-text/router";
import { segmentSpeech } from "@/lib/voice/speech-text/segment";
import { normalizeSpeechLocale, type SessionSpeechLocale } from "@/lib/voice/config";
import type {
  PreparedSpeech,
  SegmentOptions,
} from "@/lib/voice/speech-text/types";

export type { PreparedSpeech, SegmentOptions, SpeechSegment, SegmentBoundary, NormalizeResult } from "@/lib/voice/speech-text/types";
export { normalizeSpeechText, normalizerFor } from "@/lib/voice/speech-text/router";
export { segmentSpeech, pauseForBoundary } from "@/lib/voice/speech-text/segment";
export { normalizeArabicSpeech } from "@/lib/voice/speech-text/ar/normalize";
export { normalizeEnglishSpeech } from "@/lib/voice/speech-text/en/normalize";
export {
  NON_OPERATIONAL_PRONUNCIATION_NOTE,
  ARABIC_NUMERAL_LIMITATION,
  AR_PROTECTED_COLLOQUIAL,
} from "@/lib/voice/speech-text/lexicon-ar";

/**
 * Derive the speech representation for a patient reply.
 *
 * @param displayText the authoritative reply exactly as persisted/displayed
 * @param locale session speech locale (never sniffed from the text)
 */
export function prepareSpeech(
  displayText: string,
  locale: SessionSpeechLocale | string,
  options: SegmentOptions = {},
): PreparedSpeech {
  const speechLocale: SessionSpeechLocale = normalizeSpeechLocale(locale);
  const source = displayText ?? "";

  const normalized = normalizeSpeechText(source, speechLocale);
  const segments = segmentSpeech(normalized.text, speechLocale, options);

  return {
    locale: speechLocale,
    speechText: normalized.text,
    segments,
    normalized: normalized.changed,
  };
}
