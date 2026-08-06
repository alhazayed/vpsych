import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTherapyRoomModeEnabled } from "@/lib/therapy-room";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  buildSupervisorBriefing,
  resolvePatientNonverbal,
} from "@/lib/therapy-room";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { TherapySession } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

/**
 * Educational supervisor meeting payload.
 * Uses ACE coach_feedback + deterministic nonverbal profile.
 * Never returns session_reports (admin-only).
 */
export async function GET(_request: Request, { params }: Props) {
  if (!isTherapyRoomModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`supervisor:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, therapist_id, clinical_snapshot, avatars(name, disorder)")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.therapist_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const typed = session as unknown as Pick<
    TherapySession,
    "id" | "therapist_id" | "clinical_snapshot"
  > & {
    avatars: { name: string; disorder: string } | { name: string; disorder: string }[] | null;
  };
  const avatarRow = Array.isArray(typed.avatars) ? typed.avatars[0] : typed.avatars;

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
      .eq("session_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    coach = data;
  }

  const snapshot = typed.clinical_snapshot as CaseInstanceSnapshot | null;
  const nonverbal = resolvePatientNonverbal(
    snapshot,
    snapshot?.primary_diagnosis?.slug,
  );

  try {
    const briefing = buildSupervisorBriefing({
      sessionId: id,
      coach,
      nonverbal,
      patientDisplay: avatarRow?.name?.split(/\s+/)[0] ?? "Patient",
      diagnosisLabel:
        snapshot?.primary_diagnosis?.name ?? avatarRow?.disorder ?? null,
    });

    const { data: messages } = await supabase
      .from("session_messages")
      .select("id, role, content, created_at")
      .eq("session_id", id)
      .neq("role", "system")
      .order("created_at", { ascending: true });

    return NextResponse.json({
      briefing,
      transcript: messages ?? [],
      // Explicitly withhold admin report fields
      report: null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: clientSafeError("Supervisor unavailable", e instanceof Error ? e : null) },
      { status: 500 },
    );
  }
}
