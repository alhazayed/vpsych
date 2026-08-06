import { notFound, redirect } from "next/navigation";
import { VoiceSession } from "@/components/VoiceSession";
import { requireProfile } from "@/lib/auth";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { shouldHideGroundTruth } from "@/lib/exam-disclosure";
import { expireStaleSession } from "@/lib/session-expiry";
import type {
  Avatar,
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

type Props = { params: Promise<{ id: string }> };

/**
 * CQG-012: strip exam ground truth from therapist-facing client props.
 * Keep instructor_preset feedback/grading flags so the UI still knows to hide
 * presentation labels, without shipping diagnosis / prompts / goals.
 */
function redactForExam(
  session: TherapySession & { avatars: Avatar },
  avatar: ResolvedAvatar,
): {
  session: TherapySession & { avatars: Avatar };
  avatar: ResolvedAvatar;
} {
  if (!shouldHideGroundTruth(session.clinical_snapshot)) {
    return { session, avatar };
  }
  const preset = session.clinical_snapshot?.instructor_preset;
  const redactedSnapshot = preset
    ? ({
        instructor_preset: {
          id: preset.id,
          slug: preset.slug,
          version: preset.version,
          name: preset.name,
          primary_objective: preset.primary_objective,
          secondary_objectives: [],
          target_learner: preset.target_learner,
          assessment_type: preset.assessment_type,
          grading_mode: preset.grading_mode,
          feedback_mode: preset.feedback_mode,
          time_limit_minutes: preset.time_limit_minutes,
          allow_hints: preset.allow_hints,
          allow_pause: preset.allow_pause,
          allow_restart: preset.allow_restart,
          voice_enabled: preset.voice_enabled,
        },
      } as unknown as CaseInstanceSnapshot)
    : null;

  const redactedSession: TherapySession & { avatars: Avatar } = {
    ...session,
    clinical_snapshot: redactedSnapshot,
  };
  const redactedAvatar: ResolvedAvatar = {
    ...avatar,
    disorder: "",
    system_prompt: "",
    persona_prompt: "",
    clinical_core: undefined,
    ideal_guidelines: {
      session_goals: [],
      ideal_approach: "",
    },
    rubric: [],
  };
  return { session: redactedSession, avatar: redactedAvatar };
}

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
  const { session: clientSession, avatar: clientAvatar } = redactForExam(
    typed,
    resolved,
  );

  return (
    <VoiceSession
      session={clientSession}
      avatar={clientAvatar}
      initialMessages={(messages ?? []) as SessionMessage[]}
    />
  );
}
