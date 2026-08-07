/**
 * Multilingual Engine — EN / AR / mixed session media helpers.
 * Avatar personalities remain natively authored; this only detects/switches
 * speech locale and transcript directionality.
 */

import type {
  MultilingualSessionState,
  RealtimeSpeechLocale,
} from "@/lib/realtime/types";

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const LATIN_RE = /[A-Za-z]/;

export function detectSpeechLocale(text: string): RealtimeSpeechLocale {
  const sample = text.trim();
  if (!sample) return "en";
  // Locale / BCP-47 tags (en, ar, ar-JO) — not utterance text.
  if (/^(ar)([-_]|$)/i.test(sample) && sample.length <= 12) return "ar";
  if (/^(en)([-_]|$)/i.test(sample) && sample.length <= 12) return "en";
  if (/^mixed$/i.test(sample)) return "mixed";
  const ar = ARABIC_RE.test(sample);
  const la = LATIN_RE.test(sample);
  if (ar && la) return "mixed";
  if (ar) return "ar";
  return "en";
}

export function isRtlLocale(locale: RealtimeSpeechLocale | string): boolean {
  const v = locale.toLowerCase();
  return v === "ar" || v.startsWith("ar");
}

export function createMultilingualSession(
  primary: RealtimeSpeechLocale = "en",
): MultilingualSessionState {
  return {
    primary,
    detected: primary,
    runtimeSwitchAllowed: true,
    rtl: isRtlLocale(primary),
    bidirectionalTranscript: primary === "mixed" || primary === "ar",
    lastSwitchAt: null,
  };
}

export function applyRuntimeLanguageSwitch(
  state: MultilingualSessionState,
  next: RealtimeSpeechLocale,
): MultilingualSessionState {
  if (!state.runtimeSwitchAllowed) return state;
  if (next === state.primary && next === state.detected) return state;
  return {
    ...state,
    primary: next === "mixed" ? state.primary : next,
    detected: next,
    rtl: isRtlLocale(next === "mixed" ? state.primary : next),
    bidirectionalTranscript: next === "mixed" || next === "ar" || state.primary === "ar",
    lastSwitchAt: new Date().toISOString(),
  };
}

export function observeUtterance(
  state: MultilingualSessionState,
  text: string,
): MultilingualSessionState {
  const detected = detectSpeechLocale(text);
  if (detected === state.detected) return state;
  return applyRuntimeLanguageSwitch(state, detected);
}

export type BidirectionalTranscriptLine = {
  role: "user" | "assistant" | "system";
  text: string;
  locale: RealtimeSpeechLocale;
  dir: "ltr" | "rtl";
};

export function toBidirectionalLine(
  role: BidirectionalTranscriptLine["role"],
  text: string,
): BidirectionalTranscriptLine {
  const locale = detectSpeechLocale(text);
  return {
    role,
    text,
    locale,
    dir: isRtlLocale(locale) ? "rtl" : "ltr",
  };
}

/** Prefer STT/TTS locale (en|ar) from mixed detection + session primary. */
export function speechLocaleForProviders(
  state: MultilingualSessionState,
): "en" | "ar" {
  if (state.detected === "ar") return "ar";
  if (state.detected === "en") return "en";
  return state.primary === "ar" ? "ar" : "en";
}
