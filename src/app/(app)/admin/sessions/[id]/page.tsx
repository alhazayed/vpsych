import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  SessionDetailTabs,
  type SessionDetailMessage,
  type SessionDetailScoreItem,
} from "@/components/admin/SessionDetailTabs";
import {
  formatSessionDurationDisplay,
  isAdminTestClinicalSnapshot,
  sessionStatusTone,
} from "@/lib/admin/session-ops";
import type { MessageRole, SessionStatus } from "@/lib/types";

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.sessions");
  const tHome = await getTranslations("admin.home");
  const locale = await getLocale();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `
      id,
      status,
      started_at,
      ended_at,
      max_duration_sec,
      language,
      difficulty,
      therapy_modality,
      interaction_mode,
      case_instance_id,
      clinical_snapshot,
      immersion_metrics,
      profiles ( display_name ),
      avatars ( name, disorder ),
      institutions:institution_id ( name ),
      session_reports ( id, scores, narrative, language, created_at )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: messages } = await supabase
    .from("session_messages")
    .select("id, role, content, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const profile = session.profiles as unknown as {
    display_name: string;
  } | null;
  const avatar = session.avatars as unknown as {
    name: string;
    disorder: string;
  } | null;
  const institution = session.institutions as unknown as {
    name: string;
  } | null;
  const reports = session.session_reports as unknown as Array<{
    id: string;
    scores: {
      overall?: number;
      items?: SessionDetailScoreItem[];
    } | null;
    narrative: string | null;
    language: string | null;
    created_at: string;
  }> | null;
  const reportRow = Array.isArray(reports) ? reports[0] : null;

  const report = reportRow
    ? {
        id: reportRow.id,
        overall:
          typeof reportRow.scores?.overall === "number"
            ? reportRow.scores.overall
            : null,
        narrative: reportRow.narrative,
        items: Array.isArray(reportRow.scores?.items)
          ? reportRow.scores.items
          : [],
        language: reportRow.language,
        createdAt: reportRow.created_at,
      }
    : null;

  const status = session.status as SessionStatus;
  const statusLabel =
    status === "active"
      ? t("statusActive")
      : status === "completed"
        ? t("statusCompleted")
        : t("statusExpired");

  const duration = formatSessionDurationDisplay(
    status,
    session.started_at,
    session.ended_at,
    session.max_duration_sec ?? undefined,
  );
  const durationLabel =
    duration == null
      ? null
      : duration.label === "past_limit"
        ? t("durationPastLimit")
        : status === "active"
          ? t("durationElapsed", { duration: duration.label })
          : duration.label;

  const transcript: SessionDetailMessage[] = (messages ?? []).map((m) => ({
    id: m.id,
    role: m.role as MessageRole,
    content: m.content,
    created_at: m.created_at,
  }));

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={`${t("detailTitle")} #${session.id.slice(0, 8)}`}
        subtitle={`${profile?.display_name ?? t("unknownLearner")} · ${avatar?.name ?? t("unknownPatient")}`}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title"), href: "/admin/sessions" },
          { label: `#${session.id.slice(0, 8)}` },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={statusLabel}
              tone={sessionStatusTone(status)}
            />
            {report ? (
              <Link
                href={`/admin/reports/${session.id}`}
                className="btn-secondary"
              >
                {t("actionReport")}
              </Link>
            ) : null}
          </div>
        }
      />

      <SessionDetailTabs
        session={{
          id: session.id,
          status,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          language: session.language,
          learner: profile?.display_name ?? t("unknownLearner"),
          patient: avatar?.name ?? t("unknownPatient"),
          disorder: avatar?.disorder ?? "",
          organization: institution?.name ?? null,
          difficulty: session.difficulty,
          modality: session.therapy_modality,
          interactionMode: session.interaction_mode,
          isAdminTest: isAdminTestClinicalSnapshot(session.clinical_snapshot),
          caseInstanceId: session.case_instance_id,
          clinicalSnapshot: session.clinical_snapshot,
          immersionMetrics: session.immersion_metrics,
          durationLabel,
          durationStale: duration?.stale ?? false,
        }}
        messages={transcript}
        report={report}
        locale={locale}
        labels={{
          tabOverview: t("tabOverview"),
          tabConversation: t("tabConversation"),
          tabAssessment: t("tabAssessment"),
          tabReport: t("tabReport"),
          tabTechnical: t("tabTechnical"),
          sessionId: t("sessionId"),
          learner: t("colLearner"),
          organization: t("colOrganization"),
          scenario: t("colScenario"),
          virtualPatient: t("virtualPatient"),
          started: t("colStarted"),
          ended: t("ended"),
          duration: t("colDuration"),
          status: t("colStatus"),
          language: t("language"),
          difficulty: t("difficulty"),
          modality: t("modality"),
          interactionMode: t("interactionMode"),
          unassignedOrg: t("unassignedOrg"),
          statusActive: t("statusActive"),
          statusCompleted: t("statusCompleted"),
          statusExpired: t("statusExpired"),
          adminTest: t("adminTest"),
          simulationNotice: t("simulationNotice"),
          emptyConversation: t("emptyConversation"),
          roleSystem: t("roleSystem"),
          roleLearner: t("roleLearner"),
          rolePatient: t("rolePatient"),
          turns: t("turns", { count: transcript.length }),
          noAssessment: t("noAssessment"),
          noAssessmentHint: t("noAssessmentHint"),
          overall: t("overall"),
          rubric: t("rubric"),
          noReport: t("noReport"),
          noReportHint: t("noReportHint"),
          viewFullReport: t("viewFullReport"),
          narrative: t("narrative"),
          technicalIntro: t("technicalIntro"),
          caseInstance: t("caseInstance"),
          clinicalSnapshot: t("clinicalSnapshot"),
          immersion: t("immersion"),
          none: t("none"),
          staleBadge: t("staleBadge"),
        }}
      />
    </main>
  );
}
