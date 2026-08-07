import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { assessSession } from "@/lib/ai/assessment";
import { runEducationAfterAssessment } from "@/lib/education";
import { runPatientMemoryAfterSession } from "@/lib/patient-memory";
import { sealAssessmentQualityLedger } from "@/lib/quality-ledger";
import { rateLimit } from "@/lib/rate-limit";
import { signSessionReport, getReportWriteKey } from "@/lib/report-sign";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { runEnterpriseAfterAssessment } from "@/lib/enterprise";
import { runRealtimeAfterAssessment } from "@/lib/realtime";
import { runSupervisorAfterAssessment } from "@/lib/supervisor";
import { runValidationAfterAssessment } from "@/lib/validation";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

async function sealLedgerBestEffort(opts: {
  supabase: Parameters<typeof sealAssessmentQualityLedger>[0];
  sessionId: string;
  reportId: string | null | undefined;
  userId: string;
  assessment: Awaited<ReturnType<typeof assessSession>>;
  session: TherapySession;
  messages: Pick<SessionMessage, "role" | "content">[];
  durationSec: number;
  locale: string;
}): Promise<string | null> {
  try {
    const result = await sealAssessmentQualityLedger(opts.supabase, {
      sessionId: opts.sessionId,
      reportId: opts.reportId ?? null,
      learnerId: opts.userId,
      instructorId: opts.userId,
      assessment: opts.assessment,
      clinicalSnapshot: opts.session.clinical_snapshot ?? null,
      durationSec: opts.durationSec,
      messages: opts.messages,
      language: opts.assessment.language ?? opts.locale,
      locale: opts.locale,
      templateId: opts.session.clinical_snapshot?.template?.id ?? null,
      templateVersion: opts.session.clinical_snapshot?.template?.version ?? null,
      personaId: opts.session.avatar_id,
      presetId: opts.session.clinical_snapshot?.instructor_preset?.id ?? null,
      presetVersion:
        opts.session.clinical_snapshot?.instructor_preset?.version ?? null,
      createdBy: opts.userId,
    });
    if (result?.ok) return result.ledger.id;
    if (result) {
      console.warn("[sessions/end] quality ledger:", result.error);
    }
  } catch (e) {
    console.warn(
      "[sessions/end] quality ledger error:",
      e instanceof Error ? e.message : e,
    );
  }
  return null;
}

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
      console.warn("[session-end] status update:", updateError.message);
      return NextResponse.json(
        { error: sanitizeDbError(updateError.message) },
        { status: 500 },
      );
    }
    typed.status = expired ? "expired" : "completed";
    typed.ended_at = now.toISOString();
  }

  const { data: alreadyHasReport, error: hasErr } = await supabase.rpc(
    "session_has_report",
    { p_session_id: sessionId },
  );
  if (hasErr) {
    console.warn("[session-end] session_has_report:", hasErr.message);
    return NextResponse.json(
      { error: sanitizeDbError(hasErr.message) },
      { status: 500 },
    );
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

  // Stage 7 Education + ACE — best-effort; never blocks report; never touches patient mind.
  const education = await runEducationAfterAssessment(supabase, {
    userId: user.id,
    sessionId,
    overall: assessment.scores.overall,
    items: assessment.scores.items,
    messages: (messages ?? []) as Array<{ role: string; content: string }>,
    language: assessment.language ?? resolved.locale,
    diagnosisSlug: typed.clinical_snapshot?.primary_diagnosis?.slug ?? null,
    narrative,
    durationSec,
    timeLimitSec: typed.max_duration_sec,
    clinicalSnapshot: typed.clinical_snapshot ?? null,
  });

  // Stage 8 Scientific Validation — observational only; soft-fail; never touches patient mind.
  const validation = await runValidationAfterAssessment({
    sessionId,
    overall: assessment.scores.overall,
    items: assessment.scores.items,
    messages: (messages ?? []) as Array<{ role: string; content: string }>,
    narrative,
    excerpts: assessment.excerpts,
    language: assessment.language ?? resolved.locale,
    aiSource: assessment.aiSource,
    model: assessment.model ?? null,
    durationSec,
    clinicalSnapshot: typed.clinical_snapshot ?? null,
  });
  if (!validation.ok) {
    console.warn("[sessions/end] validation soft-fail:", validation.error);
  }

  // Stage 9 Supervisor AI — evaluates therapist only; soft-fail; never touches patient mind.
  const supervisor = await runSupervisorAfterAssessment(supabase, {
    userId: user.id,
    sessionId,
    overall: assessment.scores.overall,
    items: assessment.scores.items,
    messages: (messages ?? []) as Array<{ role: string; content: string }>,
    language: assessment.language ?? resolved.locale,
    narrative,
    diagnosisSlug: typed.clinical_snapshot?.primary_diagnosis?.slug ?? null,
    clinicalSnapshot: typed.clinical_snapshot ?? null,
    educationBundle: education.bundle,
    validationRun: validation.run,
  });
  if (!supervisor.ok) {
    console.warn("[sessions/end] supervisor soft-fail:", supervisor.error);
  }

  // Stage 10 Enterprise Platform — tenancy analytics only; soft-fail; never touches patient mind.
  const enterprise = await runEnterpriseAfterAssessment(supabase, {
    userId: user.id,
    sessionId,
    overall: assessment.scores.overall,
    organizationId: typed.institution_id ?? null,
  });
  if (!enterprise.ok) {
    console.warn("[sessions/end] enterprise soft-fail:", enterprise.error);
  }

  // Stage 11 Realtime — presentation metrics only; soft-fail; never touches patient mind.
  const realtime = await runRealtimeAfterAssessment(supabase, {
    userId: user.id,
    sessionId,
    locale: assessment.language ?? resolved.locale,
  });
  if (!realtime.ok) {
    console.warn("[sessions/end] realtime soft-fail:", realtime.error);
  }

  // Mission 4 — Long-Term Patient Memory (best-effort; never blocks report).
  const memoryWriter = createServiceClient() ?? supabase;
  const patientMemory = await runPatientMemoryAfterSession(memoryWriter, {
    therapistId: user.id,
    avatarId: typed.avatar_id,
    sessionId,
    messages: (messages ?? []) as Array<{
      role: string;
      content: string;
      created_at?: string;
    }>,
    startedAt: typed.started_at,
    endedAt: typed.ended_at,
    identity: resolved.personality?.identity ?? null,
  });
  if (!patientMemory.ok) {
    console.warn("[sessions/end] patient memory:", patientMemory.error);
  } else {
    console.info("[sessions/end] patient memory", {
      sessionId,
      addedCount: patientMemory.addedCount,
      compressed: patientMemory.compressed,
      persisted: patientMemory.persisted,
    });
  }

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

    const ledgerId = await sealLedgerBestEffort({
      supabase: admin,
      sessionId,
      reportId: inserted?.id,
      userId: user.id,
      assessment,
      session: typed,
      messages: (messages ?? []) as Pick<SessionMessage, "role" | "content">[],
      durationSec,
      locale: resolved.locale,
    });

    return NextResponse.json(
      educationEndPayload({
        reportId: inserted?.id,
        ledgerId,
        assessment,
        education,
        supervisor,
        enterprise,
        realtime,
      }),
      {
        headers: educationEndHeaders(
          assessment,
          ledgerId,
          validation.run?.id ?? null,
          supervisor.bundle?.session_id ?? null,
          enterprise.bundle?.context.organization_id ?? null,
          realtime.bundle?.version.realtime_version ?? null,
        ),
      },
    );
  }

  if (!getReportWriteKey()) {
    return NextResponse.json(
      { error: "Server misconfigured" },
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

  const ledgerId = await sealLedgerBestEffort({
    supabase: privileged ?? supabase,
    sessionId,
    reportId: typeof reportId === "string" ? reportId : null,
    userId: user.id,
    assessment,
    session: typed,
    messages: (messages ?? []) as Pick<SessionMessage, "role" | "content">[],
    durationSec,
    locale: resolved.locale,
  });

  return NextResponse.json(
    educationEndPayload({
      reportId,
      ledgerId,
      assessment,
      education,
      supervisor,
      enterprise,
      realtime,
    }),
    {
      headers: educationEndHeaders(
        assessment,
        ledgerId,
        validation.run?.id ?? null,
        supervisor.bundle?.session_id ?? null,
        enterprise.bundle?.context.organization_id ?? null,
        realtime.bundle?.version.realtime_version ?? null,
      ),
    },
  );
}

/** Additive education + ACE + supervisor + enterprise + realtime summary — never includes admin-only report body. */
function educationEndPayload(opts: {
  reportId: string | null | undefined;
  ledgerId: string | null;
  assessment: Awaited<ReturnType<typeof assessSession>>;
  education: Awaited<ReturnType<typeof runEducationAfterAssessment>>;
  supervisor: Awaited<ReturnType<typeof runSupervisorAfterAssessment>>;
  enterprise: Awaited<ReturnType<typeof runEnterpriseAfterAssessment>>;
  realtime: Awaited<ReturnType<typeof runRealtimeAfterAssessment>>;
}) {
  const {
    assessment,
    education,
    supervisor,
    enterprise,
    realtime,
    reportId,
    ledgerId,
  } = opts;
  const ace = education.ace;
  const bundle = education.bundle;
  const sup = supervisor.bundle;
  const ent = enterprise.bundle;
  const rt = realtime.bundle;
  return {
    ok: true as const,
    reportId,
    ledgerId,
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
    education: bundle
      ? {
          version: bundle.version,
          milestone: bundle.milestone,
          priorityImprovements: bundle.feedback.priority_improvements.slice(0, 5),
          missedOpportunities: bundle.evaluation.missed_opportunities.slice(0, 5),
          interviewCoverage: bundle.evaluation.coverage,
          diagnosticConfidence:
            bundle.diagnostic.supported_diagnoses[0]?.confidence ?? null,
          learningPath: bundle.learning_path_summary.slice(0, 5),
          plateau: education.longitudinal?.plateau_detected ?? null,
          regression: education.longitudinal?.regression_detected ?? null,
        }
      : null,
    supervisor: sup
      ? {
          version: sup.version,
          band: sup.feedback.primary.band,
          overallLevel: sup.competencies.overall_level,
          topRecommendations: sup.recommendations.slice(0, 5).map((r) => r.title),
          strengths: sup.expert_review.session_review.strengths.slice(0, 5),
          missedOpportunities:
            sup.expert_review.session_review.missed_opportunities.slice(0, 5),
          modalities: sup.expert_review.modalities_observed
            .filter((m) => m.modality !== "unknown")
            .slice(0, 3)
            .map((m) => m.modality),
          certificationProgress: sup.certification.progress_pct,
          boardReady: sup.certification.board_ready,
          reflectionQuestions: sup.reflective.reflection_questions.slice(0, 3),
        }
      : null,
    enterprise: ent
      ? {
          version: ent.version_lock.enterprise_version,
          organizationId: ent.context.organization_id,
          role: ent.context.membership_role,
          certificatesIssued: ent.certificates_issued.length,
          health: ent.observability?.health ?? null,
        }
      : null,
    realtime: rt
      ? {
          version: rt.version.realtime_version,
          connection: rt.session.connection,
          network: rt.session.network,
          latencyMs: rt.session.latencyMs,
          captionsEnabled: rt.accessibility.captions,
        }
      : null,
  };
}

function educationEndHeaders(
  assessment: Awaited<ReturnType<typeof assessSession>>,
  ledgerId: string | null,
  validationRunId: string | null = null,
  supervisorSessionId: string | null = null,
  enterpriseOrganizationId: string | null = null,
  realtimeVersion: string | null = null,
): Record<string, string> {
  return {
    "X-AI-Source": assessment.aiSource,
    ...(assessment.model ? { "X-AI-Model": assessment.model } : {}),
    ...(assessment.errorKind
      ? { "X-AI-Error-Kind": assessment.errorKind }
      : {}),
    ...(ledgerId ? { "X-Quality-Ledger-Id": ledgerId } : {}),
    // Validation reports remain admin-only; id is an observability breadcrumb.
    ...(validationRunId ? { "X-Validation-Run-Id": validationRunId } : {}),
    ...(supervisorSessionId
      ? { "X-Supervisor-Session-Id": supervisorSessionId }
      : {}),
    ...(enterpriseOrganizationId
      ? { "X-Enterprise-Org-Id": enterpriseOrganizationId }
      : {}),
    ...(realtimeVersion ? { "X-Realtime-Version": realtimeVersion } : {}),
  };
}
