/**
 * Lightweight therapist-move classifier for Humanization Engine.
 * Deterministic keyword heuristics — good enough for behaviour selection.
 */

import type { TherapistMove } from "@/lib/humanization/types";

export function classifyTherapistMove(message: string): TherapistMove {
  const t = message.trim().toLowerCase();
  if (!t) return "silence";

  if (
    /\b(kill yourself|suicide|suicidal|end your life|hurt yourself|self-harm|harm yourself|safe\b|safety)\b/i.test(
      t,
    ) ||
    /انتحار|أذي نفسك|سلامة|خطر/.test(t)
  ) {
    return "safety_check";
  }
  if (
    /\b(sorry (i|that)|i misspoke|let me try again|that came out wrong|i interrupted)\b/i.test(
      t,
    ) ||
    /آسف|خليني أعيد|طلع كلامي غلط/.test(t)
  ) {
    return "rupture_repair";
  }
  if (
    /\b(you should|you need to|just try|have you tried|why don't you|homework)\b/i.test(
      t,
    ) ||
    /لازم|جرّب|جربي|واجب/.test(t)
  ) {
    return "advice";
  }
  if (
    /\b(that's silly|overreacting|you're fine|stop worrying|calm down)\b/i.test(
      t,
    ) ||
    /مبالغ|هوني|مش مستاهلة/.test(t)
  ) {
    return "invalidation";
  }
  if (
    /\b(it makes sense|i hear|i understand|that sounds\b|you're not alone)\b/i.test(
      t,
    ) ||
    /بفهمك|معك حق|صعب/.test(t)
  ) {
    return "validation";
  }
  if (
    /\b(it sounds like|you're saying|what i'm hearing|so you feel)\b/i.test(t) ||
    /يعني إنك|حاسس إنك|اللي سامعه/.test(t)
  ) {
    return "reflection";
  }
  if (
    /\b(how are you|nice to meet|good to see|how was your week)\b/i.test(t) ||
    /كيفك|تشرفنا|كيف أسبوعك/.test(t)
  ) {
    return "rapport";
  }
  if (t.length < 3 || /^(ok|okay|mm+|hmm+|…|\.\.\.)$/i.test(t)) {
    return "silence";
  }
  if (/\?|؟/.test(t)) {
    // Closed-ish if yes/no framed
    if (
      /^(do|did|are|is|was|were|have|has|can|could|would|will)\b/i.test(t) ||
      /^(هل|يعني)\b/.test(t)
    ) {
      return "closed_question";
    }
    return "open_question";
  }
  return "other";
}
