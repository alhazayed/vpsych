import enMessages from "../../../messages/en.json";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

type Translator = { has(key: string): boolean; (key: string): string };

/**
 * The diagnosis a session was actually run with.
 *
 * A persona never owns a disorder: each session mints its own case, so the
 * diagnosis lives in `sessions.clinical_snapshot`, not on the avatar row
 * (`avatars.disorder` is only the persona's legacy default). Skill test
 * sessions keep their case sealed, so this returns null for them and the
 * trainee never sees the diagnosis. The avatar's legacy value is used only
 * for old sessions created before snapshots carried a diagnosis.
 */
export function sessionDiagnosis(session: {
  clinical_snapshot?: Pick<CaseInstanceSnapshot, "primary_diagnosis"> | null;
  skill_test_assignment_id?: string | null;
  avatars?: { disorder?: string | null } | null;
}): { slug: string | null; name: string } | null {
  if (session.skill_test_assignment_id) return null;
  const primary = session.clinical_snapshot?.primary_diagnosis;
  if (primary?.name) return { slug: primary.slug ?? null, name: primary.name };
  const legacy = session.avatars?.disorder?.trim();
  return legacy ? { slug: null, name: legacy } : null;
}

/**
 * The session's diagnosis as display text: translated when the slug has a
 * label in `skillTests.disorders`, else the case's own name through
 * `disorderNameText` (so a legacy avatar diagnosis reads in the UI language
 * too). Null for skill tests (sealed) and sessions with no diagnosis.
 */
export function sessionDiagnosisText(
  session: Parameters<typeof sessionDiagnosis>[0],
  disorders: Translator,
  defaults?: Translator,
): string | null {
  const dx = sessionDiagnosis(session);
  if (!dx) return null;
  if (dx.slug && disorders.has(dx.slug)) return disorders(dx.slug);
  return disorderNameText(dx.name, disorders, defaults);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,;.()/-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Stored wordings (avatars.disorder, older case names) that say the same
 * thing as a catalogue label in different words.
 */
const SLUG_ALIASES: Record<string, string> = {
  "Major Depressive Disorder, recurrent episode, moderate": "mdd-recurrent-moderate",
  "Attention-Deficit/Hyperactivity Disorder, predominantly inattentive, adult":
    "adult-adhd",
};

function keysByText(entries: Record<string, string>): Map<string, string> {
  return new Map(
    Object.entries(entries).map(([key, text]) => [normalize(text), key]),
  );
}

const SLUG_BY_ENGLISH_NAME = new Map([
  ...keysByText(enMessages.skillTests.disorders),
  ...Object.entries(SLUG_ALIASES).map(
    ([text, slug]) => [normalize(text), slug] as const,
  ),
]);
const DEFAULT_KEY_BY_ENGLISH_NAME = keysByText(
  enMessages.avatars.defaultDisorders,
);

/**
 * A free-text disorder name stored on a row (a patient's default case, a
 * session's case name) as display text: the catalogue label when it matches
 * one exactly, else the authored `avatars.defaultDisorders` label for this
 * exact wording, else the stored text unchanged.
 */
export function disorderNameText(
  name: string | null | undefined,
  disorders: Translator,
  defaults?: Translator,
): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const slug = SLUG_BY_ENGLISH_NAME.get(normalize(trimmed));
  if (slug && disorders.has(slug)) return disorders(slug);
  const key = DEFAULT_KEY_BY_ENGLISH_NAME.get(normalize(trimmed));
  if (key && defaults?.has(key)) return defaults(key);
  return trimmed;
}
