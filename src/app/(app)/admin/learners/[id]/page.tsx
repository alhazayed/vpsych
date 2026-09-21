import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { MetricCard } from "@/components/admin/AdminUi";
import { LearnerDetailTabs } from "@/components/admin/LearnerDetailTabs";
import {
  aggregateSessionStats,
  type LearnerSessionStats,
} from "@/lib/admin/learner-ops";
import {
  formatSessionDurationDisplay,
  isAdminTestClinicalSnapshot,
  type AdminSessionListRow,
} from "@/lib/admin/session-ops";
import type { SessionStatus } from "@/lib/types";

export default async function AdminLearnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.learners");
  const tHome = await getTranslations("admin.home");
  const tSessions = await getTranslations("admin.sessions");
  const locale = await getLocale();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, role, preferred_language, primary_institution_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const [
    { data: institution },
    { data: membership },
    { data: sessions },
    { data: aceProfile },
  ] = await Promise.all([
    profile.primary_institution_id
      ? supabase
          .from("institutions")
          .select("id, name")
          .eq("id", profile.primary_institution_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("institution_memberships")
      .select(
        "id, role, is_active, institutions:institution_id ( id, name )",
      )
      .eq("user_id", id)
      .eq("is_active", true)
      .limit(5),
    supabase
      .from("sessions")
      .select(
        `
        id,
        status,
        started_at,
        ended_at,
        max_duration_sec,
        language,
        institution_id,
        difficulty,
        therapy_modality,
        clinical_snapshot,
        avatars ( name, disorder ),
        institutions:institution_id ( name ),
        session_reports ( id, scores, created_at, narrative )
      `,
      )
      .eq("therapist_id", id)
      .order("started_at", { ascending: false })
      .limit(100),
    supabase
      .from("learner_profiles")
      .select(
        "id, training_level, profession, institution, language, completed_case_count, certification_status, updated_at",
      )
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  const sessionList = sessions ?? [];
  const statsInput = sessionList.map((s) => {
    const reports = s.session_reports as unknown as Array<{
      id: string;
      scores: { overall?: number } | null;
    }> | null;
    const report = Array.isArray(reports) ? reports[0] : null;
    const overall =
      report?.scores && typeof report.scores === "object"
        ? (report.scores as { overall?: number }).overall
        : null;
    return {
      status: String(s.status),
      started_at: s.started_at,
      ended_at: s.ended_at,
      reportOverall: typeof overall === "number" ? overall : null,
      hasReport: Boolean(report),
    };
  });
  const stats: LearnerSessionStats = aggregateSessionStats(statsInput);

  const sessionRows: AdminSessionListRow[] = sessionList.map((s) => {
    const avatar = s.avatars as unknown as {
      name: string;
      disorder: string;
    } | null;
    const inst = s.institutions as unknown as { name: string } | null;
    const reports = s.session_reports as unknown as Array<{
      id: string;
      scores: { overall?: number } | null;
    }> | null;
    const report = Array.isArray(reports) ? reports[0] : null;
    const overall =
      report?.scores && typeof report.scores === "object"
        ? (report.scores as { overall?: number }).overall
        : null;
    const status = s.status as SessionStatus;
    const duration = formatSessionDurationDisplay(
      status,
      s.started_at,
      s.ended_at,
      s.max_duration_sec ?? undefined,
    );
    const durationLabel =
      duration == null
        ? null
        : duration.label === "past_limit"
          ? tSessions("durationPastLimit")
          : status === "active"
            ? tSessions("durationElapsed", { duration: duration.label })
            : duration.label;

    return {
      id: s.id,
      status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      language: String(s.language ?? "en"),
      learner: profile.display_name?.trim() || t("unnamed"),
      patient: avatar?.name ?? tSessions("unknownPatient"),
      disorder: avatar?.disorder ?? "",
      organization: inst?.name ?? null,
      institutionId: s.institution_id,
      durationLabel,
      durationStale: duration?.stale ?? false,
      score: typeof overall === "number" ? overall : null,
      reportStatus: report ? "available" : "none",
      isAdminTest: isAdminTestClinicalSnapshot(s.clinical_snapshot),
      difficulty: s.difficulty ?? null,
      modality: s.therapy_modality ?? null,
    };
  });

  const performanceRows = sessionList
    .map((s) => {
      const reports = s.session_reports as unknown as Array<{
        id: string;
        scores: { overall?: number; items?: Array<{ id: string; label: string; score: number; max: number }> } | null;
        created_at: string;
        narrative: string | null;
      }> | null;
      const report = Array.isArray(reports) ? reports[0] : null;
      if (!report) return null;
      const avatar = s.avatars as unknown as { name: string } | null;
      const overall =
        report.scores && typeof report.scores === "object"
          ? (report.scores as { overall?: number }).overall
          : null;
      return {
        sessionId: s.id,
        reportId: report.id,
        patient: avatar?.name ?? tSessions("unknownPatient"),
        overall: typeof overall === "number" ? overall : null,
        createdAt: report.created_at,
        status: String(s.status),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  let competencies: Array<{
    competency: string;
    score: number | null;
    updatedAt: string | null;
  }> = [];
  if (aceProfile?.id) {
    const { data: comps } = await supabase
      .from("learner_competencies")
      .select(
        "competency_id, score, last_assessed_at, samples, competency_domains(id, label)",
      )
      .eq("learner_id", aceProfile.id)
      .order("last_assessed_at", { ascending: false, nullsFirst: false })
      .limit(40);
    competencies = (comps ?? []).map((c) => {
      const domain = c.competency_domains as unknown as {
        id: string;
        label: string;
      } | null;
      return {
        competency: domain?.label ?? String(c.competency_id),
        score: typeof c.score === "number" ? Number(c.score) : null,
        updatedAt: c.last_assessed_at ?? null,
      };
    });
  }

  const membershipOrg =
    (membership?.[0]?.institutions as unknown as { name: string } | null)
      ?.name ?? null;
  const organization =
    institution?.name ?? membershipOrg ?? null;
  const membershipRole = membership?.[0]?.role
    ? String(membership[0].role)
    : null;

  const displayName = profile.display_name?.trim() || t("unnamed");

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={displayName}
        subtitle={t("detailSubtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title"), href: "/admin/learners" },
          { label: displayName },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={
                profile.role === "admin"
                  ? t("roleAdmin")
                  : t("roleTherapist")
              }
              tone="neutral"
            />
            <Link
              href={`/admin/sessions?learner=${profile.id}`}
              className="btn-secondary"
            >
              {t("viewSessions")}
            </Link>
          </div>
        }
      />

      <p
        className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-xs text-[var(--on-surface-variant)]"
        role="note"
      >
        {t("performanceNote")}
      </p>
      <dl className="grid gap-3 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            {t("fieldOrganization")}
          </dt>
          <dd className="mt-1">{organization ?? t("unassignedOrg")}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            {t("fieldMembership")}
          </dt>
          <dd className="mt-1">{membershipRole ?? t("none")}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            {t("fieldLanguage")}
          </dt>
          <dd className="mt-1 uppercase">
            {profile.preferred_language ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            {t("fieldLastActive")}
          </dt>
          <dd className="mt-1">
            {stats.lastActiveAt
              ? new Date(stats.lastActiveAt).toLocaleString(locale)
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("metricSessions")}
          value={String(stats.total)}
          hint={t("metricSessionsHint")}
        />
        <MetricCard
          label={t("metricCompleted")}
          value={String(stats.completed)}
        />
        <MetricCard
          label={t("metricAvgScore")}
          value={stats.avgOverall != null ? String(stats.avgOverall) : "—"}
          hint={t("metricAvgScoreHint")}
        />
        <MetricCard
          label={t("metricWithReport")}
          value={String(stats.withReport)}
        />
      </section>

      <LearnerDetailTabs
        locale={locale}
        labels={{
          tabOverview: t("tabOverview"),
          tabSessions: t("tabSessions"),
          tabPerformance: t("tabPerformance"),
          tabCompetencies: t("tabCompetencies"),
          tabActivity: t("tabActivity"),
          overviewIntro: t("overviewIntro"),
          educationNotice: t("educationNotice"),
          aceLink: t("aceLink"),
          cgeLink: t("cgeLink"),
          emptySessions: t("emptySessions"),
          emptyPerformance: t("emptyPerformance"),
          emptyCompetencies: t("emptyCompetencies"),
          emptyCompetenciesHint: t("emptyCompetenciesHint"),
          emptyActivity: t("emptyActivity"),
          colSession: tSessions("colSession"),
          colScenario: tSessions("colScenario"),
          colStarted: tSessions("colStarted"),
          colDuration: tSessions("colDuration"),
          colStatus: tSessions("colStatus"),
          colScore: tSessions("colAssessment"),
          colReport: tSessions("colReport"),
          statusActive: tSessions("statusActive"),
          statusCompleted: tSessions("statusCompleted"),
          statusExpired: tSessions("statusExpired"),
          reportAvailable: tSessions("reportAvailable"),
          reportNone: tSessions("reportNone"),
          actionView: tSessions("actionView"),
          actionReport: tSessions("actionReport"),
          staleBadge: tSessions("staleBadge"),
          competency: t("colCompetency"),
          competencyScore: t("colCompetencyScore"),
          competencyUpdated: t("colCompetencyUpdated"),
          activitySession: t("activitySession"),
          activityReport: t("activityReport"),
          trainingLevel: t("fieldTrainingLevel"),
          profession: t("fieldProfession"),
          completedCases: t("fieldCompletedCases"),
          certification: t("fieldCertification"),
          none: t("none"),
          sessionsSampleHint: t("sessionsSampleHint"),
          viewAllSessions: t("viewAllSessions"),
        }}
        overview={{
          trainingLevel: aceProfile?.training_level ?? null,
          profession: aceProfile?.profession ?? null,
          completedCases: aceProfile?.completed_case_count ?? null,
          certification: aceProfile?.certification_status ?? null,
          hasAce: Boolean(aceProfile?.id),
          learnerId: profile.id,
        }}
        sessions={sessionRows}
        performance={performanceRows}
        competencies={competencies}
      />
    </main>
  );
}
