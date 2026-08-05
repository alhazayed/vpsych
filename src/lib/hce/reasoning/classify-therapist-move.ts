/**
 * Classify therapist intervention style (rule-based, no extra LLM call).
 */

import type { TherapistMove } from "@/lib/hce/types";

export function classifyTherapistMove(message: string): TherapistMove {
  const t = message.trim();
  const lower = t.toLowerCase();

  if (
    /\b(suicide|kill yourself|harm yourself|safe plan|intent|plan to)\b/i.test(
      lower,
    ) ||
    /\b(hurt yourself|end your life|thoughts of death)\b/i.test(lower)
  ) {
    return "safety_check";
  }

  if (
    /\b(i'm sorry|my mistake|i missed|what would you prefer|something shifted)\b/i.test(
      lower,
    )
  ) {
    return "rupture_repair";
  }

  if (
    /\b(you should|you need to|try to|i recommend|homework|exercise)\b/i.test(
      lower,
    ) &&
    !/\?$/.test(t)
  ) {
    return "advice";
  }

  if (
    /\b(don't worry|you're fine|overreact|not that bad|everyone feels)\b/i.test(
      lower,
    )
  ) {
    return "invalidation";
  }

  if (
    /\b(sounds like|feeling|must be|seems like|i hear|that must)\b/i.test(
      lower,
    ) &&
    !/\?$/.test(t)
  ) {
    return "reflection";
  }

  if (
    /\b(understand|valid|makes sense|reasonable|i can see)\b/i.test(lower) &&
    !/\?$/.test(t)
  ) {
    return "validation";
  }

  if (t.length < 8 && !/\?/.test(t)) {
    return "silence";
  }

  if (/\?$/.test(t)) {
    if (t.split(/\s+/).length <= 8) return "closed_question";
    return "open_question";
  }

  if (/\b(hi|hello|welcome|nice to meet|how are you)\b/i.test(lower)) {
    return "rapport";
  }

  return "other";
}
