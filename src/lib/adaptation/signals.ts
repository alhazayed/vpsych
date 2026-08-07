/**
 * Detect therapist behavioural signals from a single utterance.
 * Heuristic, bilingual (EN + AR), deterministic — no LLM.
 */

import type {
  TherapistBehaviourCue,
  TherapistTurnSignals,
} from "@/lib/adaptation/types";

const WARMTH_RE =
  /\b(thank you|appreciate|glad (you'?re|you are) here|with you|safe here|i'?m here|take your time|no rush)\b|شكرا|معك|بأمان|خذي وقتك|خذ وقتك|مقدر/i;

const EMPATHY_RE =
  /\b(sounds like|hear you|that (must|sounds) (feel|hard|difficult)|hard for you|difficult|that makes sense|must feel|i understand|i can see)\b|يفهم|صعب|يبدو|أحس|بفهم|بقدر أتخيل/i;

const EXCELLENT_EMPATHY_RE =
  /\b(it makes sense (that|you)|anyone would feel|of course you('d| would)|you'?re not alone in|validate|that takes courage|painful and (still|yet))\b|محق|طبيعي تحس|مو لوحدك|شجاعة|مفهوم إنك/i;

const JUDGMENT_RE =
  /\b(you (should|need to|must|ought)|why (didn'?t|wouldn'?t|can'?t) you|obviously|just (admit|stop|get over)|that'?s (silly|dramatic|overreacting)|stop (being|doing)|you'?re (overreacting|too sensitive))\b|لازم|ليش ما|اهدأ|مبالغ|لازم توقف/i;

const INTERRUPT_RE =
  /\b(let me stop you|before you finish|anyway[,.]|moving on|hold on[,.]|right[,.] so|ok but|wait[,.] (no|but)|we'?ve covered that|next question)\b|خليني أوقفك|على كل حال|ننتقل|لحظة بس|طيب بس/i;

const CONFRONT_RE =
  /\b(you need to face|be honest|the truth is|you'?re avoiding|admit it)\b|واجه|الصراحة|بتتهرب|اعترف/i;

const VALIDATE_RE =
  /\b(makes sense|understandable|anyone would|reasonable|valid|fair)\b|مفهوم|محق|منطقي|طبيعي/i;

const REPAIR_RE =
  /\b(sorry if|i may have|let me try again|did i misunderstand|appreciate you correcting|i interrupted)\b|آسف|خليني أرجع|قاطعتك|فهمتك غلط/i;

export function clamp01to100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

/**
 * Score one therapist turn into adaptation signals.
 */
export function signalTherapistBehaviour(
  content: string,
): TherapistTurnSignals {
  const text = content.trim();
  const cues: TherapistBehaviourCue[] = [];
  let warmth = 0;
  let judgment = 0;
  let interruption = 0;
  let empathy = 0;
  let excellent_empathy = 0;
  let confrontation = 0;
  let validation = 0;

  if (WARMTH_RE.test(text)) {
    warmth += 10;
    cues.push("warmth");
  }
  if (EMPATHY_RE.test(text)) {
    empathy += 10;
  }
  if (VALIDATE_RE.test(text)) {
    validation += 8;
    cues.push("validation");
  }
  // Excellent empathy = reflective affect + validation, or explicit high-skill markers
  if (
    EXCELLENT_EMPATHY_RE.test(text) ||
    (empathy >= 10 && validation >= 8)
  ) {
    excellent_empathy += 14;
    empathy = Math.max(empathy, 12);
    cues.push("excellent_empathy");
  }
  if (JUDGMENT_RE.test(text)) {
    judgment += 14;
    cues.push("judgment");
  }
  if (INTERRUPT_RE.test(text)) {
    interruption += 16;
    cues.push("interruption");
  }
  if (CONFRONT_RE.test(text)) {
    confrontation += 12;
    cues.push("confrontation");
  }
  // Stacked questions feel interruptive / pressuring
  if (text.split("?").length > 3) {
    interruption += 8;
    judgment += 4;
    if (!cues.includes("interruption")) cues.push("interruption");
  }
  if (text.length > 0 && text.length < 12) {
    cues.push("curt");
    judgment += 3;
  }
  const repair = REPAIR_RE.test(text);
  if (repair) cues.push("repair");

  // Deduplicate cues while preserving order
  const seen = new Set<TherapistBehaviourCue>();
  const unique = cues.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });

  return {
    warmth,
    judgment,
    interruption,
    empathy,
    excellent_empathy,
    confrontation,
    validation,
    repair,
    cues: unique,
  };
}
