/**
 * Conversational segmentation + pause budgeting.
 *
 * Goal: stop synthesizing a whole patient turn as one uninterrupted block,
 * without chopping it into a stack of tiny audio files that sound theatrical.
 *
 * Rules:
 * - Split at sentence terminals first.
 * - Only split a sentence at clause boundaries when it exceeds `maxChars`.
 *   A comma alone never forces a split.
 * - Segments below `minChars` are merged into a neighbour, so short fillers
 *   ("يعني", "I mean") never become their own segment.
 * - The final segment always has a zero pause.
 */

import type {
  SegmentBoundary,
  SegmentOptions,
  SpeechSegment,
} from "@/lib/voice/speech-text/types";
import type { SessionSpeechLocale } from "@/lib/voice/config";

const DEFAULTS: Required<SegmentOptions> = {
  maxChars: 90,
  minChars: 12,
  maxSegments: 8,
  pauseScale: 1,
};

/** Base pause (ms) inserted after a segment, before scaling and clamping. */
const BASE_PAUSE_MS: Record<SegmentBoundary, number> = {
  sentence: 380,
  question: 420,
  exclamation: 320,
  clause: 180,
  length: 140,
  final: 0,
};

const MAX_PAUSE_MS = 600;

/** Ellipsis is a hesitation cue, not a sentence terminal — protect it. */
const ELLIPSIS_TOKEN = "\uE000";
/** A decimal point is not a sentence terminal either — "2.5" must survive. */
const DECIMAL_TOKEN = "\uE001";

/**
 * Clause-opening discourse markers. A split happens BEFORE the marker so it
 * begins the next segment, which is how these actually land in speech.
 */
const CLAUSE_MARKERS: Record<SessionSpeechLocale, string[]> = {
  ar: [
    "ولما",
    "وبعدين",
    "وبعد",
    "بس",
    "لأنه",
    "لأن",
    "عشان",
    "بصراحة",
    "المهم",
    "وكمان",
  ],
  en: ["and then", "but", "because", "so that", "although", "even though"],
};

function protectTerminals(text: string): string {
  return text
    .replace(/\.{3}/g, ELLIPSIS_TOKEN)
    .replace(/(?<=\d)\.(?=\d)/g, DECIMAL_TOKEN);
}

function restoreTerminals(text: string): string {
  return text
    .split(ELLIPSIS_TOKEN)
    .join("...")
    .split(DECIMAL_TOKEN)
    .join(".");
}

function boundaryForTerminal(terminal: string): SegmentBoundary {
  if (terminal === "?") return "question";
  if (terminal === "!") return "exclamation";
  return "sentence";
}

type RawSegment = { text: string; boundary: SegmentBoundary };

/** Split on sentence terminals, keeping the terminal attached. */
function splitSentences(text: string): RawSegment[] {
  const protectedText = protectTerminals(text);
  const out: RawSegment[] = [];
  const re = /([^.!?]+)([.!?]+)?/g;

  for (const match of protectedText.matchAll(re)) {
    const body = match[1] ?? "";
    const terminal = match[2] ?? "";
    const piece = `${body}${terminal}`.trim();
    if (!piece) continue;
    out.push({
      text: restoreTerminals(piece),
      boundary: terminal
        ? boundaryForTerminal(terminal[terminal.length - 1] ?? ".")
        : "final",
    });
  }

  return out;
}

/** Split one over-long sentence at clause boundaries. */
function splitClauses(
  segment: RawSegment,
  locale: SessionSpeechLocale,
  maxChars: number,
): RawSegment[] {
  if (segment.text.length <= maxChars) return [segment];

  // Prefer explicit punctuation boundaries inside the sentence.
  const byPunctuation = segment.text
    .split(/(?<=[,;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let pieces =
    byPunctuation.length > 1
      ? byPunctuation
      : splitAtMarkers(segment.text, locale);

  if (pieces.length <= 1) {
    pieces = splitAtWordBudget(segment.text, maxChars);
    return pieces.map((text, i) => ({
      text,
      boundary: i === pieces.length - 1 ? segment.boundary : "length",
    }));
  }

  return pieces.map((text, i) => ({
    text,
    boundary: i === pieces.length - 1 ? segment.boundary : "clause",
  }));
}

function splitAtMarkers(
  text: string,
  locale: SessionSpeechLocale,
): string[] {
  const markers = CLAUSE_MARKERS[locale];
  const boundary = "[^\\p{L}\\p{N}]";
  for (const marker of markers) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\s+(?=${escaped}(?:${boundary}|$))`, "iu");
    if (re.test(text)) {
      const parts = text
        .split(re)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1) return parts;
    }
  }
  return [text];
}

/** Last resort — break on word boundaries near the budget. */
function splitAtWordBudget(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [text];
}

/** Merge sub-minimum segments into a neighbour so no segment is a fragment. */
function mergeShortSegments(
  segments: RawSegment[],
  minChars: number,
): RawSegment[] {
  if (segments.length <= 1) return segments;
  const out: RawSegment[] = [];

  for (const segment of segments) {
    const previous = out[out.length - 1];
    if (previous && segment.text.length < minChars) {
      previous.text = `${previous.text} ${segment.text}`.trim();
      previous.boundary = segment.boundary;
      continue;
    }
    out.push({ ...segment });
  }

  // A short leading segment can survive the pass above — fold it forwards.
  if (out.length > 1 && out[0]!.text.length < minChars) {
    const [first, second, ...rest] = out;
    return [
      { text: `${first!.text} ${second!.text}`.trim(), boundary: second!.boundary },
      ...rest,
    ];
  }

  return out;
}

function capSegments(
  segments: RawSegment[],
  maxSegments: number,
): RawSegment[] {
  if (segments.length <= maxSegments) return segments;
  const head = segments.slice(0, maxSegments - 1);
  const tail = segments.slice(maxSegments - 1);
  head.push({
    text: tail.map((s) => s.text).join(" ").trim(),
    boundary: tail[tail.length - 1]!.boundary,
  });
  return head;
}

export function pauseForBoundary(
  boundary: SegmentBoundary,
  pauseScale = 1,
): number {
  const base = BASE_PAUSE_MS[boundary];
  const scaled = Math.round(base * pauseScale);
  return Math.max(0, Math.min(MAX_PAUSE_MS, scaled));
}

/**
 * Segment prepared speech text into conversational units with pause budgets.
 * Input is expected to be already normalized for the locale.
 */
export function segmentSpeech(
  text: string,
  locale: SessionSpeechLocale,
  options: SegmentOptions = {},
): SpeechSegment[] {
  const opts = { ...DEFAULTS, ...options };
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = splitSentences(trimmed);
  const expanded = sentences.flatMap((s) =>
    splitClauses(s, locale, opts.maxChars),
  );
  const merged = mergeShortSegments(expanded, opts.minChars);
  const capped = capSegments(merged, opts.maxSegments);

  return capped.map((segment, index) => {
    const isLast = index === capped.length - 1;
    return {
      text: segment.text,
      boundary: isLast ? "final" : segment.boundary,
      pauseAfterMs: isLast ? 0 : pauseForBoundary(segment.boundary, opts.pauseScale),
    };
  });
}
