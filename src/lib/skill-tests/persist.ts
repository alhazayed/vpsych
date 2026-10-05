/**
 * Skill test reads for the session start route. Runs on the caller's client:
 * `my_skill_tests()` returns only the trainee's own assignments and never the
 * case in the clear. The server opens the sealed spec and pinned case.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  SKILL_TEST_SEAL_UNAVAILABLE,
  openSkillTestCase,
  openSkillTestSpec,
  type SkillTestSpec,
} from "./exam";
import { canSealSkillTests } from "./seal";
import {
  decideSkillTestStart,
  skillTestStartError,
  type SkillTestSessionRow,
  type TraineeSkillTest,
} from "./start";
import { isUuid } from "./validation";

export type SkillTestStart =
  | {
      ok: true;
      assignment: TraineeSkillTest;
      spec: SkillTestSpec;
      /** Case pinned by an earlier test session (null on the first one). */
      pinnedCase: CaseInstanceSnapshot | null;
      sessionNumber: number;
    }
  | { ok: false; status: number; error: string; code: string };

const UNAVAILABLE = {
  ok: false as const,
  status: 500,
  error: "Could not load this skill test. Please try again.",
  code: "skill_test_unavailable",
};

/** The trainee's own assignments (safe columns only). */
export async function loadMySkillTests(
  supabase: SupabaseClient,
  assignmentId: string | null = null,
): Promise<{ ok: true; rows: TraineeSkillTest[] } | { ok: false }> {
  const { data, error } = await supabase.rpc("my_skill_tests", {
    p_assignment_id: assignmentId,
  });
  if (error) return { ok: false };
  return { ok: true, rows: (data ?? []) as TraineeSkillTest[] };
}

export async function loadSkillTestStart(
  supabase: SupabaseClient,
  opts: { userId: string; skillTestId: unknown },
): Promise<SkillTestStart> {
  if (!isUuid(opts.skillTestId)) {
    const e = skillTestStartError("skill_test_not_assigned");
    return { ok: false, status: e.status, error: e.message, code: e.code };
  }
  if (!canSealSkillTests()) {
    return { ...UNAVAILABLE, status: 503, error: SKILL_TEST_SEAL_UNAVAILABLE };
  }
  const mine = await loadMySkillTests(supabase, opts.skillTestId);
  if (!mine.ok) return UNAVAILABLE;
  const assignment = mine.rows[0] ?? null;

  let sessions: SkillTestSessionRow[] = [];
  if (assignment) {
    const { data: rows, error: sErr } = await supabase
      .from("sessions")
      .select("status, started_at, max_duration_sec")
      .eq("skill_test_assignment_id", assignment.id);
    if (sErr) return UNAVAILABLE;
    sessions = (rows ?? []) as SkillTestSessionRow[];
  }

  const decision = decideSkillTestStart(assignment, opts.userId, sessions);
  if (decision.kind === "blocked" || !assignment) {
    const e = skillTestStartError(
      decision.kind === "blocked" ? decision.code : "skill_test_not_assigned",
    );
    return { ok: false, status: e.status, error: e.message, code: e.code };
  }
  const spec = openSkillTestSpec(assignment.id, assignment.sealed_spec);
  const pinnedCase = assignment.sealed_case
    ? openSkillTestCase(assignment.id, assignment.sealed_case)
    : null;
  if (!spec || (assignment.sealed_case && !pinnedCase)) {
    console.error("[skill-tests] sealed test data could not be opened", {
      assignmentId: assignment.id,
    });
    return UNAVAILABLE;
  }
  return {
    ok: true,
    assignment,
    spec,
    pinnedCase,
    sessionNumber: decision.sessionNumber,
  };
}
