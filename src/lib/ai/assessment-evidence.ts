/**
 * Turn-cited evidence for examiner scores.
 *
 * The examiner sees numbered turns and cites `{turn, quote}` for each score.
 * A quote is kept only when it is really in the transcript: copied word for
 * word (case, spacing, punctuation and Arabic diacritics aside) from a
 * therapist or patient turn. A quote found in a different turn than the one
 * cited is re-pointed to the turn it came from; anything else is dropped, so
 * a report never shows an invented quote.
 */

import type { TurnEvidence, UnscoredEntry } from "@/lib/types";

export const MAX_EVIDENCE_PER_ITEM = 3;
export const MAX_QUOTE_CHARS = 300;
/** Shorter than this (after normalising) is too thin to count as a quote. */
const MIN_QUOTE_CHARS = 4;

export type EvidenceTurn = {
  /** 1-based number shown to the examiner. */
  n: number;
  speaker: "therapist" | "patient" | "system";
  content: string;
};

/** Text reduced for matching: no case, diacritics, punctuation or extra spaces. */
export function normalizeForQuoteMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    // Arabic short vowels, shadda, sukun, superscript alef, tatweel.
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Quote split on ellipses; each part must appear in order in the turn. */
function quoteParts(quote: string): string[] {
  return quote
    .split(/\.{3,}|…/)
    .map(normalizeForQuoteMatch)
    .filter(Boolean);
}

function containsInOrder(haystack: string, parts: string[]): boolean {
  // Match on word boundaries so "plan" does not match inside "explain".
  const padded = ` ${haystack} `;
  let from = 0;
  for (const part of parts) {
    const at = padded.indexOf(` ${part} `, from);
    if (at < 0) return false;
    from = at + part.length + 1;
  }
  return true;
}

function readCitation(raw: unknown): { turn: number | null; quote: string } | null {
  if (typeof raw === "string") return { turn: null, quote: raw };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const quote = typeof r.quote === "string" ? r.quote : typeof r.text === "string" ? r.text : null;
  if (quote === null) return null;
  const rawTurn = r.turn ?? r.n ?? r.turn_number;
  const turn =
    typeof rawTurn === "number"
      ? rawTurn
      : typeof rawTurn === "string" && /^\d+$/.test(rawTurn.trim())
        ? Number(rawTurn.trim())
        : null;
  return { turn: turn !== null && Number.isInteger(turn) ? turn : null, quote };
}

function cleanQuote(quote: string): string {
  const text = quote
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”«»‹›]+|["'“”«»‹›]+$/g, "")
    .trim();
  return text.length > MAX_QUOTE_CHARS
    ? `${text.slice(0, MAX_QUOTE_CHARS - 1).trimEnd()}…`
    : text;
}

/**
 * Keep only citations whose quote is in a therapist or patient turn.
 * Returns at most MAX_EVIDENCE_PER_ITEM, in the order the examiner gave them.
 */
export function verifyEvidence(raw: unknown, turns: EvidenceTurn[]): TurnEvidence[] {
  if (!Array.isArray(raw)) return [];
  const spoken = turns
    .filter((t) => t.speaker !== "system")
    .map((t) => ({ ...t, norm: normalizeForQuoteMatch(t.content) }));
  const out: TurnEvidence[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (out.length >= MAX_EVIDENCE_PER_ITEM) break;
    const citation = readCitation(entry);
    if (!citation) continue;
    const quote = cleanQuote(citation.quote);
    const parts = quoteParts(quote);
    if (parts.join(" ").length < MIN_QUOTE_CHARS) continue;

    const cited = spoken.find((t) => t.n === citation.turn);
    const match =
      cited && containsInOrder(cited.norm, parts)
        ? cited
        : spoken.find((t) => containsInOrder(t.norm, parts));
    if (!match) continue;

    const key = `${match.n}\n${parts.join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      turn: match.n,
      speaker: match.speaker as TurnEvidence["speaker"],
      quote,
    });
  }
  return out;
}

/** Read stored evidence back from report JSON (shape-checked, no re-verification). */
export function storedEvidence(raw: unknown): TurnEvidence[] {
  if (!Array.isArray(raw)) return [];
  const out: TurnEvidence[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (
      typeof r.turn === "number" &&
      (r.speaker === "therapist" || r.speaker === "patient") &&
      typeof r.quote === "string" &&
      r.quote.trim()
    ) {
      out.push({ turn: r.turn, speaker: r.speaker, quote: r.quote });
    }
    if (out.length >= MAX_EVIDENCE_PER_ITEM) break;
  }
  return out;
}

/**
 * True when items the examiner could not score are left out of the overall
 * (at least half the rubric weight was scored). Otherwise they count as zero,
 * so a session too thin to judge cannot pass on one or two items.
 */
export function unscoredLeftOutOfOverall(
  scored: { weight: number }[],
  unscored: { weight: number }[],
): boolean {
  const scoredWeight = scored.reduce((s, i) => s + i.weight, 0);
  const unscoredWeight = unscored.reduce((s, i) => s + i.weight, 0);
  return scoredWeight >= unscoredWeight;
}

/** Read stored "cannot score" items back from report JSON (shape-checked). */
export function storedUnscored(raw: unknown): UnscoredEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: UnscoredEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    out.push({
      id: r.id,
      label: typeof r.label === "string" ? r.label : r.id,
      max: typeof r.max === "number" ? r.max : 5,
      weight: typeof r.weight === "number" ? r.weight : 0,
      reason: typeof r.reason === "string" ? r.reason : "",
    });
  }
  return out;
}
