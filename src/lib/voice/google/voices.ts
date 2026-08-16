/**
 * Chirp 3 HD benchmark voice catalogue.
 *
 * BENCHMARK CANDIDATES ONLY. Nothing here is registered in the database, is
 * assigned to an avatar, or is active globally. Voice casting is a clinical
 * decision that happens after the Arabic quality benchmark, not before it.
 *
 * `Kore` remains the temporary default purely so the transport has a stable
 * baseline to compare against; it is explicitly not the intended production
 * voice.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";

export type BenchmarkVoiceGender = "female" | "male";

export type BenchmarkVoice = {
  /** Google voice name, e.g. `ar-XA-Chirp3-HD-Kore`. */
  name: string;
  locale: SessionSpeechLocale;
  languageCode: string;
  gender: BenchmarkVoiceGender;
};

function arabic(
  voice: string,
  gender: BenchmarkVoiceGender,
): BenchmarkVoice {
  return {
    name: `ar-XA-Chirp3-HD-${voice}`,
    locale: "ar",
    languageCode: "ar-XA",
    gender,
  };
}

/** Arabic female candidates. */
export const ARABIC_FEMALE_BENCHMARK_VOICES: readonly BenchmarkVoice[] = [
  arabic("Kore", "female"),
  arabic("Aoede", "female"),
  arabic("Achernar", "female"),
  arabic("Autonoe", "female"),
  arabic("Leda", "female"),
] as const;

/** Arabic male candidates. */
export const ARABIC_MALE_BENCHMARK_VOICES: readonly BenchmarkVoice[] = [
  arabic("Achird", "male"),
  arabic("Charon", "male"),
  arabic("Fenrir", "male"),
  arabic("Orus", "male"),
  arabic("Rasalgethi", "male"),
] as const;

/** English comparison voices — not a casting shortlist, just a control group. */
export const ENGLISH_BENCHMARK_VOICES: readonly BenchmarkVoice[] = [
  { name: "en-US-Chirp3-HD-Kore", locale: "en", languageCode: "en-US", gender: "female" },
  { name: "en-US-Chirp3-HD-Charon", locale: "en", languageCode: "en-US", gender: "male" },
] as const;

export const BENCHMARK_VOICES: readonly BenchmarkVoice[] = [
  ...ARABIC_FEMALE_BENCHMARK_VOICES,
  ...ARABIC_MALE_BENCHMARK_VOICES,
  ...ENGLISH_BENCHMARK_VOICES,
] as const;

export function benchmarkVoicesForLocale(
  locale: SessionSpeechLocale,
): BenchmarkVoice[] {
  return BENCHMARK_VOICES.filter((v) => v.locale === locale);
}

export function findBenchmarkVoice(name: string): BenchmarkVoice | null {
  return BENCHMARK_VOICES.find((v) => v.name === name) ?? null;
}
