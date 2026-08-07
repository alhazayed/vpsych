/**
 * Therapist-move and sensitive-topic classifiers for CBE.
 * Heuristic, deterministic, locale-light (EN + common AR cues).
 */

import type { SensitiveTopic, TherapistMoveKind } from "./types";

const SAFETY =
  /\b(suicid\w*|kill yourself|end (?:your|my) life|self[-\s]?harm|hurt yourself|safe(?:ty)? plan|homicid\w*|harm someone)\b|انتحار|تأذي|أذية نفس|خط[ر]?/;

const TRAUMA =
  /\b(trauma|flashback|assault|abuse|rape|nightmares? about|the (?:accident|incident|attack))\b|صدمة|تحرش|اعتداء|كوابيس/;

const SUBSTANCE =
  /\b(alcohol|drink(?:ing)?|drunk|beer|wine|vodka|drugs?|cocaine|heroin|cannabis|weed|opioids?|how much (?:do )?you (?:drink|use))\b|كحول|خمر|مخدر|حشيش|سكران/;

const SHAME =
  /\b(embarrass|ashamed|shame|humiliat|stupid|weak|failure|pathetic)\b|خجل|عيب|ضعف|فشل/;

const RELATIONSHIP =
  /\b(partner|spouse|husband|wife|boyfriend|girlfriend|marriage|divorce|break[- ]?up|family (?:said|thinks)|mother|father)\b|زوج|زوجة|طلاق|أهلي|أمي|أبوي/;

const REFLECTION =
  /\b(it sounds like|you(?:'re| are) feeling|what i(?:'m| am) hearing|seems like you|i hear (?:that )?you)\b|يبدو إنك|حاس[ةه] إنك|يعني إنك/;

const VALIDATION =
  /\b(that makes sense|understandably|of course you(?:'d| would)|anyone would|you're not crazy|valid)\b|مفهوم|طبيعي|محق[ة]?|ما في عيب/;

const ADVICE =
  /\b(you should|try to|have you tried|why don't you|just |need to|must |homework|exercise|breathe|think positive)\b|لازم|جرب|حاول|التنفس|إيجاب/;

const CONFRONT =
  /\b(you're not being honest|that's not true|stop (?:lying|avoiding)|you keep (?:avoiding|changing)|be honest|admit)\b|ما بتحكي الصح|توقف عن|اعترف/;

const OPEN_Q =
  /^(how |what |tell me |can you (?:say|tell|share)|when |where |who |why |وصف|كيف |شو |إيش |ليش |متى )/i;

const CLOSED_Q =
  /^(do you |did you |are you |is it |have you |was it |هل |هلّا |بتقدر)/i;

const RAPPORT =
  /\b(nice to meet|glad you(?:'re| are) here|thanks for coming|how was (?:your )?(?:week|day)|settling in)\b|تشرفنا|منيح إنك|كيف أسبوعك/;

export function classifySensitiveTopic(message: string): SensitiveTopic {
  const m = message.toLowerCase();
  if (SAFETY.test(m)) return "risk";
  if (TRAUMA.test(m)) return "trauma";
  if (SUBSTANCE.test(m)) return "substance";
  if (SHAME.test(m)) return "shame";
  if (RELATIONSHIP.test(m)) return "relationship";
  return "none";
}

export function classifyTherapistMove(
  message: string,
  opts?: { therapistInterrupted?: boolean },
): TherapistMoveKind {
  if (opts?.therapistInterrupted) return "interruption";
  const m = message.trim();
  const lower = m.toLowerCase();

  if (SAFETY.test(lower)) return "safety_check";
  if (CONFRONT.test(lower)) return "confrontation";
  if (REFLECTION.test(lower)) return "reflection";
  if (VALIDATION.test(lower)) return "validation";
  if (ADVICE.test(lower)) return "advice";

  const topic = classifySensitiveTopic(m);
  if (topic !== "none") return "sensitive_probe";

  if (RAPPORT.test(lower) || (m.length < 40 && /^(hi|hello|hey|مرحبا|أهلين)/i.test(m))) {
    return "rapport";
  }

  const looksLikeQuestion = /\?\s*$/.test(m) || OPEN_Q.test(m) || CLOSED_Q.test(m);
  if (looksLikeQuestion) {
    if (CLOSED_Q.test(m) && !OPEN_Q.test(m)) return "closed_question";
    return "open_question";
  }
  return "neutral";
}
