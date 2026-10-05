/**
 * Skill test reads for the session start route. Runs on the caller's client,
 * so RLS limits a trainee to their own assignments.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillTestAssignment } from "@/lib/types";
import {
  SKILL_TEST_COLUMNS,
  decideSkillTestStart,
  skillTestStartError,
  type SkillTestSessionRow,
} from "./start";
import { isUuid } from "./validation";

export type SkillTestStart =
  | {
      ok: true;
      assignment: SkillTestAssignment;
      sessionNumber: number;
    }
  | { ok: false; status: number; error: string; code: string };

export async function loadSkillTestStart(
  supabase: SupabaseClient,
  opts: { userId: string; skillTestId: unknown },
): Promise<SkillTestStart> {
  if (!isUuid(opts.skillTestId)) {
    const e = skillTestStartError("skill_test_not_assigned");
    return { ok: false, status: e.status, error: e.message, code: e.code };
  }
  const { data: row, error } = await supabase
    .from("skill_test_assignments")
    .select(SKILL_TEST_COLUMNS)
    .eq("id", opts.skillTestId)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Could not load this skill test. Please try again.",
      code: "skill_test_unavailable",
    };
  }
  const assignment = (row as SkillTestAssignment | null) ?? null;

  let sessions: SkillTestSessionRow[] = [];
  if (assignment) {
    const { data: rows, error: sErr } = await supabase
      .from("sessions")
      .select("status, started_at, max_duration_sec")
      .eq("skill_test_assignment_id", assignment.id);
    if (sErr) {
      return {
        ok: false,
        status: 500,
        error: "Could not load this skill test. Please try again.",
        code: "skill_test_unavailable",
      };
    }
    sessions = (rows ?? []) as SkillTestSessionRow[];
  }

  const decision = decideSkillTestStart(assignment, opts.userId, sessions);
  if (decision.kind === "blocked" || !assignment) {
    const e = skillTestStartError(
      decision.kind === "blocked" ? decision.code : "skill_test_not_assigned",
    );
    return { ok: false, status: e.status, error: e.message, code: e.code };
  }
  return { ok: true, assignment, sessionNumber: decision.sessionNumber };
}
