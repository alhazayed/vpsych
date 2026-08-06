import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";
import {
  buildSupervisorBriefing,
  resolvePatientNonverbal,
  type SupervisorBriefing,
} from "@/lib/therapy-room";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { SupervisorOffice } from "@/components/therapy-room/SupervisorOffice";

type Props = { params: Promise<{ sessionId: string }> };

export default async function ClinicSupervisorPage({ params }: Props) {
  if (!isTherapyRoomEnabled()) redirect("/avatars");
  const { sessionId } = await params;
  const { supabase, user } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, therapist_id, clinical_snapshot, avatars(name, disorder)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.therapist_id !== user.id) {
    redirect("/clinic");
  }

  const avatarRaw = session.avatars as
    | { name: string; disorder: string }
    | { name: string; disorder: string }[]
    | null;
  const avatar = Array.isArray(avatarRaw) ? avatarRaw[0] : avatarRaw;
  const snapshot = session.clinical_snapshot as CaseInstanceSnapshot | null;

  const { data: lp } = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let coach = null;
  if (lp?.id) {
    const { data } = await supabase
      .from("coach_feedback")
      .select(
        "supervisor_feedback, reflective_questions, missed_opportunities, suggested_reading, suggested_next_cases, learning_goals, improvement_plan",
      )
      .eq("learner_id", lp.id)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    coach = data;
  }

  const nonverbal = resolvePatientNonverbal(
    snapshot,
    snapshot?.primary_diagnosis?.slug,
  );
  const briefing: SupervisorBriefing = buildSupervisorBriefing({
    sessionId,
    coach,
    nonverbal,
    patientDisplay: avatar?.name?.split(/\s+/)[0] ?? "Patient",
    diagnosisLabel:
      snapshot?.primary_diagnosis?.name ?? avatar?.disorder ?? null,
  });

  return <SupervisorOffice briefing={briefing} sessionId={sessionId} />;
}
