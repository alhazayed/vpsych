/**
 * Voice QA instrumentation — DEVELOPMENT ONLY.
 *
 * Gated behind `NEXT_PUBLIC_VOICE_QA`. See `enabled.ts` for why.
 * Never import this barrel from a Route Handler or Server Component.
 */

export { isVoiceQaEnabled } from "@/lib/voice/qa/enabled";
export {
  dominantStage,
  formatLatency,
  formatLatencyReport,
  summarizeLatency,
} from "@/lib/voice/qa/latency";
export {
  countOccurrences,
  detectRepeatedPhrases,
  tracePhrase,
  traceRepeatedPhrases,
  type PhraseTrace,
} from "@/lib/voice/qa/phrase-trace";
export {
  createVoiceQaStore,
  voiceQaStore,
  VOICE_QA_MAX_TURNS,
  type VoiceQaStore,
} from "@/lib/voice/qa/store";
export {
  audioFileName,
  buildManifest,
  downloadAll,
  downloadManifest,
  downloadTurnAudio,
  type VoiceQaManifest,
} from "@/lib/voice/qa/export";
export type {
  VoiceQaLatency,
  VoiceQaMarks,
  VoiceQaOutcome,
  VoiceQaSegment,
  VoiceQaSink,
  VoiceQaStage,
  VoiceQaTurn,
} from "@/lib/voice/qa/types";
