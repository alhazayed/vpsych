import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { requireProfile } from "@/lib/auth";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { expireStaleSession } from "@/lib/session-expiry";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

const VoiceSession = dynamic(
  () =>
    import("@/components/VoiceSession").then((m) => ({
      default: m.VoiceSession,
    })),
  {
    loading: () => (
      <main className="mx-auto flex min-h-[50vh] max-w-[960px] items-center justify-center px-4">
        <p className="text-sm text-[var(--on-surface-variant)]">
          Loading session…
        </p>
      </main>
    ),
  },
);

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
    .select("id, role, content, created_at, session_id")
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
    />
  );
}
