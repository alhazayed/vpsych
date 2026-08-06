import { notFound, redirect } from "next/navigation";
import { VoiceSession } from "@/components/VoiceSession";
import { requireProfile } from "@/lib/auth";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { isHandsFreeTherapyEnabled } from "@/lib/conversation";
import { expireStaleSession } from "@/lib/session-expiry";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", id)
    .single();

  if (!session) notFound();

  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.therapist_id !== user.id) {
    redirect("/avatars");
  }

  if (await expireStaleSession(supabase, typed)) {
    redirect(`/sessions/${id}/complete`);
  }

  if (typed.status !== "active") {
    redirect(`/sessions/${id}/complete`);
  }

  const { data: messages } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
  });

  return (
    <VoiceSession
      session={typed}
      avatar={resolved}
      initialMessages={(messages ?? []) as SessionMessage[]}
      handsFreeEnabled={isHandsFreeTherapyEnabled()}
    />
  );
}
