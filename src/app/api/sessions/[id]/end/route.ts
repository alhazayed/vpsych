import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { assessSession } from "@/lib/ai/assessment";
import { rateLimit } from "@/lib/rate-limit";
import { signSessionReport, getReportWriteKey } from "@/lib/report-sign";
import { resolveAvatar } from "@/lib/avatars/resolve";
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

  const limited = rateLimit(`end:${user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
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
    typed.status = expired ? "expired" : "completed";
    typed.ended_at = now.toISOString();
  }

  const { data: alreadyHasReport, error: hasErr } = await supabase.rpc(
    "session_has_report",
    { p_session_id: sessionId },
  );
  if (hasErr) {
    return NextResponse.json({ error: hasErr.message }, { status: 500 });
  }
  if (alreadyHasReport) {
    return NextResponse.json({ ok: true, alreadyExists: true });
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

  const resolved = resolveAvatar(typed.avatars, typed.language);

  const assessment = await assessSession({
    avatar: resolved,
    messages: (messages ?? []) as Pick<
      SessionMessage,
      "role" | "content" | "created_at"
    >[],
    durationSec,
  });

  const scoresJson = JSON.stringify(assessment.scores);
  const excerptsJson = JSON.stringify(assessment.excerpts);
  const narrative = assessment.narrative;

  const admin = createServiceClient();
  if (admin) {
    const { data: inserted, error: insertError } = await admin
      .from("session_reports")
      .insert({
        session_id: sessionId,
        scores: assessment.scores,
        narrative,
        excerpts: assessment.excerpts,
        language: resolved.locale,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      // Unique violation → already created (race); treat as success.
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, alreadyExists: true });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      reportId: inserted?.id,
    });
  }

  if (!getReportWriteKey()) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: set REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 500 },
    );
  }

  let sig: string;
  try {
    sig = signSessionReport({
      sessionId,
      narrative,
      scoresJson,
      excerptsJson,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Signing failed" },
      { status: 500 },
    );
  }

  const { data: reportId, error: rpcError } = await supabase.rpc(
    "create_session_report",
    {
      p_session_id: sessionId,
      p_scores_json: scoresJson,
      p_narrative: narrative,
      p_excerpts_json: excerptsJson,
      p_sig: sig,
    },
  );

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const privileged = createServiceClient();
  if (reportId && privileged) {
    await privileged
      .from("session_reports")
      .update({ language: resolved.locale })
      .eq("id", reportId);
  }

  return NextResponse.json({
    ok: true,
    reportId,
    // Do not return report content to therapist — admin only
  });
}
