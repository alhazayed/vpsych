import { notFound, redirect } from "next/navigation";
import { VoiceSession } from "@/components/VoiceSession";
import { requireProfile } from "@/lib/auth";
import type { SessionMessage, TherapySession } from "@/lib/types";

/** Fields safe to serialize into the voice client (no persona/rubric). */
type ClientAvatar = {
  id: string;
  name: string;
  disorder: string;
  age: number | null;
  gender: string | null;
  portrait_url: string | null;
};

type Props = { params: Promise<{ id: string }> };

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "*, avatars(id, name, disorder, age, gender, portrait_url)",
    )
    .eq("id", id)
    .single();

  if (!session) notFound();

  const typed = session as TherapySession & { avatars: ClientAvatar };
  if (typed.therapist_id !== user.id) {
    redirect("/avatars");
  }

  if (typed.status !== "active") {
    redirect(`/sessions/${id}/complete`);
  }

  const { data: messages } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  return (
    <VoiceSession
      session={typed}
      avatar={typed.avatars}
      initialMessages={(messages ?? []) as SessionMessage[]}
    />
  );
}
