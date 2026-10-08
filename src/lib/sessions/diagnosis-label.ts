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
