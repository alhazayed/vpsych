import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { assessSession } from "@/lib/ai/assessment";
import { runAceAfterAssessment } from "@/lib/ace/session-hook";
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

  const limited = await rateLimit(`end:${user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
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

  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
  });

  let reportLanguage = typed.language ?? null;
  if (!reportLanguage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle();
    reportLanguage = profile?.preferred_language ?? null;
  }
  reportLanguage = reportLanguage ?? resolved.locale;

  const assessment = await assessSession({
    avatar: resolved,
    messages: (messages ?? []) as Pick<
      SessionMessage,
      "role" | "content" | "created_at"
    >[],
    durationSec,
    language: reportLanguage,
  });

  console.info("[sessions/end] assessment", {
    sessionId,
    language: assessment.language,
    aiSource: assessment.aiSource,
    aiModel: assessment.model ?? null,
    errorKind: assessment.errorKind ?? null,
    failureDetail: assessment.failureDetail ?? null,
  });

  // Keep session.language aligned when it was missing at create time.
  if (!typed.language && assessment.language) {
    await supabase
      .from("sessions")
      .update({ language: assessment.language })
      .eq("id", sessionId);
  }

  const scoresJson = JSON.stringify(assessment.scores);
  const excerptsJson = JSON.stringify(assessment.excerpts);
  const narrative = assessment.narrative;

  // Adaptive Curriculum Engine — update learner competencies + next case
  const ace = await runAceAfterAssessment(supabase, {
    userId: user.id,
    sessionId,
    overall: assessment.scores.overall,
    items: assessment.scores.items,
    language: assessment.language ?? resolved.locale,
    diagnosisSlug: typed.clinical_snapshot?.primary_diagnosis?.slug ?? null,
    narrative,
    durationSec,
    timeLimitSec: typed.max_duration_sec,
  });

  const admin = createServiceClient();
  if (admin) {
    const { data: inserted, error: insertError } = await admin
      .from("session_reports")
      .insert({
        session_id: sessionId,
        scores: assessment.scores,
        narrative,
        excerpts: assessment.excerpts,
        language: assessment.language ?? resolved.locale,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      // Unique violation → already created (race); treat as success.
      if (insertError.code === "23505") {
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          aiSource: assessment.aiSource,
          aiModel: assessment.model ?? null,
          aiErrorKind: assessment.errorKind ?? null,
        });
      }
      console.warn("[session-end] report insert:", insertError.message);
      return NextResponse.json({ error: sanitizeDbError(insertError.message) }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        reportId: inserted?.id,
        // Additive — same AI pipeline provenance as conversation turns.
        aiSource: assessment.aiSource,
        aiModel: assessment.model ?? null,
        aiErrorKind: assessment.errorKind ?? null,
        adaptive: ace.ok
          ? {
              learnerId: ace.learnerId,
              nextCase: ace.nextCase,
              coachSummary: ace.coach?.supervisor_feedback ?? null,
            }
          : null,
      },
      {
        headers: {
          "X-AI-Source": assessment.aiSource,
          ...(assessment.model ? { "X-AI-Model": assessment.model } : {}),
          ...(assessment.errorKind
            ? { "X-AI-Error-Kind": assessment.errorKind }
            : {}),
        },
      },
    );
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
    console.warn("[session-end] sign:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Report signing failed" },
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
    console.warn("[session-end] report rpc:", rpcError.message);
    return NextResponse.json({ error: sanitizeDbError(rpcError.message) }, { status: 500 });
  }

  const privileged = createServiceClient();
  if (reportId && privileged) {
    await privileged
      .from("session_reports")
      .update({ language: resolved.locale })
      .eq("id", reportId);
  }

  return NextResponse.json(
    {
      ok: true,
      reportId,
      // Do not return report content to therapist — admin only
      aiSource: assessment.aiSource,
      aiModel: assessment.model ?? null,
      aiErrorKind: assessment.errorKind ?? null,
      adaptive: ace.ok
        ? {
            learnerId: ace.learnerId,
            nextCase: ace.nextCase,
            coachSummary: ace.coach?.supervisor_feedback ?? null,
          }
        : null,
    },
    {
      headers: {
        "X-AI-Source": assessment.aiSource,
        ...(assessment.model ? { "X-AI-Model": assessment.model } : {}),
        ...(assessment.errorKind
          ? { "X-AI-Error-Kind": assessment.errorKind }
          : {}),
      },
    },
  );
}
