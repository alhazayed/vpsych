/**
 * Text stored on an avatar row, shown on the Patient Library card in the UI
 * language. `avatars.disorder` and `ideal_guidelines.session_goals` are
 * authored once, in English; their translations live in messages/*.json
 * (`avatars.defaultDisorders`, `avatars.sessionGoals`), keyed by an id whose
 * English entry is the stored wording. Stored text with no exact match is
 * shown unchanged, so an edited goal reads in English rather than vanishing.
 */
import enMessages from "../../../messages/en.json";
import { disorderNameText } from "@/lib/sessions/diagnosis-label";

type Translator = { has(key: string): boolean; (key: string): string };

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function keysByText(entries: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(entries).map(([key, text]) => [normalize(text), key]),
  );
}

const GOAL_KEYS = keysByText(enMessages.avatars.sessionGoals);

function storedText(
  text: string,
  keys: Map<string, string>,
  t: Translator,
): string {
  const key = keys.get(normalize(text));
  return key && t.has(key) ? t(key) : text.trim();
}

/**
 * A patient's default diagnosis as display text: the skill-test catalogue
 * label when it matches, else the authored label for this exact wording,
 * else the stored text.
 */
export function defaultDisorderText(
  name: string | null | undefined,
  catalogue: Translator,
  defaults: Translator,
): string | null {
  return disorderNameText(name, catalogue, defaults);
}

/** A session goal (trainee teaching target) as display text. */
export function sessionGoalText(goal: string, goals: Translator): string {
  return storedText(goal, GOAL_KEYS, goals);
}
