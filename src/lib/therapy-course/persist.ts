/**
 * Therapy course persistence. Reads degrade to "unavailable" when the
 * therapy_courses table is missing so sessions keep working as standalone
 * sessions until the migration is applied.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  TherapyCourse,
  TherapyCourseCompletionReason,
} from "@/lib/types";
import { DEFAULT_PLANNED_SESSIONS } from "./gate";
import { asTreatmentPlan } from "./validation";

export const COURSE_COLUMNS =
  "id, therapist_id, avatar_id, case_instance_id, clinical_snapshot, language, max_duration_sec, status, planned_sessions, treatment_plan, plan_submitted_at, plan_updated_at, completed_at, completion_reason, created_at, updated_at";

type DbError = { code?: string; message?: string } | null | undefined;

/** Table/column missing (migration not applied) vs a real failure. */
export function isCourseSchemaMissing(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || error.code === "PGRST204") {
    return true;
  }
  return /therapy_course|course_session_number/i.test(error.message ?? "") &&
    /does not exist|schema cache|could not find/i.test(error.message ?? "");
}

export function normalizeCourseRow(row: Record<string, unknown>): TherapyCourse {
  const r = row as unknown as TherapyCourse;
  return {
    ...r,
    planned_sessions:
      typeof r.planned_sessions === "number"
        ? r.planned_sessions
        : DEFAULT_PLANNED_SESSIONS,
    treatment_plan: asTreatmentPlan(r.treatment_plan),
  };
}

export type ActiveCourseLookup =
  | { available: false }
  | { available: true; course: TherapyCourse | null };

export async function loadActiveCourse(
  supabase: SupabaseClient,
  opts: { therapistId: string; avatarId: string },
): Promise<ActiveCourseLookup> {
  const { data, error } = await supabase
    .from("therapy_courses")
    .select(COURSE_COLUMNS)
    .eq("therapist_id", opts.therapistId)
    .eq("avatar_id", opts.avatarId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (!isCourseSchemaMissing(error)) {
      console.warn("[therapy-course] load active:", error.message);
    }
    return { available: false };
  }
  return {
    available: true,
    course: data ? normalizeCourseRow(data as Record<string, unknown>) : null,
  };
}

export async function loadCourseById(
  supabase: SupabaseClient,
  courseId: string,
): Promise<TherapyCourse | null> {
  const { data, error } = await supabase
    .from("therapy_courses")
    .select(COURSE_COLUMNS)
    .eq("id", courseId)
    .maybeSingle();
  if (error) {
    if (!isCourseSchemaMissing(error)) {
      console.warn("[therapy-course] load:", error.message);
    }
    return null;
  }
  return data ? normalizeCourseRow(data as Record<string, unknown>) : null;
}

export type CourseSessionCounts = { total: number; completed: number };

export async function countCourseSessions(
  supabase: SupabaseClient,
  courseId: string,
): Promise<CourseSessionCounts | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("status")
    .eq("therapy_course_id", courseId);
  if (error) {
    console.warn("[therapy-course] count sessions:", error.message);
    return null;
  }
  const rows = (data ?? []) as Array<{ status: string }>;
  return {
    total: rows.length,
    completed: rows.filter(
      (r) => r.status === "completed" || r.status === "expired",
    ).length,
  };
}

export async function createCourse(
  supabase: SupabaseClient,
  opts: {
    therapistId: string;
    avatarId: string;
    caseInstanceId: string | null;
    snapshot: CaseInstanceSnapshot;
    language: string | null;
    maxDurationSec: number | null;
  },
): Promise<TherapyCourse | null> {
  // Never pin per-session course context onto the course's base snapshot.
  const base: CaseInstanceSnapshot = { ...opts.snapshot };
  delete base.therapy_course;
  const { data, error } = await supabase
    .from("therapy_courses")
    .insert({
      therapist_id: opts.therapistId,
      avatar_id: opts.avatarId,
      case_instance_id: opts.caseInstanceId,
      clinical_snapshot: base,
      language: opts.language,
      max_duration_sec: opts.maxDurationSec,
      status: "active",
      planned_sessions: DEFAULT_PLANNED_SESSIONS,
    })
    .select(COURSE_COLUMNS)
    .single();
  if (error || !data) {
    console.warn("[therapy-course] create:", error?.message ?? "no row");
    return null;
  }
  return normalizeCourseRow(data as Record<string, unknown>);
}

/** Close an active course. Returns false when nothing changed. */
export async function completeCourse(
  supabase: SupabaseClient,
  courseId: string,
  reason: TherapyCourseCompletionReason,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("therapy_courses")
    .update({
      status: "completed",
      completed_at: now,
      completion_reason: reason,
      updated_at: now,
    })
    .eq("id", courseId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("[therapy-course] complete:", error.message);
    return false;
  }
  return Boolean(data);
}
