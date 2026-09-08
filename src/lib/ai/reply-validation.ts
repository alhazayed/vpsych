/**
 * Patient reply gate — reject contentless output and replies that adopt a
 * clinical fact the therapist merely asserted, before persistence and TTS.
 *
 * At most ONE regeneration is the caller's responsibility; this module only
 * classifies text. It never rewrites a reply: a silently corrected patient
 * answer would be a fabricated clinical record.
 *
 * The fact checks are deliberately narrow string matching against authored
 * canonical facts plus conservative affirmation/denial patterns. They are not
 * a semantic parser, and every rule here errs toward passing: a false negative
 * costs one instruction-level miss, a false positive costs a wasted
 * regeneration on a correct answer.
 */

import {
  enforceableIn,
  type MedicationFact,
} from "@/lib/ai/medication-facts";

export type ReplyValidationReason =
  | "empty"
  | "punctuation_only"
  | "ellipsis_only"
  | "age_contradiction"
  | "medication_contradiction";

export type ReplyValidationResult =
  | { ok: true }
  | { ok: false; reason: ReplyValidationReason; detail?: string };

/** Authored facts for this session. Omit to run content checks only. */
export type CanonicalReplyFacts = {
  age?: number | null;
  medications?: MedicationFact[];
  /** Session locale — decides which medication forms are enforceable. */
  locale?: string | null;
  /**
   * The therapist turn this reply answers. Needed because the live failure was
   * anaphoric — "آه، باخده" ("yes, I take it") names no drug at all, and the
   * only place the drug appears is the therapist's own sentence. Without this,
   * the most common adoption shape is undetectable.
   */
  therapistMessage?: string | null;
};

const ARABIC_LETTER = /\p{Script=Arabic}/u;
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;
const CJK_LETTER = /\p{Script=Han}/u;
/** Digits that can stand alone as a valid short clinical answer ("35.", "٣."). */
const DIGIT = /[0-9\u0660-\u0669]/;

/**
 * Strip common stage-direction wrappers and normalize ellipsis variants.
 */
