import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReportView } from "@/components/ReportView";
import { FallbackReportNotice } from "@/components/admin/FallbackReportNotice";
import { isHeuristicReportScores } from "@/lib/admin/report-regenerate";
import { requireAdmin } from "@/lib/auth";
import { throwOnLoadError } from "@/lib/admin/page-load";
import { logSecurityEvent } from "@/lib/security-audit";
import { SessionPracticePanel } from "@/components/admin/SessionPracticePanel";
import {
  buildIndicativeCtsr,
  caseHasRisk,
  deriveSelfReportProfile,
  evaluateSessionPractice,
  profileFromCourseSelfReport,
} from "@/lib/session-practice";
import type {
  ClinicalCore,
  CourseSelfReport,
  SessionReport,
  TherapyCourseSessionContext,
} from "@/lib/types";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminReportDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.reportDetail");

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
    clinical_snapshot: {
      clinical_core?: ClinicalCore | null;
      therapy_course?: TherapyCourseSessionContext | null;
    } | null;
    therapy_course_id: string | null;
    course_session_number: number | null;
    profiles: { display_name: string } | null;
    avatars: { name: string; disorder: string } | null;
  } | null;

  const { data: messages } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const core = session?.clinical_snapshot?.clinical_core ?? null;
  const practice = evaluateSessionPractice({
    messages: (messages ?? []) as Array<{ role: string; content: string }>,
    sessionNumber: session?.course_session_number ?? null,
    riskPresent: caseHasRisk(core?.risk_profile),
  });
  const ctsr = buildIndicativeCtsr({
    items: (report as SessionReport).scores?.items ?? [],
    practice,
  });
  const courseSelfReport = session?.clinical_snapshot?.therapy_course?.self_report;
  const selfReport = courseSelfReport
    ? profileFromCourseSelfReport(courseSelfReport)
    : core
      ? deriveSelfReportProfile(core)
      : null;

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
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t("back")}
      </Link>
      <p className="mt-4 text-sm text-[var(--on-surface-variant)]">
        {t("meta", {
          therapist: session?.profiles?.display_name ?? "—",
          patient: session?.avatars?.name ?? "—",
          disorder: session?.avatars?.disorder ?? "—",
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
        <ReportView report={report as SessionReport} />
      </div>
      <div className="mt-6">
        <SessionPracticePanel
          practice={practice}
          ctsr={ctsr}
          selfReport={selfReport}
          trajectory={trajectory}
          currentSessionNumber={session?.course_session_number ?? null}
        />
      </div>
    </main>
  );
}
