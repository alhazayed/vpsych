import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSupervisor } from "@/lib/skill-tests/access";
import { isUuid, openSealedCase } from "@/lib/skill-tests";
import { loadReportReviews } from "@/lib/supervisor-reviews";
import { logSecurityEvent } from "@/lib/security-audit";
import { ReportView } from "@/components/ReportView";
import { ReportReviewPanel } from "@/components/supervise/ReportReviewPanel";
import { SessionPracticePanel } from "@/components/admin/SessionPracticePanel";
import { CrisisHandlingPanel } from "@/components/admin/CrisisHandlingPanel";
import {
  buildIndicativeCtsr,
  buildScoreEvidence,
  caseHasRisk,
  deriveSelfReportProfile,
  evaluateCrisisHandling,
  evaluateSessionPractice,
  reportAssessmentMode,
} from "@/lib/session-practice";
import type { ClinicalCore, SessionMessage, SessionReport } from "@/lib/types";

type Props = { params: Promise<{ sessionId: string }> };

type SessionRow = {
  id: string;
  therapist_id: string;
  started_at: string;
  status: string;
  skill_test_assignment_id: string | null;
  sealed_case: string | null;
  course_session_number: number | null;
  clinical_snapshot: { clinical_core?: ClinicalCore | null } | null;
  profiles: { display_name: string } | null;
  avatars: { name: string } | null;
};

/**
 * One practice session report for a supervisor linked to the trainee (or an
 * admin), with the supervisor's review beside it. A skill test session opens
 * on its test results page instead. RLS enforces access on every query.
 */
export default async function SupervisedSessionPage({ params }: Props) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const { supabase, user } = await requireSupervisor();
  const t = await getTranslations("supervisorReviews.session");
  const tTranscript = await getTranslations("therapyRoom.transcript");
  const locale = await getLocale();

  const { data: row, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, therapist_id, started_at, status, skill_test_assignment_id, sealed_case, course_session_number, clinical_snapshot, profiles(display_name), avatars(name)",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw loadFailed("session", sessionId, sessionError);
  if (!row) notFound();
  const session = row as unknown as SessionRow;
  if (session.skill_test_assignment_id) {
    redirect(`/supervise/${session.skill_test_assignment_id}`);
  }

  await logSecurityEvent({
    action: "supervisor.report.view",
    outcome: "success",
    resourceType: "session_report",
    resourceId: sessionId,
  });

  const [
    { data: reportRow, error: reportError },
    { data: messageRows, error: messagesError },
    reviewsResult,
  ] = await Promise.all([
    supabase.from("session_reports").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase
      .from("session_messages")
      .select("id, session_id, role, content, created_at")
      .eq("session_id", sessionId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true }),
    loadReportReviews(supabase, [sessionId]),
  ]);
  if (reportError) throw loadFailed("report", sessionId, reportError);
  if (messagesError) throw loadFailed("transcript", sessionId, messagesError);
  const report = reportRow as SessionReport | null;
  const transcript = (messageRows ?? []) as SessionMessage[];

  // Ladder sessions keep the case sealed in the row; open it server-side for
  // the risk checks.
  const core =
    openSealedCase(session)?.clinical_core ?? session.clinical_snapshot?.clinical_core ?? null;
  const practice = evaluateSessionPractice({
    messages: transcript,
    sessionNumber: session.course_session_number,
    riskPresent: caseHasRisk(core?.risk_profile),
  });
  const items = report?.scores?.items ?? [];
  const ctsr = buildIndicativeCtsr({ items, practice });
  const evidence = buildScoreEvidence({
    items,
    messages: transcript,
    practice,
    assessmentMode: reportAssessmentMode(report?.scores),
  });
  const crisis = evaluateCrisisHandling(transcript);
  const selfReport = core ? deriveSelfReportProfile(core) : null;
  const traineeName = session.profiles?.display_name ?? "—";
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link
        href={`/supervise/trainees/${session.therapist_id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span className="material-symbols-outlined text-[18px] rtl:rotate-180" aria-hidden>
          arrow_back
        </span>
        {t("back", { name: traineeName })}
      </Link>
      <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
        {t("meta", {
          trainee: traineeName,
          patient: session.avatars?.name ?? "—",
          date: dateFmt.format(new Date(session.started_at)),
        })}
      </p>

      {report ? (
        <div className="mt-6 space-y-6">
          <ReportView report={report} evidence={evidence} audience="supervisor" />
          <ReportReviewPanel
            sessionId={sessionId}
            aiOverall={report.scores?.overall ?? 0}
            reviews={reviewsResult.reviews}
            loadFailed={reviewsResult.failed}
            currentUserId={user.id}
            canEdit
          />
        </div>
      ) : (
        <p className="clinical-card mt-6 p-5 text-sm text-[var(--on-surface-variant)]">
          {t("noReport")}
        </p>
      )}

      {transcript.length > 0 && (
        <div className="mt-6">
          <SessionPracticePanel practice={practice} ctsr={ctsr} selfReport={selfReport} />
        </div>
      )}
      {transcript.length > 0 && (crisis || caseHasRisk(core?.risk_profile)) && (
        <div className="mt-6">
          <CrisisHandlingPanel crisis={crisis} />
        </div>
      )}

      <details className="clinical-card mt-6 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          {t("transcript", { count: transcript.length })}
        </summary>
        {transcript.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">{tTranscript("empty")}</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {transcript.map((m) => (
              <li key={m.id}>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  {m.role === "user"
                    ? session.profiles?.display_name ?? t("traineeLabel")
                    : session.avatars?.name ?? tTranscript("patient")}
                </span>
                <span className="whitespace-pre-wrap" dir="auto">
                  {m.content}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </main>
  );
}

function loadFailed(what: string, sessionId: string, error: { message: string }): Error {
  console.error(`[supervise/session] ${what} load failed`, { sessionId, error: error.message });
  return new Error(`supervised_session_${what}_unavailable`);
}
