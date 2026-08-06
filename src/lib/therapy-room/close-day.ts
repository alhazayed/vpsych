/**
 * Close a clinic day and persist the daily summary.
 * Shared by the close API and the end-of-day page.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAppointmentCard } from "./clinic-schedule";
import { buildDailyClinicSummary } from "./daily-summary";
import { chartSectionsForDifficulty } from "./chart-visibility";
import type { DailyClinicSummary } from "./types";
import type { CaseDifficulty } from "@/lib/case-engine/types";

export async function closeClinicDay(
  supabase: SupabaseClient,
  opts: { dayId: string; therapistId: string },
): Promise<
  | { ok: true; summary: DailyClinicSummary }
  | { ok: false; error: string; status: number }
> {
  const { data: day } = await supabase
    .from("clinic_days")
    .select("id, day_date, reflection_journal, therapist_id, summary, closed_at")
    .eq("id", opts.dayId)
    .maybeSingle();

  if (!day || day.therapist_id !== opts.therapistId) {
    return { ok: false, error: "Not found", status: 404 };
  }

  if (day.closed_at && day.summary) {
    return { ok: true, summary: day.summary as DailyClinicSummary };
  }

  const { data: appts } = await supabase
    .from("clinic_appointments")
    .select(
      "id, clinic_day_id, avatar_id, session_id, slot_index, scheduled_at, status, urgency, referral_source, session_number, difficulty, outstanding_tasks, avatars(name, disorder, portrait_url)",
    )
    .eq("clinic_day_id", opts.dayId)
    .order("slot_index");

  const cards = (appts ?? []).map((row) => {
    const avatar = (Array.isArray(row.avatars) ? row.avatars[0] : row.avatars) as {
      name: string;
      disorder: string;
      portrait_url: string | null;
    } | null;
    const difficulty = (row.difficulty ?? "intermediate") as CaseDifficulty;
    const showDx = chartSectionsForDifficulty(difficulty).includes("diagnosis");
    return {
      ...buildAppointmentCard({
        clinicDayId: row.clinic_day_id,
        avatarId: row.avatar_id,
        avatarName: avatar?.name ?? "Patient",
        portraitUrl: avatar?.portrait_url ?? null,
        slotIndex: row.slot_index,
        dayStartIso: row.scheduled_at,
        sessionId: row.session_id,
        status: row.status,
        diagnosis: showDx ? avatar?.disorder ?? null : null,
        difficulty,
        sessionNumber: row.session_number ?? 1,
        showDiagnosis: showDx,
        urgency: row.urgency,
      }),
      id: row.id as string,
    };
  });

  const summary = buildDailyClinicSummary({
    clinicDayId: opts.dayId,
    date: day.day_date,
    appointments: cards,
    reflectionJournal: day.reflection_journal ?? undefined,
  });

  const { error } = await supabase
    .from("clinic_days")
    .update({
      summary,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.dayId);

  if (error) {
    return { ok: false, error: "Could not close clinic day", status: 500 };
  }

  return { ok: true, summary };
}
