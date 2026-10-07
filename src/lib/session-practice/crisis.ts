/**
 * Crisis handling — what the therapist did after the patient disclosed
 * suicidal thoughts in the session, against the WHO mhGAP steps for imminent
 * risk: ask directly, assess immediacy, stay engaged, make means safe,
 * involve supports, involve specialists, arrange follow-up.
 *
 * Pure and deterministic phrase matching, English and Arabic. It finds the
 * first patient disclosure, then looks at therapist turns from that point on.
 * It records whether a step was visibly attempted, not how well. Not
 * validated. See docs/SESSION_PRACTICE_ENGINE.md.
 */

import { PRACTICE_PATTERNS } from "@/lib/session-practice/patterns";
import type { PracticeCheckId } from "@/lib/session-practice/types";

export const CRISIS_HANDLING_VERSION = "crisis-handling.v1" as const;

export type CrisisStepId =
  | "asked_directly"
  | "assessed_immediacy"
  | "stayed_engaged"
  | "means_safety"
  | "supports"
  | "specialist_help"
  | "follow_up";

export const CRISIS_STEP_ORDER: readonly CrisisStepId[] = [
  "asked_directly",
  "assessed_immediacy",
  "stayed_engaged",
  "means_safety",
  "supports",
  "specialist_help",
  "follow_up",
];

export type CrisisStep = {
  id: CrisisStepId;
  detected: boolean;
  /** Therapist turns after the disclosure before this step (0 = the very next turn). */
  turns_after: number | null;
  excerpt: string | null;
};

export type CrisisHandling = {
  version: typeof CRISIS_HANDLING_VERSION;
  /** Index of the disclosing patient turn among patient turns (0-based). */
  disclosure_turn: number;
  disclosure_excerpt: string;
  /** Therapist turns from the disclosure to the end of the session. */
  therapist_turns_after: number;
  /** Therapist turns before the first one that responds to the risk; null if none did. */
  turns_to_respond: number | null;
  steps: CrisisStep[];
  limitations: string[];
};

/** At least this many therapist turns after the disclosure counts as staying engaged. */
export const STAYED_ENGAGED_TURNS = 3;

export const CRISIS_HANDLING_LIMITATIONS = [
  "Phrase matching on the transcript; it records whether a step was visibly attempted, not how well.",
  "Steps follow the WHO mhGAP guidance for imminent risk of self-harm or suicide. Not a validated instrument.",
] as const;

/**
 * Patient disclosure of suicidal thoughts. Specific phrases only: general
 * sadness ("I feel hopeless") is not a disclosure.
 */
