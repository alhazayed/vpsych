import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomEnabled } from "@/lib/features";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { expireStaleSession } from "@/lib/session-expiry";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";
import { TherapyRoom } from "@/components/therapy-room/TherapyRoom";

type Props = { params: Promise<{ sessionId: string }> };

export default async function ClinicRoomPage({ params }: Props) {
  if (!isTherapyRoomEnabled()) redirect("/avatars");

  const { sessionId } = await params;
  const { supabase, user } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.therapist_id !== user.id) {
    redirect("/clinic");
  }

  if (await expireStaleSession(supabase, typed)) {
    redirect(`/clinic/room/${sessionId}/debrief`);
  }

  if (typed.status !== "active") {
    redirect(`/clinic/room/${sessionId}/debrief`);
  }

  const { data: messages } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const { data: appt } = await supabase
    .from("clinic_appointments")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();

  // Stamp ui_mode for resume routing when the column exists
  await supabase
    .from("sessions")
    .update({ ui_mode: "therapy_room" })
    .eq("id", sessionId)
    .eq("therapist_id", user.id);

  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
  });

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <TherapyRoom
        session={typed}
        avatar={resolved}
        initialMessages={(messages ?? []) as SessionMessage[]}
        appointmentId={appt?.id ?? null}
      />
    </Suspense>
  );
}