function normalizeForCheck(raw: string): string {
  return raw
    .replace(/\u2026/g, "…") // unicode ellipsis
    .replace(/\.{3,}/g, "…")
    .replace(/[()[\]{}*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLexicalContent(text: string): boolean {
  return (
    ARABIC_LETTER.test(text) ||
    LATIN_LETTER.test(text) ||
    CJK_LETTER.test(text) ||
    DIGIT.test(text)
  );
}

/**
 * True when the string is only punctuation / ellipsis / whitespace after trim.
 * Valid short answers like "آه.", "لا.", "مش كثير.", "يمكن." pass.
 */
export function isContentlessPatientReply(text: string): boolean {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return true;
  const normalized = normalizeForCheck(trimmed);
  if (!normalized) return true;
  if (!hasLexicalContent(normalized)) return true;
  // "يعني… …" has Arabic letters but is an authored-empty stall pattern:
  // letter(s) + only ellipsis/punctuation remainder with no other word.
  // Reject when the only letters form a single filler lemma then ellipsis.
  const withoutEllipsis = normalized.replace(/[….]+/g, " ").trim();
  if (!withoutEllipsis) return true;
  // Single filler word + ellipsis only (يعني… … / يعني…)
  if (/^(يعني|um+|uh+|erm+|hmm+)\s*$/iu.test(withoutEllipsis)) {
    return true;
  }
  return false;
}

/* ────────────────────────── fact-check helpers ────────────────────────── */

/** Arabic-Indic and Eastern Arabic-Indic digits → ASCII. */
function normalizeDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.codePointAt(0)!;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Lower-cased, digit-normalized, diacritic-stripped form for matching. */
function normalizeForFacts(text: string): string {
  return normalizeDigits(text.normalize("NFKC"))
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .toLowerCase();
}

/**
 * Denial / correction markers. Their presence anywhere in a short patient turn
 * is enough to read the turn as a correction rather than an adoption — the
 * required behaviour is "correct it and carry on", so a correction naturally
 * repeats the therapist's wrong value.
 */
const DENIAL =
  /(?<!\p{L})(?:لا|لأ|مش|مو|ليس|غلط|خطأ|ما(?=\s*(?:ب|عم|أخد|اخد))|not|no|never|don't|doesn't|didn't|isn't|wasn't)(?!\p{L})/iu;

/** Affirmation markers — "yes, 35" is the adoption shape. */
const AFFIRM =
  /(?<!\p{L})(?:آه|اه|أيوه|ايوه|نعم|صح|بالضبط|yes|yeah|right|correct|exactly)(?!\p{L})/iu;

/** Third-party attribution — the sister's medication stays the sister's. */
const FAMILY_ATTRIB =
  /(?:أخت|اخت|أخو|اخو|هبة|كيسي|casey|sister|sibling|brother|(?<!\p{L})(?:her|his|theirs)(?!\p{L}))/iu;

/** First-person PRESENT-tense taking. */
const SELF_CURRENT =
  /(باخد|بآخد|بتناول|عم\s*آخد|عم\s*باخد|آخده|باخده|بستعمل|\bi\s*(?:'|’)?\s*m\s+(?:on|taking)\b|\bi\s+take\b|\bi\s+am\s+(?:on|taking)\b)/i;

/** First-person PAST-tense taking / stopping. */
const SELF_PAST =
  /(أخدت|اخدت|كنت\s*(?:ب)?اخد|وقفت|بطلت|بطّلت|تركت|\bi\s+took\b|\bi\s+used\s+to\b|\bi\s+stopped\b|\bi\s+quit\b)/i;

/**
 * Age assertions the patient makes about themselves *now*.
 * Two shapes: an explicit claim, and a bare affirmed number — the latter is the
 * exact live failure ("آه، ٣٥.").
 */
const EXPLICIT_AGE = /(?:عمري|عمرى)\s*(?:هلأ|هلق|هسه|هسّه)?\s*(\d{1,3})|أنا\s*(\d{1,3})\s*سن|\bi\s*(?:'|’)?\s*a?m\s+(\d{1,3})\b/gi;

/** Past-age context — the case legitimately contains ages 12, 26, 27, 58. */
const PAST_AGE = /(كان|لما|وقت|بعمر|صار\s*لي|when\s+i\s+was|since\s+i\s+was|at\s+age|back\s+when)\s*$/i;

function contentTokenCount(text: string): number {
  return text.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean)
    .length;
}

/**
 * Age contradiction: the reply asserts an age other than the canonical one and
 * does not also carry the canonical age or a denial.
 *
 * "لا، مش ٣٥، عمري ٣٤."  → canonical present  → valid
 * "آه، ٣٥."               → affirmed, no 34    → INVALID
 */
export function detectAgeContradiction(
  text: string,
  canonicalAge?: number | null,
): number | null {
  if (typeof canonicalAge !== "number" || !Number.isFinite(canonicalAge)) {
    return null;
  }
  const norm = normalizeForFacts(text);
  const canonicalPresent = new RegExp(`\\b${canonicalAge}\\b`).test(norm);
  // A correction restates the right number, or explicitly denies. Either way
  // the wrong number appearing is expected and must not be punished.
  if (canonicalPresent || DENIAL.test(norm)) return null;

  const claimed: number[] = [];
  EXPLICIT_AGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPLICIT_AGE.exec(norm)) !== null) {
    const preceding = norm.slice(Math.max(0, m.index - 24), m.index).trim();
    if (PAST_AGE.test(preceding)) continue;
    const n = Number(m[1] ?? m[2] ?? m[3]);
    if (Number.isFinite(n)) claimed.push(n);
  }
  // Bare affirmed number: short turn, an affirmation, and a plausible age.
  if (AFFIRM.test(norm) && contentTokenCount(norm) <= 8) {
    for (const raw of norm.match(/\b\d{1,3}\b/g) ?? []) {
      claimed.push(Number(raw));
    }
  }
  for (const n of claimed) {
    if (n >= 10 && n <= 120 && n !== canonicalAge) return n;
  }
  return null;
}

function mentionsAgent(norm: string, fact: MedicationFact): boolean {
  return fact.agent_names.some((name) => {
    const n = normalizeForFacts(name);
    return n.length > 2 && norm.includes(n);
  });
}

/**
 * Spoken Arabic numerals, bounded to the values that actually occur as clinical
 * doses and durations in these cases. A closed lookup table, not a number
 * parser: medication names are spoken in English but the surrounding Arabic
 * stays Arabic, so "sertraline خمسين مليغرام" is expected speech and its dose
 * must not slip through unchecked.
 *
 * Ordered longest-first so "خمسة وعشرين" is read before "عشرين".
 */
const ARABIC_NUMERAL_WORDS: ReadonlyArray<readonly [string, number]> = [
  ["خمسة وعشرين", 25],
  ["خمسه وعشرين", 25],
  ["اثنعش", 12],
  ["اتنعش", 12],
  ["اثني عشر", 12],
  ["خمستعشر", 15],
  ["خمسة عشر", 15],
  ["ثلاثين", 30],
  ["تلاتين", 30],
  ["أربعين", 40],
  ["اربعين", 40],
  ["خمسين", 50],
  ["ستين", 60],
  ["سبعين", 70],
  ["ثمانين", 80],
  ["تمانين", 80],
  ["تسعين", 90],
  ["عشرين", 20],
  ["عشرة", 10],
  ["عشر", 10],
  ["خمسة", 5],
  ["خمس", 5],
  ["مئة", 100],
  ["مية", 100],
  ["ماية", 100],
  ["نصف", 0.5],
  ["نص", 0.5],
];

const DOSE_UNIT = "(?:mg|milligram|milligrams|ملغ|مليغرام|ملجم|ملليغرام)";
const DAY_UNIT = "(?:day|days|يوم|أيام|ايام)";

/** Digit and spoken-numeral values attached to a unit. */
function statedQuantities(norm: string, unit: string): number[] {
  const out: number[] = [];
  for (const m of norm.matchAll(
    new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*${unit}`, "g"),
  )) {
    out.push(Number(String(m[1]).replace(",", ".")));
  }
  for (const [word, value] of ARABIC_NUMERAL_WORDS) {
    // The numeral may sit either side of the unit in spoken Arabic.
    const near = new RegExp(`${word}\\s*${unit}|${unit}\\s*${word}`);
    if (near.test(norm)) out.push(value);
  }
  return out;
}

function statedDoses(norm: string): number[] {
  return statedQuantities(norm, DOSE_UNIT);
}

function statedDurations(norm: string): number[] {
  return statedQuantities(norm, DAY_UNIT);
}

/**
 * Medication contradiction. Fires only on a first-person claim; a denial or an
 * attribution to a family member passes, which is what keeps correct answers
 * out of the regeneration path.
 */
export function detectMedicationContradiction(
  text: string,
  facts: MedicationFact[] | undefined,
  locale?: string | null,
  therapistMessage?: string | null,
): string | null {
  if (!facts || facts.length === 0) return null;
  const norm = normalizeForFacts(text);
  if (DENIAL.test(norm)) return null;

  const therapistNorm = therapistMessage
    ? normalizeForFacts(therapistMessage)
    : "";
  // The reply names no drug at all, so any self-claim in it can only refer to
  // whatever the therapist just named. Only safe when the therapist named
  // exactly one enforceable agent — with two, the referent is ambiguous and we
  // decline rather than guess.
  const replyNamesAny = facts.some((f) => mentionsAgent(norm, f));
  const therapistNamed = therapistNorm
    ? facts.filter(
        (f) => enforceableIn(f) && mentionsAgent(therapistNorm, f),
      )
    : [];
  const anaphoricTargets =
    !replyNamesAny && therapistNamed.length > 0
      ? new Set(therapistNamed.map((f) => f.agent_class))
      : new Set<string>();

  for (const fact of facts) {
    if (!enforceableIn(fact)) continue;
    const named = mentionsAgent(norm, fact);
    const anaphoric =
      !named && anaphoricTargets.size === 1 && anaphoricTargets.has(fact.agent_class);
    if (!named && !anaphoric) continue;

    const selfCurrent = SELF_CURRENT.test(norm);
    const selfPast = SELF_PAST.test(norm);
    const family = FAMILY_ATTRIB.test(norm);

    // Family-owned drug claimed by the patient (and not attributed to them).
    if (fact.owner === "family") {
      if ((selfCurrent || selfPast) && !family) {
        return `${fact.id}:family_medication_adopted`;
      }
      continue;
    }

    if (fact.status === "never_taken" && (selfCurrent || selfPast)) {
      return `${fact.id}:never_taken_adopted`;
    }
    if (fact.status === "stopped" && selfCurrent && !selfPast) {
      return `${fact.id}:stopped_presented_as_current`;
    }

    // Dose / duration only matter when the patient is talking about their own
    // use of a drug that is actually theirs.
    if (selfCurrent || selfPast) {
      if (fact.dose_mg != null) {
        const doses = statedDoses(norm);
        if (doses.length > 0 && !doses.includes(fact.dose_mg)) {
          return `${fact.id}:wrong_dose`;
        }
      }
      if (fact.duration_days != null) {
        const days = statedDurations(norm);
        if (days.length > 0 && !days.includes(fact.duration_days)) {
          return `${fact.id}:wrong_duration`;
        }
      }
    }
  }
  return null;
}

export function validatePatientReply(
  text: string,
  facts?: CanonicalReplyFacts,
): ReplyValidationResult {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return { ok: false, reason: "empty" };
  const normalized = normalizeForCheck(trimmed);
  if (!normalized) return { ok: false, reason: "empty" };
  if (!hasLexicalContent(normalized)) {
    // Ellipsis-only: unicode … or three-or-more dots (already normalized to …).
    const compact = normalized.replace(/\s+/g, "");
    if (/^[…]+$/.test(compact) || /^\.{3,}$/.test(compact)) {
      return { ok: false, reason: "ellipsis_only" };
    }
    return { ok: false, reason: "punctuation_only" };
  }
  if (isContentlessPatientReply(trimmed)) {
    return { ok: false, reason: "ellipsis_only" };
  }

  if (facts) {
    const claimedAge = detectAgeContradiction(trimmed, facts.age);
    if (claimedAge !== null) {
      return {
        ok: false,
        reason: "age_contradiction",
        detail: `claimed ${claimedAge}, canonical ${facts.age}`,
      };
    }
    const medHit = detectMedicationContradiction(
      trimmed,
      facts.medications,
      facts.locale,
      facts.therapistMessage,
    );
    if (medHit !== null) {
      return { ok: false, reason: "medication_contradiction", detail: medHit };
    }
  }

  return { ok: true };
}
