/**
 * Micro-behaviors and imperfection directives (Layers 6 + 11).
 */

import type {
  DeliveryTag,
  DirectorAction,
  DisclosureClass,
  HceInternalState,
} from "@/lib/hce/types";

export function deliveryDirectivesFor(
  action: DirectorAction,
  disclosureClass: DisclosureClass,
  internal: HceInternalState,
  disorderSlug: string,
): { directives: string[]; suggested_tags: DeliveryTag[] } {
  const directives: string[] = [];
  const suggested_tags: DeliveryTag[] = [];

  if (disclosureClass === "deflect") {
    directives.push("Short, evasive; trail off or change subject");
    suggested_tags.push("topic_shift", "trail_off");
  }
  if (disclosureClass === "partial") {
    directives.push("Hedge; incomplete sentences; self-correct once");
    suggested_tags.push("false_start", "self_correct", "filler_words");
  }
  if (disclosureClass === "full") {
    directives.push("More complete but still imperfect; not eloquent");
    suggested_tags.push("hesitation", "trail_off");
  }

  switch (action) {
    case "stay_silent_brief":
      directives.push("Very short reply or '...' then minimal words");
      suggested_tags.push("long_pause", "hesitation");
      break;
    case "become_emotional":
      suggested_tags.push("cry", "whisper", "trail_off");
      break;
    case "interrupt_therapist":
      directives.push("Start with interruption: 'No—' or 'Wait—'");
      suggested_tags.push("false_start");
      break;
    case "avoid_topic":
      suggested_tags.push("topic_shift", "nervous_laugh");
      break;
    default:
      break;
  }

  if (internal.fear > 60) suggested_tags.push("hesitation", "whisper");
  if (internal.resistance > 55) suggested_tags.push("repeat_word", "filler_words");
  if (internal.fatigue > 55) suggested_tags.push("trail_off", "sigh");

  const slug = disorderSlug.toLowerCase();
  if (slug.includes("depress") || slug.includes("mdd")) {
    suggested_tags.push("trail_off", "sigh");
  }
  if (slug.includes("anxiety") || slug.includes("gad")) {
    suggested_tags.push("repeat_word", "filler_words");
  }
  if (slug.includes("mania") || slug.includes("bipolar")) {
    suggested_tags.push("false_start", "topic_shift");
  }

  directives.push(
    "Use filler words, false starts, incomplete sentences — sound human not scripted",
  );

  return {
    directives,
    suggested_tags: [...new Set(suggested_tags)],
  };
}

export function splitUtteranceForStreaming(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?<=[.!?؟。])\s+/u).filter(Boolean);
  if (parts.length <= 1) return [trimmed];
  return parts;
}