const DISCLOSURE =
  /kill(ing)? myself|end(ing)? (it all|my life|things)|take my (own )?life|suicid|(don'?t|do not) want to (live|be alive|be here anymore|wake up)|better off dead|wish i (was|were) dead|not wake up|hurt myself|(can'?t|cannot|not sure i can|don'?t know if i can) keep myself safe|won'?t be (here|around) (tomorrow|much longer|anymore)|ما بقدر أحمي حالي|ما بعرف إذا بقدر أحمي حالي|مش رح أكون موجود|مش رح اكون موجود|أقتل حالي|اقتل حالي|أقتل نفسي|اقتل نفسي|أنهي حياتي|انهي حياتي|أخلص من حالي|اخلص من حالي|أنتحر|انتحر|الانتحار|ما بدي أعيش|ما بدي اعيش|لا أريد أن أعيش|بدي أموت|بدي اموت|أؤذي نفسي|اؤذي نفسي|أأذي حالي|أذي حالي/iu;

/** A denial just before the phrase ("I'd never kill myself"). */
const NEGATION_BEFORE =
  /(not|never|no|don'?t|wouldn'?t|won'?t|nothing like|ما|مش|مو|لا|أبداً|ابدا|عمري ما)[^.!?؟،,]{0,25}$/iu;

const STEP_PATTERNS: Partial<Record<CrisisStepId, RegExp>> = {
  asked_directly:
    /suicid|kill(ing)? yourself|end(ing)? your (own )?life|take your (own )?life|thoughts? of (dying|death|not being here)|hurt(ing)? yourself|تقتل حالك|تقتلي حالك|تنهي حياتك|تنهي حياتك|الانتحار|تنتحر|تنتحري|تأذي حالك|تأذي نفسك|تموت|تموتي/iu,
  assessed_immediacy:
    /(do|have) you (have|made|got) a plan|any plans? (to|for)|how would you (do|end|kill|hurt)|when (would|were) you (going|planning)|tonight|how (close|likely) (are|is|have)|intend|intention|what (stops|is stopping|has stopped|keeps) you|access to|have (the )?(pills|medication|tablets|a gun|rope|knife)|عندك خطة|في خطة|إلك خطة|كيف رح تعمل|إمتى ناوي|امتى ناوي|ناوي|ناوية|الليلة|شو مانعك|شو اللي مانعك|في عندك (حبوب|أدوية|ادوية|سلاح)/iu,
  follow_up:
    /check in (with you|on you)|call you (tomorrow|later|tonight)|see you (tomorrow|again|next)|next (session|appointment|time)|follow[- ]?up|book (another|a) (session|appointment)|بطمّن عليك|بطمن عليك|بتصل فيك|بكرا|بكرة|الجلسة الجاية|الموعد الجاي|نتابع|متابعة/iu,
};

/** mhGAP steps that reuse the safety-planning practice patterns. */
const REUSED: Partial<Record<CrisisStepId, PracticeCheckId[]>> = {
  means_safety: ["means_safety"],
  supports: ["social_supports"],
  specialist_help: ["professional_contacts"],
};

const EXTRA: Partial<Record<CrisisStepId, RegExp>> = {
  supports:
    /stay with you|be with you tonight|someone (to be|who can be|who could be) with you|(tell|let) (someone|your (family|partner|wife|husband|mother|father|friend))|حدا يكون معك|حدا يضل معك|تخبر حدا|تحكي لأهلك|تحكي لاهلك/iu,
  specialist_help:
    /psychiatrist|crisis team|urgent (care|assessment|appointment)|(go|going|get you) to (the )?hospital|your (gp|doctor)|طبيب نفسي|الطبيب النفسي|المستشفى|الطوارئ|طبيبك/iu,
};

function patternsFor(id: CrisisStepId): RegExp[] {
  const out: RegExp[] = [];
  const own = STEP_PATTERNS[id];
  if (own) out.push(own);
  for (const practiceId of REUSED[id] ?? []) {
    const p = PRACTICE_PATTERNS.find((x) => x.id === practiceId);
    if (p) out.push(p.pattern);
  }
  const extra = EXTRA[id];
  if (extra) out.push(extra);
  return out;
}

/** First patient sentence that discloses suicidal thoughts, ignoring denials. */
export function findDisclosure(text: string): string | null {
  for (const sentence of text.split(/(?<=[.!?؟])\s+|\n+/u)) {
    const match = DISCLOSURE.exec(sentence);
    if (!match) continue;
    const before = sentence.slice(0, match.index);
    if (NEGATION_BEFORE.test(before)) continue;
    return sentence.trim();
  }
  return null;
}

function clip(s: string, max = 180): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Crisis handling for one transcript, or null when the patient never
 * disclosed suicidal thoughts.
 */
export function evaluateCrisisHandling(
  messages: Array<{ role: string; content: string }>,
): CrisisHandling | null {
  let patientTurn = -1;
  let disclosureAt = -1;
  let disclosureTurn = -1;
  let disclosure: string | null = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== "assistant") continue;
    patientTurn += 1;
    disclosure = findDisclosure(m.content ?? "");
    if (disclosure) {
      disclosureAt = i;
      disclosureTurn = patientTurn;
      break;
    }
  }
  if (disclosure === null || disclosureAt < 0) return null;

  const after = messages
    .slice(disclosureAt + 1)
    .filter((m) => m.role === "user")
    .map((m) => m.content ?? "");

  const steps: CrisisStep[] = CRISIS_STEP_ORDER.map((id) => {
    if (id === "stayed_engaged") {
      const detected = after.length >= STAYED_ENGAGED_TURNS;
      return { id, detected, turns_after: null, excerpt: null };
    }
    const patterns = patternsFor(id);
    for (let i = 0; i < after.length; i++) {
      if (patterns.some((p) => p.test(after[i]!))) {
        return { id, detected: true, turns_after: i, excerpt: clip(after[i]!) };
      }
    }
    return { id, detected: false, turns_after: null, excerpt: null };
  });

  const responding = steps
    .filter((s) => s.id !== "stayed_engaged" && s.turns_after !== null)
    .map((s) => s.turns_after as number);

  return {
    version: CRISIS_HANDLING_VERSION,
    disclosure_turn: disclosureTurn,
    disclosure_excerpt: clip(disclosure),
    therapist_turns_after: after.length,
    turns_to_respond: responding.length ? Math.min(...responding) : null,
    steps,
    limitations: [...CRISIS_HANDLING_LIMITATIONS],
  };
}
