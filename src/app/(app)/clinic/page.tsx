import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomModeEnabled } from "@/lib/therapy-room";
import {
  buildAppointmentCard,
  chartSectionsForDifficulty,
  clinicDayDateKey,
  urgencyFromRisk,
} from "@/lib/therapy-room";
import type { CaseDifficulty } from "@/lib/case-engine/types";
import type { ClinicAppointmentCard } from "@/lib/therapy-room";
import { ClinicDashboard } from "@/components/therapy-room/ClinicDashboard";

async function ensureClinicDay(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  userId: string,
) {
  const dayKey = clinicDayDateKey();
  const { data: existing } = await supabase
    .from("clinic_days")
    .select("id, day_date, summary, reflection_journal, closed_at")
    .eq("therapist_id", userId)
    .eq("day_date", dayKey)
    .maybeSingle();

  let clinicDayId = existing?.id as string | undefined;
  let dayRow = existing;

  if (!clinicDayId) {
    const { data: created } = await supabase
      .from("clinic_days")
      .insert({ therapist_id: userId, day_date: dayKey })
      .select("id, day_date, summary, reflection_journal, closed_at")
      .single();
    if (!created) return null;
    clinicDayId = created.id;
    dayRow = created;

    const { data: avatars } = await supabase
      .from("avatars")
      .select("id, name, disorder, portrait_url, clinical_core")
      .eq("is_active", true)
      .order("name")
      .limit(6);

    const dayStart = `${dayKey}T09:00:00.000Z`;
    const rows = (avatars ?? []).map((av, index) => {
      const core = av.clinical_core as
        | { risk_profile?: { suicidal_ideation?: string } }
        | null;
      const difficulty: CaseDifficulty =
        index === 0 ? "beginner" : index >= 4 ? "advanced" : "intermediate";
      return {
        clinic_day_id: clinicDayId,
        therapist_id: userId,
        avatar_id: av.id,
        slot_index: index,
        scheduled_at: new Date(
          new Date(dayStart).getTime() + index * 50 * 60 * 1000,
        ).toISOString(),
        status: "scheduled",
        urgency: urgencyFromRisk(core?.risk_profile?.suicidal_ideation),
        referral_source: [
          "Primary care referral",
          "Self-referral",
          "Emergency department",
          "Student health",
          "Occupational health",
          "Family physician",
        ][index % 6],
        session_number: 1,
        difficulty,
        outstanding_tasks: ["Review referral", "Confirm identity"],
      };
    });
    if (rows.length) {
      await supabase.from("clinic_appointments").insert(rows);
    }
  }

  const { data: appts } = await supabase
    .from("clinic_appointments")
    .select(
      "id, clinic_day_id, avatar_id, session_id, slot_index, scheduled_at, status, urgency, referral_source, session_number, difficulty, outstanding_tasks, avatars(name, disorder, portrait_url)",
    )
    .eq("clinic_day_id", clinicDayId)
    .order("slot_index", { ascending: true });

  const cards: ClinicAppointmentCard[] = (appts ?? []).map((row) => {
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
        outstandingTasks: Array.isArray(row.outstanding_tasks)
          ? (row.outstanding_tasks as string[])
          : [],
        showDiagnosis: showDx,
        urgency: row.urgency,
      }),
      id: row.id as string,
      scheduledAt: row.scheduled_at as string,
      referralSource: row.referral_source as string,
    };
  });

  const { data: lp } = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  let unread = 0;
  if (lp?.id) {
    const { count } = await supabase
      .from("coach_feedback")
      .select("id", { count: "exact", head: true })
      .eq("learner_id", lp.id);
    unread = count ?? 0;
  }

  return {
    clinicDay: {
      id: clinicDayId!,
      date: dayKey,
      closedAt: dayRow?.closed_at ?? null,
      summary: dayRow?.summary ?? null,
      reflectionJournal: dayRow?.reflection_journal ?? null,
    },
    appointments: cards,
    unreadSupervisorMessages: unread,
    outstandingTasks: cards.flatMap((a) =>
      a.status === "scheduled" || a.status === "checked_in"
        ? a.outstandingTasks.map((t) => `${a.patientDisplay}: ${t}`)
        : [],
    ),
  };
}

export default async function ClinicPage() {
  if (!isTherapyRoomModeEnabled()) {
    redirect("/avatars");
  }
  const { supabase, user } = await requireProfile();
  const initial = await ensureClinicDay(supabase, user.id);
  if (!initial) {
    redirect("/avatars");
  }
  return <ClinicDashboard initial={initial} />;
}
