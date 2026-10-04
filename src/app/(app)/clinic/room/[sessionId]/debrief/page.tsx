import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";
import {
  buildSupervisorBriefing,
  resolvePatientNonverbal,
  type SupervisorBriefing,
} from "@/lib/therapy-room";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { SessionDebrief } from "@/components/therapy-room/SessionDebrief";
import { FinalizeSessionReport } from "@/components/FinalizeSessionReport";
import { shouldOfferReportFinalize } from "@/lib/session-finalize";

type Props = { params: Promise<{ sessionId: string }> };

export default async function ClinicDebriefPage({ params }: Props) {
  if (!isTherapyRoomEnabled()) redirect("/avatars");
  const { sessionId } = await params;
  const { supabase, user } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, therapist_id, status, clinical_snapshot, avatars(name, disorder)")
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

  const { data: messages } = await supabase
    .from("session_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .neq("role", "system")
    .order("created_at", { ascending: true });

  // Same self-heal as /sessions/[id]/complete: a room abandoned mid-session or
  // ended by expiry has no report (and no coach feedback) until /end runs.
  let needsReport = false;
  if (
    shouldOfferReportFinalize({
      status: session.status as string,
      therapistId: session.therapist_id as string,
      viewerId: user.id,
      roles: (messages ?? []).map((m) => m.role as string),
    })
  ) {
    const { data: hasReport, error: hasReportError } = await supabase.rpc(
      "session_has_report",
      { p_session_id: sessionId },
    );
    needsReport = !hasReportError && hasReport === false;
  }

  return (
    <>
      {needsReport ? (
        <div className="mx-auto max-w-2xl px-4 pt-6 md:px-8">
          <FinalizeSessionReport sessionId={sessionId} refreshOnDone />
        </div>
      ) : null}
      <SessionDebrief
        sessionId={sessionId}
        briefing={briefing}
        transcript={messages ?? []}
      />
    </>
  );
}
