import enMessages from "../../../messages/en.json";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

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
 * label in `skillTests.disorders`, else the case's own name. Null for skill
 * tests (sealed) and sessions with no diagnosis.
 */
export function sessionDiagnosisText(
  session: Parameters<typeof sessionDiagnosis>[0],
  disorders: { has(key: string): boolean; (key: string): string },
): string | null {
  const dx = sessionDiagnosis(session);
  if (!dx) return null;
  return dx.slug && disorders.has(dx.slug) ? disorders(dx.slug) : dx.name;
}

const SLUG_BY_ENGLISH_NAME = new Map(
  Object.entries(enMessages.skillTests.disorders).map(([slug, name]) => [
    name.toLowerCase(),
    slug,
  ]),
);

/**
 * A free-text disorder name stored on a row (e.g. a patient's default case)
 * as display text: translated when it matches a catalogue label exactly,
 * else the stored text unchanged.
 */
export function disorderNameText(
  name: string | null | undefined,
  disorders: { has(key: string): boolean; (key: string): string },
): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const slug = SLUG_BY_ENGLISH_NAME.get(trimmed.toLowerCase());
  return slug && disorders.has(slug) ? disorders(slug) : trimmed;
}
