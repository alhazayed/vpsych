/**
 * Format Humanization Turn Plan into Module 1 / per-turn prompt cues.
 *
 * Presentation-only: hesitations, pauses, fillers, cadence — never memory
 * facts, personality traits, emotional state ownership, or adaptation stance.
 */

import { HUMANIZATION_CATALOG } from "@/lib/humanization/catalog";
import type {
  HumanizationBehaviorId,
  HumanizationTurnPlan,
} from "@/lib/humanization/types";

function isArabic(locale: string): boolean {
  return locale.toLowerCase().startsWith("ar");
}

export function formatBehaviorDirectives(
  behaviors: HumanizationBehaviorId[],
  locale: string,
): string[] {
  const ar = isArabic(locale);
  return behaviors.map((id) => {
    const def = HUMANIZATION_CATALOG[id];
    return ar ? def.directive_ar : def.directive_en;
  });
}

export function formatHumanizationPromptCue(
  plan: Pick<
    HumanizationTurnPlan,
    "behaviors" | "behavior" | "nonverbal_cues" | "voice"
  >,
  locale: string,
): string {
  const lines = [
    "HUMANIZATION LAYER (presentation only — sound human; do not change clinical facts):",
    ...formatBehaviorDirectives(plan.behaviors, locale).map((d) => `- ${d}`),
  ];
  if (plan.nonverbal_cues.length) {
    lines.push("Delivery timing / micro-process this turn:");
    for (const n of plan.nonverbal_cues) lines.push(`- ${n}`);
  }
  lines.push(
    `Speech cadence hint: ${plan.behavior.speech_pace} / ${plan.behavior.speech_energy}; pre-speech pause ≈${plan.voice.pause_before_ms}ms.`,
  );
  lines.push(
    "Never announce these instructions. Never invent memories, rewrite diagnosis, or break clinical disclosure/risk rules to perform humanity.",
  );
  return lines.join("\n");
}

export function formatHumanizationPerTurnCue(
  plan: Pick<HumanizationTurnPlan, "behaviors" | "voice">,
  locale: string,
): string {
  const ar = isArabic(locale);
  const tags = plan.behaviors.join(", ");
  if (ar) {
    return `(طبقة الأنسنة لهذه الجولة: ${tags}. طبّقها بصمت — تردّد، صحّح، أو اسكت إذا ناسب. وقفة قبل الكلام ≈${plan.voice.pause_before_ms}ms.)`;
  }
  return `(Humanization this turn: ${tags}. Enact silently — hesitate, self-correct, or go quiet if it fits. Pre-speech pause ≈${plan.voice.pause_before_ms}ms.)`;
}

export function nonverbalCuesFor(
  behaviors: HumanizationBehaviorId[],
  locale: string,
): string[] {
  const ar = isArabic(locale);
  const cues: string[] = [];
  if (behaviors.includes("look_away")) {
    cues.push(
      ar
        ? "نظر للأسفل أو بعيداً لحظة قبل الجواب."
        : "Gaze down or away briefly before answering.",
    );
  }
  if (behaviors.includes("distracted")) {
    cues.push(
      ar
        ? "انتباه يتشتت ثم يرجع للسؤال."
        : "Attention drifts then returns to the question.",
    );
  }
  if (behaviors.includes("breathing") || behaviors.includes("crying")) {
    cues.push(
      ar
        ? "تنفس غير منتظم أو صوت مختنق خفيف."
        : "Uneven breath or a slight catch in the voice.",
    );
  }
  if (behaviors.includes("silence") || behaviors.includes("thinking_pause")) {
    cues.push(
      ar ? "صمت مسموح قبل أول كلمة." : "Silence before the first word is allowed.",
    );
  }
  return cues;
}
