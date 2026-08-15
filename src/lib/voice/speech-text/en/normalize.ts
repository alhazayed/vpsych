/**
 * English speech-text normalization.
 *
 * Intentionally close to identity. The audit found no demonstrated English
 * pronunciation problem, so this normalizer only removes artefacts that would
 * be read aloud literally (stage directions, invisible characters) and gives
 * punctuation consistent spacing.
 *
 * `en/normalize.test.ts` asserts that the English corpus round-trips
 * unchanged. Do not add transformations here without a demonstrated failure.
 */

import type { NormalizeResult } from "@/lib/voice/speech-text/types";

const INVISIBLES = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const ASTERISK_SPANS = /\*[^*\n]{1,80}\*/g;

export function normalizeEnglishSpeech(input: string): NormalizeResult {
  const original = input;

  const text = input
    .replace(INVISIBLES, "")
    .replace(ASTERISK_SPANS, " ")
    .replace(/…/g, "...")
    .replace(/\s*\.{3,}\s*/g, "... ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n+ */g, " ")
    .trim();

  return { text, changed: text !== original };
}
