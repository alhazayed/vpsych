/**
 * Contract-level Virtual Patient lifecycle (Option B).
 *
 * lifecycle_status is canonical; is_active is the therapist-visibility projection.
 * Pure helpers for documentation / contract tests — not the authoring API implementation.
 */

export type VirtualPatientLifecycleStatus =
  | "draft"
  | "testing"
  | "published"
  | "archived";

/** Projection: published → true; all other lifecycle states → false. */
export function isActiveFromLifecycle(
  status: VirtualPatientLifecycleStatus,
): boolean {
  return status === "published";
}

/** Therapist RLS visibility uses is_active; only published projects to true. */
export function isTherapistVisible(
  status: VirtualPatientLifecycleStatus,
): boolean {
  return isActiveFromLifecycle(status);
}

/**
 * Allowed transitions from PR #188 canTransitionLifecycle (authoritative safety graph).
 * Self-transitions are allowed as no-ops.
 */
const ALLOWED: Record<
  VirtualPatientLifecycleStatus,
  VirtualPatientLifecycleStatus[]
> = {
  draft: ["testing", "published", "archived"],
  testing: ["draft", "published", "archived"],
  published: ["archived"],
  archived: ["draft"],
};

export function canTransitionLifecycle(
  from: VirtualPatientLifecycleStatus,
  to: VirtualPatientLifecycleStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function duplicateLifecycleStatus(): VirtualPatientLifecycleStatus {
  return "draft";
}

export function createLifecycleStatus(): VirtualPatientLifecycleStatus {
  return "draft";
}

/** Published withdrawal — DEACTIVATE ≡ ARCHIVE. */
export function archiveFromPublished(): VirtualPatientLifecycleStatus {
  return "archived";
}

/**
 * Lifecycle changes affect catalog visibility only.
 * They must never rewrite sessions / clinical snapshots / reports.
 * This helper documents the invariant for contract tests.
 */
export function lifecycleMutatesHistoricalSessions(): false {
  return false;
}

export function lifecycleMutatesClinicalSnapshots(): false {
  return false;
}

export const LIFECYCLE_PROJECTION_TABLE: ReadonlyArray<{
  status: VirtualPatientLifecycleStatus;
  is_active: boolean;
  therapistVisible: boolean;
}> = [
  { status: "draft", is_active: false, therapistVisible: false },
  { status: "testing", is_active: false, therapistVisible: false },
  { status: "published", is_active: true, therapistVisible: true },
  { status: "archived", is_active: false, therapistVisible: false },
];
