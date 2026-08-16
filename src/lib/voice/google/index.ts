export { googleTtsService } from "@/lib/voice/google/service";
export {
  BENCHMARK_GOOGLE_VOICE_AR,
  BENCHMARK_GOOGLE_VOICE_EN,
  DEFAULT_GOOGLE_LANGUAGE_AR,
  DEFAULT_GOOGLE_LANGUAGE_EN,
  GOOGLE_TTS_ENDPOINT,
  GOOGLE_TTS_MAX_INPUT_BYTES,
  googleDefaultVoice,
  googleLanguageCode,
  googleModelIdFromVoice,
  googleTtsTimeoutMs,
  hasGoogleTts,
  resolveGoogleVoiceName,
} from "@/lib/voice/google/config";
export {
  googleProsodyFromClinicalVoice,
  googleVoiceCapabilities,
  type GoogleProsodyResult,
  type GoogleVoiceCapabilities,
} from "@/lib/voice/google/prosody";
