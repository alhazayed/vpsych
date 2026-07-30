import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assessSession } from "@/lib/ai/assessment";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, avatars(*)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.therapist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (typed.status === "active") {
    const now = new Date();
    const elapsedSec = Math.floor(
      (now.getTime() - new Date(typed.started_at).getTime()) / 1000,
    );
    const expired = elapsedSec >= typed.max_duration_sec;
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: expired ? "expired" : "completed",
        ended_at: now.toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  // Therapists cannot SELECT reports (admin-only RLS), so this check only
  // short-circuits for admins. Prefer insert-once RPC (see supabase/migrations)
  // so repeated /end calls do not overwrite scores.
  const { data: existing } = await supabase
    .from("session_reports")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      reportId: existing.id,
      alreadyExists: true,
    });
  }

  const { data: messages } = await supabase
    .from("session_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const endedAt = typed.ended_at ?? new Date().toISOString();
  const durationSec = Math.floor(
    (new Date(endedAt).getTime() - new Date(typed.started_at).getTime()) / 1000,
  );

  const assessment = await assessSession({
    avatar: typed.avatars,
    messages: (messages ?? []) as Pick<
      SessionMessage,
      "role" | "content" | "created_at"
    >[],
    durationSec,
  });

  const { data: reportId, error: rpcError } = await supabase.rpc(
    "create_session_report",
    {
      p_session_id: sessionId,
      p_scores: assessment.scores,
      p_narrative: assessment.narrative,
      p_excerpts: assessment.excerpts,
    },
  );

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reportId,
    // Do not return report content to therapist — admin only
  });
}
