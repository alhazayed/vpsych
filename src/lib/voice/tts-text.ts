/**
 * Prepare patient reply text for ElevenLabs TTS.
 * Improves conversational rhythm without changing clinical meaning —
 * light pause / hesitation cues so delivery sounds like a real interview,
 * not a single flat paragraph.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";
import type { SpeechEnergy, SpeechPace } from "@/lib/voice/prosody";

const MAX_TTS_CHARS = 2500;

/**
 * Normalize whitespace and punctuation for more natural TTS pacing.
 * Safe for both English and Arabic patient turns.
 */
export function preparePatientSpeechForTts(
  text: string,
  options: {
    locale?: SessionSpeechLocale;
    pace?: SpeechPace | null;
    energy?: SpeechEnergy | null;
  } = {},
): string {
  let out = text.replace(/\s+/g, " ").trim();
  if (!out) return out;

  // Normalize ellipses / trailing thoughts into a pause-friendly form.
  out = out.replace(/\.{3,}/g, "…");
  out = out.replace(/\u2026+/g, "…");

  // Ensure sentence-final punctuation so the model inserts a breath.
  if (!/[.!?…۔؟]$/.test(out)) {
    out = `${out}.`;
  }

  // After clause commas that glue long clauses, prefer a brief pause marker
  // when the phenotype is slowed / low-energy (depression / negative symptoms).
  const slow =
    options.pace === "slow" ||
    options.energy === "low" ||
    options.pace === "measured";

  if (slow) {
    // "I guess, I don't know" → keep; lengthen pause after em-dashes / ellipses.
    out = out.replace(/\s*—\s*/g, " … ");
    out = out.replace(/\s*…\s*/g, " … ");
  }

  // Soft hesitation particles: ensure surrounding spaces for clearer prosody.
  out = out.replace(/\b(um|uh|erm|hmm)\b/gi, (m) => ` ${m.toLowerCase()} `);
  out = out.replace(/\s{2,}/g, " ").trim();

  if (out.length > MAX_TTS_CHARS) {
    out = `${out.slice(0, MAX_TTS_CHARS - 1).trim()}…`;
  }

  return out;
}
