import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MetricCard } from "@/components/admin/AdminUi";
import { SessionsTable } from "@/components/admin/SessionsTable";
import {
  formatSessionDuration,
  isAdminTestClinicalSnapshot,
  type AdminSessionListRow,
} from "@/lib/admin/session-ops";
import type { SessionStatus } from "@/lib/types";

export default async function AdminSessionsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.sessions");
  const tHome = await getTranslations("admin.home");

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      `
      id,
      status,
      started_at,
      ended_at,
      language,
      institution_id,
      difficulty,
      therapy_modality,
      clinical_snapshot,
      profiles ( display_name ),
      avatars ( name, disorder ),
      institutions:institution_id ( name ),
      session_reports ( id, scores )
    `,
    )
    .order("started_at", { ascending: false })
    .limit(300);

  const list = sessions ?? [];
  const rows: AdminSessionListRow[] = list.map((s) => {
    const profile = s.profiles as unknown as { display_name: string } | null;
    const avatar = s.avatars as unknown as {
      name: string;
      disorder: string;
    } | null;
    const institution = s.institutions as unknown as { name: string } | null;
    const reports = s.session_reports as unknown as Array<{
      id: string;
      scores: { overall?: number } | null;
    }> | null;
    const report = Array.isArray(reports) ? reports[0] : reports;
    const overall =
      report?.scores && typeof report.scores === "object"
        ? (report.scores as { overall?: number }).overall
        : null;

    return {
      id: s.id,
      status: s.status as SessionStatus,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      language: String(s.language ?? "en"),
      learner: profile?.display_name ?? t("unknownLearner"),
      patient: avatar?.name ?? t("unknownPatient"),
      disorder: avatar?.disorder ?? "",
      organization: institution?.name ?? null,
      institutionId: s.institution_id,
      durationLabel: formatSessionDuration(s.started_at, s.ended_at),
      score: typeof overall === "number" ? overall : null,
      reportStatus: report ? "available" : "none",
      isAdminTest: isAdminTestClinicalSnapshot(s.clinical_snapshot),
      difficulty: s.difficulty ?? null,
      modality: s.therapy_modality ?? null,
    };
  });

  const active = rows.filter((r) => r.status === "active").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const withReport = rows.filter((r) => r.reportStatus === "available").length;

  return (
    <main className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t("statActive")}
          value={String(active)}
          hint={t("statActiveHint")}
        />
        <MetricCard
          label={t("statCompleted")}
          value={String(completed)}
          hint={t("statCompletedHint")}
        />
        <MetricCard
          label={t("statWithReport")}
          value={String(withReport)}
          hint={t("statWithReportHint")}
        />
      </section>

      <section className="clinical-card overflow-hidden">
        <SessionsTable
          rows={rows}
          labels={{
            searchPlaceholder: t("searchPlaceholder"),
            emptyTitle: t("emptyTitle"),
            emptyDescription: t("emptyDescription"),
            clearFilters: t("clearFilters"),
            colSession: t("colSession"),
            colLearner: t("colLearner"),
            colScenario: t("colScenario"),
            colOrganization: t("colOrganization"),
            colStarted: t("colStarted"),
            colDuration: t("colDuration"),
            colStatus: t("colStatus"),
            colAssessment: t("colAssessment"),
            colReport: t("colReport"),
            colActions: t("colActions"),
            filterStatus: t("filterStatus"),
            filterReport: t("filterReport"),
            filterAll: t("filterAll"),
            statusActive: t("statusActive"),
            statusCompleted: t("statusCompleted"),
            statusExpired: t("statusExpired"),
            reportAvailable: t("reportAvailable"),
            reportNone: t("reportNone"),
            actionView: t("actionView"),
            actionReport: t("actionReport"),
            adminTest: t("adminTest"),
            showing: t("showingLabel"),
            unassignedOrg: t("unassignedOrg"),
          }}
        />
      </section>
    </main>
  );
}
