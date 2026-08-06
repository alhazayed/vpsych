import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomModeEnabled } from "@/lib/therapy-room";
import {
  buildAppointmentCard,
  buildPreSessionChart,
  chartSectionsForDifficulty,
  urgencyFromRisk,
} from "@/lib/therapy-room";
import type { CaseDifficulty, CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { PreSessionChartView } from "@/components/therapy-room/PreSessionChartView";

type Props = { params: Promise<{ appointmentId: string }> };

export default async function ClinicChartPage({ params }: Props) {
  if (!isTherapyRoomModeEnabled()) redirect("/avatars");

  const { appointmentId } = await params;
  const { supabase, user } = await requireProfile();

  const { data: appt } = await supabase
    .from("clinic_appointments")
    .select(
      "id, clinic_day_id, avatar_id, session_id, slot_index, scheduled_at, status, urgency, referral_source, session_number, difficulty, outstanding_tasks, avatars(id, name, disorder, portrait_url, clinical_core)",
    )
    .eq("id", appointmentId)
    .eq("therapist_id", user.id)
    .maybeSingle();

  if (!appt) notFound();

  const avatar = (Array.isArray(appt.avatars) ? appt.avatars[0] : appt.avatars) as {
    id: string;
    name: string;
    disorder: string;
    portrait_url: string | null;
    clinical_core: { risk_profile?: { suicidal_ideation?: string } } | null;
  } | null;

  const difficulty = (appt.difficulty ?? "intermediate") as CaseDifficulty;
  const showDx = chartSectionsForDifficulty(difficulty).includes("diagnosis");

  const card = {
    ...buildAppointmentCard({
      clinicDayId: appt.clinic_day_id,
      avatarId: appt.avatar_id,
      avatarName: avatar?.name ?? "Patient",
      portraitUrl: avatar?.portrait_url ?? null,
      slotIndex: appt.slot_index,
      dayStartIso: appt.scheduled_at,
      sessionId: appt.session_id,
      status: appt.status,
      diagnosis: showDx ? avatar?.disorder ?? null : null,
      difficulty,
      sessionNumber: appt.session_number ?? 1,
      outstandingTasks: Array.isArray(appt.outstanding_tasks)
        ? (appt.outstanding_tasks as string[])
        : [],
      showDiagnosis: showDx,
      urgency:
        appt.urgency ??
        urgencyFromRisk(avatar?.clinical_core?.risk_profile?.suicidal_ideation),
    }),
    id: appt.id as string,
    referralSource: appt.referral_source as string,
    scheduledAt: appt.scheduled_at as string,
  };

  // Prefer live snapshot if a prior session exists on this appointment
  let snapshot: CaseInstanceSnapshot | null = null;
  if (appt.session_id) {
    const { data: sess } = await supabase
      .from("sessions")
      .select("clinical_snapshot")
      .eq("id", appt.session_id)
      .maybeSingle();
    snapshot = (sess?.clinical_snapshot as CaseInstanceSnapshot) ?? null;
  }

  const chart = buildPreSessionChart({
    appointment: card,
    snapshot,
    disorderLabel: avatar?.disorder,
  });

  return (
    <PreSessionChartView
      appointmentId={appt.id}
      avatarId={appt.avatar_id}
      difficulty={difficulty}
      chart={chart}
    />
  );
}
