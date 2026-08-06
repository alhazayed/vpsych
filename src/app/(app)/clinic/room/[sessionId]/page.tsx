import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isTherapyRoomModeEnabled } from "@/lib/therapy-room";

type Props = { params: Promise<{ sessionId: string }> };

/**
 * Canonical room lives at /sessions/[id].
 * Clinic visits stamp interaction_mode and redirect there.
 */
export default async function ClinicRoomPage({ params }: Props) {
  if (!isTherapyRoomModeEnabled()) redirect("/avatars");

  const { sessionId } = await params;
  const { supabase, user } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, therapist_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.therapist_id !== user.id) {
    notFound();
  }

  await supabase
    .from("sessions")
    .update({ interaction_mode: "therapy_room" })
    .eq("id", sessionId)
    .eq("therapist_id", user.id);

  if (session.status !== "active") {
    redirect(`/clinic/room/${sessionId}/debrief`);
  }

  redirect(`/sessions/${sessionId}`);
}
