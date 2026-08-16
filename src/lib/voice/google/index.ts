export { googleTtsService } from "@/lib/voice/google/service";
export {
  BENCHMARK_GOOGLE_VOICE_AR,
  BENCHMARK_GOOGLE_VOICE_EN,
  DEFAULT_GOOGLE_LANGUAGE_AR,
  DEFAULT_GOOGLE_LANGUAGE_EN,
  GOOGLE_TTS_ENDPOINT,
  GOOGLE_TTS_MAX_INPUT_BYTES,
  googleCustomPronunciationEnabled,
  googleDefaultVoice,
  googleLanguageCode,
  googleModelIdFromVoice,
  googlePauseControlEnabled,
  googleSpeakingRateEnabled,
  googleTtsTimeoutMs,
  hasGoogleTts,
  resolveGoogleVoiceName,
} from "@/lib/voice/google/config";
export {
  CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES,
  googleSupports,
  googleVoiceFamily,
  KNOWN_DIVERGENCES,
  PAUSE_CONTROL_EXCLUDED_LOCALES,
  PITCH_SEMITONE_RANGE,
  SPEAKING_RATE_RANGE,
  type GoogleFeature,
  type GoogleVoiceFamily,
} from "@/lib/voice/google/capabilities";
export {
  googleProsodyFromClinicalVoice,
  type GoogleProsodyResult,
} from "@/lib/voice/google/prosody";
export {
  buildPauseMarkup,
  escapeGoogleMarkup,
  pauseTagForScale,
  type GooglePauseTag,
  type PauseMarkupResult,
} from "@/lib/voice/google/markup";
export {
  BENCHMARK_PRONUNCIATIONS,
  customPronunciationsFor,
  isValidPronunciationEntry,
  localeSupportsCustomPronunciation,
  MAX_CUSTOM_PRONUNCIATIONS_PER_REQUEST,
  type PronunciationCategory,
  type PronunciationEntry,
} from "@/lib/voice/google/pronunciation";
export {
  ARABIC_FEMALE_BENCHMARK_VOICES,
  ARABIC_MALE_BENCHMARK_VOICES,
  BENCHMARK_VOICES,
  benchmarkVoicesForLocale,
  ENGLISH_BENCHMARK_VOICES,
  findBenchmarkVoice,
  type BenchmarkVoice,
} from "@/lib/voice/google/voices";
