/**
 * Identify pronunciation-sensitive spans in Arabic (or mixed) dialogue.
 *
 * Steps 1–6 of ASPE:
 *   1. pronunciation ambiguity
 *   2. medical terms
 *   3. names
 *   4. abbreviations
 *   5. numbers
 *   6. TTS mispronunciation risks
 *
 * Corrections are suggested only when orthography must change for speech;
 * clinical meaning is never altered.
 */

import { CLINICAL_ABBREVIATION_EXPANSIONS } from "./abbreviations";
import { hasTashkeel, stripTashkeel } from "./detect";
import {
  CLINICAL_TASHKEEL_LEXICON,
  NAME_TASHKEEL_LEXICON,
} from "./medical-terms";
import { findExpandableNumberMatches } from "./numbers";
import type {
  ArabicSpeechAnalysis,
  ArabicSpeechFinding,
  ArabicSpeechFindingKind,
} from "./types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Scan lexicon phrases (longest first). Optional clitics و/ف/ب/ك/ل are kept
 * on the surface but the guided form replaces only the lexicon key.
 */
function findLexiconFindings(
  text: string,
  lexicon: ReadonlyArray<readonly [string, string]>,
  kind: ArabicSpeechFindingKind,
): ArabicSpeechFinding[] {
  const found: ArabicSpeechFinding[] = [];
  const claimed: Array<{ start: number; end: number }> = [];

  for (const [raw, guided] of lexicon) {
    const key = stripTashkeel(raw);
    const re = new RegExp(
      `(?<![\\u0600-\\u06FF])([وفبكل]?)(${escapeRegExp(key)})(?![\\u0600-\\u06FF])`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const clitic = m[1] ?? "";
      const word = m[2] ?? "";
      const start = m.index;
      const end = start + m[0].length;
      const span = { start, end };
      if (claimed.some((c) => overlaps(c, span))) continue;

      const alreadyGuided = hasTashkeel(word);
      const suggested = alreadyGuided
        ? undefined
        : `${clitic}${guided}`;
      const surface = m[0];

      found.push({
        kind,
        surface,
        start,
        end,
        suggested: suggested && suggested !== surface ? suggested : undefined,
        reason:
          kind === "medical"
            ? "clinical term — selective professional pronunciation"
            : kind === "name"
              ? "name — preserve intended pronunciation"
              : "lexicon match",
      });
      claimed.push(span);
    }
  }
  return found;
}

function findAbbreviationFindings(text: string): ArabicSpeechFinding[] {
  const byUpper = new Map(
    CLINICAL_ABBREVIATION_EXPANSIONS.map(([k, v]) => [k.toUpperCase(), v]),
  );
  const found: ArabicSpeechFinding[] = [];
  const re = /\b([A-Za-z][A-Za-z0-9-]{1,12})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const surface = m[1]!;
    const expansion = byUpper.get(surface.toUpperCase());
    if (!expansion) continue;
    found.push({
      kind: "abbreviation",
      surface,
      start: m.index,
      end: m.index + surface.length,
      suggested: expansion,
      reason: "Latin clinical abbreviation — expand for Arabic TTS",
    });
  }
  return found;
}

function findNumberFindings(text: string): ArabicSpeechFinding[] {
  return findExpandableNumberMatches(text).map((hit) => ({
    kind: "number" as const,
    surface: hit.surface,
    start: hit.start,
    end: hit.end,
    suggested: hit.spoken,
    reason: "digit + unit — speak as Arabic words",
  }));
}

/**
 * Build the six identification buckets, then a non-overlapping correction list.
 * Ambiguity ∪ TTS-risk are derived from medical/name spans that still need guidance.
 */
export function analyzeArabicSpeech(input: string): ArabicSpeechAnalysis {
  const text = typeof input === "string" ? input : "";
  if (!text) {
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

  const medicalTerms = findLexiconFindings(
    text,
    CLINICAL_TASHKEEL_LEXICON,
    "medical",
  );
  const names = findLexiconFindings(text, NAME_TASHKEEL_LEXICON, "name");
  const abbreviations = findAbbreviationFindings(text);
  const numbers = findNumberFindings(text);

  const ambiguities: ArabicSpeechFinding[] = [
    ...medicalTerms
      .filter((f) => f.suggested)
      .map((f) => ({
        ...f,
        kind: "ambiguity" as const,
        reason: "multiple pronunciations — prefer clinical Arabic",
      })),
    ...names
      .filter((f) => f.suggested)
      .map((f) => ({
        ...f,
        kind: "ambiguity" as const,
        reason: "name vowelization ambiguity",
      })),
  ];

  const ttsRisks: ArabicSpeechFinding[] = [
    ...ambiguities.map((f) => ({
      ...f,
      kind: "tts_risk" as const,
      reason: "likely TTS mispronunciation without guidance",
    })),
    ...abbreviations.map((f) => ({
      ...f,
      kind: "tts_risk" as const,
      reason: "abbreviation may be spelled letter-by-letter",
    })),
    ...numbers.map((f) => ({
      ...f,
      kind: "tts_risk" as const,
      reason: "digit run may be read digit-by-digit",
    })),
  ];

  // Minimal corrections: actionable suggestions, longest spans first, no overlap.
  const candidates = [
    ...medicalTerms,
    ...names,
    ...abbreviations,
    ...numbers,
  ]
    .filter((f) => f.suggested && f.suggested !== f.surface)
    .sort(
      (a, b) =>
        b.end - b.start - (a.end - a.start) || a.start - b.start,
    );

  const corrections: ArabicSpeechFinding[] = [];
  for (const c of candidates) {
    if (corrections.some((x) => overlaps(x, c))) continue;
    corrections.push(c);
  }
  corrections.sort((a, b) => b.start - a.start); // apply from end

  return {
    ambiguities,
    medicalTerms,
    names,
    abbreviations,
    numbers,
    ttsRisks,
    corrections,
  };
}

/**
 * Apply non-overlapping suggested corrections (already sorted end→start).
 * Meaning-preserving orthography only.
 */
export function applyFindings(
  text: string,
  corrections: readonly ArabicSpeechFinding[],
): string {
  let out = text;
  const ordered = [...corrections].sort((a, b) => b.start - a.start);
  for (const c of ordered) {
    if (!c.suggested) continue;
    if (out.slice(c.start, c.end) !== c.surface) continue; // stale span
    out = out.slice(0, c.start) + c.suggested + out.slice(c.end);
  }
  return out;
}
