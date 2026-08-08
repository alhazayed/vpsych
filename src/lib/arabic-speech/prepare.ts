/**
 * Arabic Speech Preparation Engine — main entry.
 *
 * Pipeline (deterministic, meaning-preserving):
 *   sanitize → abbreviations → numbers → clinical tashkeel → name tashkeel
 *
 * Skips work when the input has no Arabic letters and no expandable Latin
 * clinical abbreviations (pure English turns stay untouched).
 */

import { expandClinicalAbbreviations } from "./abbreviations";
import { containsArabicScript } from "./detect";
import {
  applyClinicalTashkeel,
  applyNameTashkeel,
} from "./medical-terms";
import { expandArabicNumbers } from "./numbers";
import { sanitizeForTts } from "./sanitize";
import type {
  ArabicSpeechPrepOptions,
  ArabicSpeechPrepResult,
  ArabicSpeechPrepTransform,
} from "./types";

const DEFAULTS: Required<
  Pick<
    ArabicSpeechPrepOptions,
    | "expandAbbreviations"
    | "expandNumbers"
    | "applyTashkeel"
    | "sanitizeMarkup"
  >
> = {
  expandAbbreviations: true,
  expandNumbers: true,
  applyTashkeel: true,
  sanitizeMarkup: true,
};

/** Latin clinical abbrev tokens that justify running ASPE without Arabic script. */
const LATIN_CLINICAL_TOKEN =
  /\b(?:ADHD|PTSD|OCD|MDD|GAD|BPD|ASD|CBT|DBT|EMDR|SSRIs?|SNRIs?|DSM(?:-5(?:-TR)?)?|ICD-1[01]|IQ|PHQ-?9|GAD-?7)\b/i;

function shouldPrepare(text: string): boolean {
  return containsArabicScript(text) || LATIN_CLINICAL_TOKEN.test(text);
}

function record(
  applied: ArabicSpeechPrepTransform[],
  stage: ArabicSpeechPrepTransform,
  before: string,
  after: string,
): string {
  if (after !== before) applied.push(stage);
  return after;
}

/**
 * Prepare Arabic (or mixed) dialogue for Arabic-capable TTS.
 * Does not rewrite clinical meaning, dialect, or emotional tone.
 */
export function prepareArabicSpeech(
  input: string,
  options: ArabicSpeechPrepOptions = {},
): ArabicSpeechPrepResult {
  const raw = typeof input === "string" ? input : "";
  if (!raw.trim()) {
    return { text: raw, changed: false, applied: [] };
  }

  if (!shouldPrepare(raw)) {
    return { text: raw, changed: false, applied: [] };
  }

  const opts = { ...DEFAULTS, ...options };
  const applied: ArabicSpeechPrepTransform[] = [];
  let text = raw;

  // dialect is accepted intentionally and unused — preserves Levantine as authored.
  void opts.dialect;

  if (opts.sanitizeMarkup) {
    text = record(applied, "sanitize", text, sanitizeForTts(text));
  }
  if (opts.expandAbbreviations) {
    text = record(
      applied,
      "abbreviations",
      text,
      expandClinicalAbbreviations(text),
    );
  }
  if (opts.expandNumbers) {
    text = record(applied, "numbers", text, expandArabicNumbers(text));
  }
  if (opts.applyTashkeel) {
    text = record(applied, "tashkeel", text, applyClinicalTashkeel(text));
    text = record(applied, "names", text, applyNameTashkeel(text));
  }

  // Collapse accidental double spaces from expansions; keep newlines / ellipsis.
  const normalized = text.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([,.!?…،؟])/g, "$1");

  return {
    text: normalized,
    changed: normalized !== raw,
    applied,
  };
}

/** Convenience: speech-ready string only (TTS route / ElevenLabs). */
export function prepareArabicSpeechText(
  input: string,
  options?: ArabicSpeechPrepOptions,
): string {
  return prepareArabicSpeech(input, options).text;
}
