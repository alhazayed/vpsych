import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReportView } from "@/components/ReportView";
import { NumberedTranscript } from "@/components/NumberedTranscript";
import { numberTranscriptTurns } from "@/lib/sessions/transcript-turns";
import { FallbackReportNotice } from "@/components/admin/FallbackReportNotice";
import { isHeuristicReportScores } from "@/lib/admin/report-regenerate";
import { requireAdmin } from "@/lib/auth";
import { throwOnLoadError } from "@/lib/admin/page-load";
import { logSecurityEvent } from "@/lib/security-audit";
import { SessionPracticePanel } from "@/components/admin/SessionPracticePanel";
import { extractAdaptationFromMemory } from "@/lib/adaptation";
import { AllianceRatingPanel } from "@/components/admin/AllianceRatingPanel";
import { CrisisHandlingPanel } from "@/components/admin/CrisisHandlingPanel";
import { ReportReviewPanel } from "@/components/supervise/ReportReviewPanel";
import { loadReportReviews } from "@/lib/supervisor-reviews";
import {
  buildAllianceRating,
  buildIndicativeCtsr,
  buildScoreEvidence,
  caseHasRisk,
  deriveSelfReportProfile,
  evaluateCrisisHandling,
  evaluateSessionPractice,
  profileFromCourseSelfReport,
  reportAssessmentMode,
  type AllianceRating,
} from "@/lib/session-practice";
import { openSealedCase } from "@/lib/skill-tests";
import { disorderNameText } from "@/lib/sessions/diagnosis-label";
import type {
  ClinicalCore,
  CourseSelfReport,
  SessionReport,
  TherapyCourseSessionContext,
} from "@/lib/types";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminReportDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const { supabase, user } = await requireAdmin();
  const t = await getTranslations("admin.reportDetail");
  const tTranscript = await getTranslations("therapyRoom.transcript");
  const tTranscriptSummary = await getTranslations("supervisorReviews.session");
  const tDisorders = await getTranslations("skillTests.disorders");
  const tDefaultDisorders = await getTranslations("avatars.defaultDisorders");

  const { data: report, error: reportError } = await supabase
    .from("session_reports")
    .select(
      `
      *,
      sessions (
        id,
        started_at,
        ended_at,
        status,
        clinical_snapshot,
        case_instance_id,
        skill_test_assignment_id,
        sealed_case,
        therapy_course_id,
        course_session_number,
        profiles ( display_name ),
        avatars ( name, disorder )
      )
    `,
    )
    .eq("session_id", sessionId)
    .maybeSingle();
  throwOnLoadError(reportError, "admin-report");

  if (!report) notFound();

  await logSecurityEvent({
    action: "admin.report.view",
    outcome: "success",
    resourceType: "session_report",
    resourceId: sessionId,
  });

  const session = report.sessions as unknown as {
    id: string;
    started_at: string;
    ended_at: string | null;
    case_instance_id: string | null;
    clinical_snapshot: {
      primary_diagnosis?: { slug?: string | null; name?: string | null } | null;
      clinical_core?: ClinicalCore | null;
      therapy_course?: TherapyCourseSessionContext | null;
    } | null;
    skill_test_assignment_id: string | null;
    sealed_case: string | null;
    therapy_course_id: string | null;
    course_session_number: number | null;
    profiles: { display_name: string } | null;
    avatars: { name: string; disorder: string } | null;
  } | null;

  // Supervisor reviews sit beside the AI report; a load failure is shown on
  // the panel and never hides the report.
  const reviewsResult = await loadReportReviews(supabase, [sessionId]);

  const { data: messages, error: messagesError } = await supabase
    .from("session_messages")
    .select("id, role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  throwOnLoadError(messagesError, "admin-report-transcript");
  // Numbered as the examiner numbered them, so evidence links land on the turn.
  const turns = numberTranscriptTurns(
    (messages ?? []) as Array<{ id: string; role: string; content: string }>,
  );

  // Skill test and ladder sessions keep the case sealed in the row; open it
  // for admins.
  const testCase = session ? openSealedCase(session) : null;
  const core =
    testCase?.clinical_core ?? session?.clinical_snapshot?.clinical_core ?? null;
  // The session's own case (opened for skill tests), not the avatar's default.
  // Admins see it for skill tests too.
  const primaryDx =
    testCase?.primary_diagnosis ?? session?.clinical_snapshot?.primary_diagnosis;
  const diagnosis =
    (primaryDx?.slug && tDisorders.has(primaryDx.slug)
      ? tDisorders(primaryDx.slug)
      : disorderNameText(
          primaryDx?.name ?? session?.avatars?.disorder,
          tDisorders,
          tDefaultDisorders,
        )) ?? "—";
  const practice = evaluateSessionPractice({
    messages: (messages ?? []) as Array<{ role: string; content: string }>,
    sessionNumber: session?.course_session_number ?? null,
    riskPresent: caseHasRisk(core?.risk_profile),
  });
  const ctsr = buildIndicativeCtsr({
    items: (report as SessionReport).scores?.items ?? [],
    practice,
  });
  const evidence = buildScoreEvidence({
    items: (report as SessionReport).scores?.items ?? [],
    messages: (messages ?? []) as Array<{ role: string }>,
    practice,
    assessmentMode: reportAssessmentMode(report.scores),
  });
  const crisis = evaluateCrisisHandling(
    (messages ?? []) as Array<{ role: string; content: string }>,
  );
  const showCrisis = crisis !== null || caseHasRisk(core?.risk_profile);
  const courseSelfReport = session?.clinical_snapshot?.therapy_course?.self_report;
  const selfReport = courseSelfReport
    ? profileFromCourseSelfReport(courseSelfReport)
    : core
      ? deriveSelfReportProfile(core)
      : null;

  // How the session felt to the patient, from the adaptation engine's trace.
  let alliance: AllianceRating | null = null;
  if (session?.case_instance_id) {
    const { data: memoryRow } = await supabase
      .from("case_memory")
      .select("memory")
      .eq("case_instance_id", session.case_instance_id)
      .maybeSingle();
    alliance = buildAllianceRating({
      state: extractAdaptationFromMemory(memoryRow?.memory),
      startedAt: session.started_at,
      endedAt: session.ended_at,
    });
  }

  // Measurement-based care: questionnaire targets across the therapy course.
  let trajectory: Array<{ n: number; phq9: number; gad7: number }> = [];
  if (session?.therapy_course_id) {
    const { data: courseSessions } = await supabase
      .from("sessions")
      .select("course_session_number, self_report:clinical_snapshot->therapy_course->self_report")
      .eq("therapy_course_id", session.therapy_course_id)
      .order("course_session_number", { ascending: true });
    trajectory = ((courseSessions ?? []) as Array<{
      course_session_number: number | null;
      self_report: CourseSelfReport | null;
    }>)
      .filter((r) => r.course_session_number && r.self_report)
      .map((r) => {
        const p = profileFromCourseSelfReport(r.self_report!);
        return { n: r.course_session_number!, phq9: p.phq9.total, gad7: p.gad7.total };
      });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link
        href="/admin/reports"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <span
          className="material-symbols-outlined text-[18px] rtl:rotate-180"
          aria-hidden
        >
          arrow_back
        </span>
        {t("back")}
      </Link>
      <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
        {t("meta", {
          therapist: session?.profiles?.display_name ?? "—",
          patient: session?.avatars?.name ?? "—",
          disorder: diagnosis,
        })}
        {(report as SessionReport).language
          ? ` · ${(report as SessionReport).language}`
          : ""}
      </p>
      {isHeuristicReportScores(report.scores) ? (
        <div className="mt-6">
          <FallbackReportNotice sessionId={sessionId} />
        </div>
      ) : null}
      <div className="mt-6">
        <ReportView report={report as SessionReport} evidence={evidence} linkTurns />
      </div>
      <div className="mt-6">
        <ReportReviewPanel
          sessionId={sessionId}
          aiOverall={(report as SessionReport).scores?.overall ?? 0}
          reviews={reviewsResult.reviews}
          loadFailed={reviewsResult.failed}
          currentUserId={user.id}
          canEdit={false}
        />
      </div>
      <div className="mt-6">
        <AllianceRatingPanel rating={alliance} />
      </div>
      {showCrisis ? (
        <div className="mt-6">
          <CrisisHandlingPanel crisis={crisis} />
        </div>
      ) : null}
      <div className="mt-6">
        <SessionPracticePanel
          practice={practice}
          ctsr={ctsr}
          selfReport={selfReport}
          trajectory={trajectory}
          currentSessionNumber={session?.course_session_number ?? null}
        />
      </div>
      <div className="mt-6">
        <NumberedTranscript
          turns={turns}
          summary={tTranscriptSummary("transcript", { count: turns.length })}
          traineeLabel={session?.profiles?.display_name ?? tTranscriptSummary("traineeLabel")}
          patientLabel={session?.avatars?.name ?? tTranscript("patient")}
          emptyLabel={tTranscript("empty")}
        />
      </div>
    </main>
  );
}
