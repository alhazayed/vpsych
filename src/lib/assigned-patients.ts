/**
 * Assigned patients — the patients an admin gave a trainee, for example the
 * 3 patients of a paid course (`public.trainee_patient_assignments`).
 *
 * A trainee with no assignment is unchanged. A trainee with at least one may
 * start practice only with an assigned patient, and only as a plain therapy
 * course session: no Training Program level, no chosen disorder, case,
 * template or preset (those run outside the course and its voice allowance).
 * Supervisor skill tests still start: a supervisor assigned them on purpose.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TraineePatientAssignment } from "@/lib/types";

export const PATIENT_NOT_ASSIGNED_CODE = "patient_not_assigned";

type DbError = { code?: string; message?: string } | null;

export type AssignedPatientsResult =
  /** `ids` is null when the trainee has no assignment (no restriction). */
  | { ok: true; ids: Set<string> | null }
  | { ok: false; code: string };

/** True when the error means the table is not there yet (migration pending). */
export function isAssignmentSchemaMissing(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (
    /trainee_patient_assignments/i.test(error.message ?? "") &&
    /does not exist|schema cache|could not find/i.test(error.message ?? "")
  );
}

/**
 * Reads a trainee's assigned patients. Before the migration is applied the
 * table is missing; that is logged and treated as "no assignment" so session
 * starts keep working. Any other read error is returned so the caller can
 * stop safely instead of ignoring the restriction.
 */
export async function loadAssignedPatientIds(
  supabase: SupabaseClient,
  traineeId: string,
): Promise<AssignedPatientsResult> {
  const { data, error } = await supabase
    .from("trainee_patient_assignments")
    .select("avatar_id")
    .eq("trainee_id", traineeId);
  if (error) {
    if (isAssignmentSchemaMissing(error)) {
      console.error("[assigned-patients] table missing; no restriction applied", {
        code: error.code,
      });
      return { ok: true, ids: null };
    }
    return { ok: false, code: error.code ?? "read_failed" };
  }
  const rows = (data ?? []) as Pick<TraineePatientAssignment, "avatar_id">[];
  if (rows.length === 0) return { ok: true, ids: null };
  return { ok: true, ids: new Set(rows.map((r) => r.avatar_id)) };
}

/**
 * Whether an assigned-patients trainee may start this session. Returns
 * `PATIENT_NOT_ASSIGNED_CODE` when not, null when allowed.
 */
export function assignedPatientStartError(input: {
  assigned: Set<string> | null;
  avatarId: string | null | undefined;
  /** A supervisor skill test. */
  skillTest: boolean;
  /** A Training Program level. */
  ladder: boolean;
  /** A chosen disorder, case, template or preset (not a course session). */
  specificCase: boolean;
}): typeof PATIENT_NOT_ASSIGNED_CODE | null {
  if (!input.assigned) return null;
  if (input.skillTest) return null;
  if (input.ladder || input.specificCase) return PATIENT_NOT_ASSIGNED_CODE;
  if (!input.avatarId || !input.assigned.has(input.avatarId)) {
    return PATIENT_NOT_ASSIGNED_CODE;
  }
  return null;
}
