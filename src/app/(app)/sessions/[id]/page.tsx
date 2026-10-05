import { notFound, redirect } from "next/navigation";
import { TherapyRoomSession } from "@/components/therapy-room/TherapyRoomSession";
import { requireProfile } from "@/lib/auth";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { expireStaleSession } from "@/lib/session-expiry";
import {
  examSpeechHint,
  traineeSafeAvatar,
  traineeSafeSession,
  withSkillTestCase,
} from "@/lib/skill-tests";
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

  // Skill test: an exam. The browser gets the patient's name, portrait and
  // voice, plus how they speak; the case, prompts and labels stay here.
  if (typed.skill_test_assignment_id) {
    const opened = withSkillTestCase(typed);
    const speechHint = examSpeechHint(
      opened.ok ? opened.session.clinical_snapshot : null,
    );
    return (
      <TherapyRoomSession
        session={traineeSafeSession(typed)}
        avatar={traineeSafeAvatar(resolved)}
        speechHint={speechHint}
        initialMessages={(messages ?? []) as SessionMessage[]}
        initialNotes={typed.private_notes ?? ""}
      />
    );
  }

  // The Therapy Room is the only session experience. Sessions started before
  // the classic screen was removed (interaction_mode = "classic") open here too.
  return (
    <TherapyRoomSession
      session={typed}
      avatar={resolved}
      initialMessages={(messages ?? []) as SessionMessage[]}
      initialNotes={typed.private_notes ?? ""}
    />
  );
}
