/**
 * Arabic Speech Preparation Engine — main entry.
 *
 * For every Arabic dialogue:
 *   1–6  Identify ambiguities, medical terms, names, abbreviations,
 *        numbers, and TTS mispronunciation risks
 *   7    Apply minimal pronunciation corrections
 *   8    Preserve original clinical meaning
 *   9    Output speech-ready Arabic text
 *
 * Skips work when the input has no Arabic letters and no expandable Latin
 * clinical abbreviations (pure English turns stay untouched).
 */

import { analyzeArabicSpeech, applyFindings } from "./analyze";
import { containsArabicScript } from "./detect";
import { sanitizeForTts } from "./sanitize";
import type {
  ArabicSpeechAnalysis,
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
    | "includeAnalysis"
  >
> = {
  expandAbbreviations: true,
  expandNumbers: true,
  applyTashkeel: true,
  sanitizeMarkup: true,
  includeAnalysis: true,
};

/** Latin clinical abbrev tokens that justify running ASPE without Arabic script. */
const LATIN_CLINICAL_TOKEN =
  /\b(?:ADHD|PTSD|OCD|MDD|GAD|BPD|ASD|CBT|DBT|EMDR|SSRIs?|SNRIs?|DSM(?:-5(?:-TR)?)?|ICD-1[01]|IQ|PHQ-?9|GAD-?7)\b/i;

function shouldPrepare(text: string): boolean {
  return containsArabicScript(text) || LATIN_CLINICAL_TOKEN.test(text);
}

function emptyAnalysis(): ArabicSpeechAnalysis {
  return {
    ambiguities: [],
    medicalTerms: [],
    names: [],
    abbreviations: [],
    numbers: [],
    ttsRisks: [],
    corrections: [],
  };
}

function filterCorrections(
  analysis: ArabicSpeechAnalysis,
  opts: typeof DEFAULTS,
): ArabicSpeechAnalysis {
  const allow = (kind: string) => {
    if (kind === "abbreviation") return opts.expandAbbreviations;
    if (kind === "number") return opts.expandNumbers;
    if (kind === "medical" || kind === "name" || kind === "ambiguity") {
      return opts.applyTashkeel;
    }
    return true;
  };

  const corrections = analysis.corrections.filter((c) => allow(c.kind));
  return { ...analysis, corrections };
}

/**
 * Prepare Arabic (or mixed) dialogue for Arabic-capable TTS.
 * Identify → minimal correct → speech-ready text. Never rewrites meaning.
 */
export function prepareArabicSpeech(
  input: string,
  options: ArabicSpeechPrepOptions = {},
): ArabicSpeechPrepResult {
  const raw = typeof input === "string" ? input : "";
  const opts = { ...DEFAULTS, ...options };
  // dialect accepted for CVP passthrough; never used to rewrite dialect.
  void opts.dialect;

  if (!raw.trim()) {
    return {
      text: raw,
      changed: false,
      applied: [],
      analysis: opts.includeAnalysis ? emptyAnalysis() : undefined,
    };
  }

  if (!shouldPrepare(raw)) {
    return {
      text: raw,
      changed: false,
      applied: [],
      analysis: opts.includeAnalysis ? emptyAnalysis() : undefined,
    };
  }

  const applied: ArabicSpeechPrepTransform[] = [];
  let text = raw;

  if (opts.sanitizeMarkup) {
    const cleaned = sanitizeForTts(text);
    if (cleaned !== text) {
      applied.push("sanitize");
      text = cleaned;
    }
  }

  // Steps 1–6: identify.
  const analysis = filterCorrections(
    analyzeArabicSpeech(text, {
      speechNameOverrides: opts.speechNameOverrides,
    }),
    opts,
  );
  applied.push("identify");

  // Steps 7–8: minimal pronunciation corrections; meaning preserved.
  const corrected = applyFindings(text, analysis.corrections);
  if (corrected !== text) {
    applied.push("correct");
    // Record which finding kinds fired (for telemetry parity with prior stages).
    const kinds = new Set(analysis.corrections.map((c) => c.kind));
    if (kinds.has("abbreviation")) applied.push("abbreviations");
    if (kinds.has("number")) applied.push("numbers");
    if (kinds.has("medical")) applied.push("tashkeel");
    if (kinds.has("name")) applied.push("names");
    text = corrected;
  }

  // Step 9: speech-ready text (normalize accidental spacing only).
  const normalized = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?…،؟])/g, "$1");

  return {
    text: normalized,
    changed: normalized !== raw,
    applied,
    analysis: opts.includeAnalysis ? analysis : undefined,
  };
}

/** Convenience: speech-ready string only (TTS route / ElevenLabs). */
export function prepareArabicSpeechText(
  input: string,
  options?: ArabicSpeechPrepOptions,
): string {
  return prepareArabicSpeech(input, options).text;
}
