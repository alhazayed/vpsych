import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { isHeuristicReportScores } from "@/lib/admin/report-regenerate";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState, MetricCard } from "@/components/admin/AdminUi";
import {
  ReportsTable,
  type ReportRow,
} from "@/components/admin/ReportsTable";

/** Rows rendered in the table; the total metric uses an exact count. */
const REPORT_LIST_LIMIT = 500;

export default async function AdminReportsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.reports");
  const tHome = await getTranslations("admin.home");
  const tSessions = await getTranslations("admin.sessions");
  const tCommon = await getTranslations("common");

  const {
    data: reports,
    error: reportsError,
    count: reportCount,
  } = await supabase
    .from("session_reports")
    .select(
      `
      id,
      session_id,
      scores,
      language,
      created_at,
      sessions (
        started_at,
        ended_at,
        status,
        language,
        profiles ( display_name ),
        avatars ( name, disorder )
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(REPORT_LIST_LIMIT);

  if (reportsError) {
    console.warn("[admin-reports] list:", reportsError.message);
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
        <ErrorState
          title={t("loadErrorTitle")}
          description={t("loadErrorDescription")}
        />
      </main>
    );
  }

  const list = reports ?? [];
  const total = reportCount ?? list.length;
  const truncated = total > list.length;
  // Heuristic-fallback scores are keyword placeholders, not examiner scores;
  // keep them out of the average so an AI outage cannot skew it.
  const scored = list.filter((r) => !isHeuristicReportScores(r.scores));
  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, r) => {
            const overall =
              (r.scores as { overall?: number } | null)?.overall ?? 0;
            return sum + overall;
          }, 0) / scored.length,
        )
      : 0;

  const statusLabelFor = (status: string) => {
    if (status === "active") return tSessions("statusActive");
    if (status === "expired") return tSessions("statusExpired");
    return tSessions("statusCompleted");
  };

  const rows: ReportRow[] = list.map((report) => {
    const session = report.sessions as unknown as {
      started_at: string;
      status: string;
      language?: string | null;
      profiles: { display_name: string } | null;
      avatars: { name: string; disorder: string } | null;
    } | null;
    const overall = (report.scores as { overall?: number } | null)?.overall;
    const lang = String(report.language ?? session?.language ?? "en");
    const status = session?.status ?? "completed";
    return {
      id: report.id,
      sessionId: report.session_id,
      learner: session?.profiles?.display_name ?? t("fallbackTherapist"),
      patient: session?.avatars?.name ?? t("fallbackAvatar"),
      disorder: session?.avatars?.disorder ?? "",
      language: lang,
      score: typeof overall === "number" ? overall : null,
      fallback: isHeuristicReportScores(report.scores),
      status,
      statusLabel: statusLabelFor(status),
      createdAt: report.created_at,
      createdAtLabel: format(new Date(report.created_at), "MMM d, yyyy HH:mm"),
    };
  });

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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t("statTotal")}
          value={String(total)}
          hint={
            truncated
              ? t("statTotalTruncated", { count: list.length })
              : t("statTotalHint")
          }
        />
        <MetricCard
          label={t("statAvg")}
          value={scored.length ? `${avg}${tCommon("outOf100")}` : "—"}
          hint={truncated ? t("statAvgHintRecent") : t("statAvgHint")}
        />
        <MetricCard
          label={t("statAccess")}
          value={t("adminOnly")}
          hint={t("rlsNote")}
        />
      </section>

      <section className="clinical-card overflow-hidden">
        <ReportsTable
          rows={rows}
          labels={{
            searchPlaceholder: t("searchPlaceholder"),
            emptyTitle: t("emptyTitle"),
            emptyDescription: t("emptyDescription"),
            emptyFilteredTitle: t("emptyFilteredTitle"),
            emptyFilteredDescription: t("emptyFilteredDescription"),
            clearFilters: t("clearFilters"),
            colLearner: t("colLearner"),
            colPatient: t("colPatient"),
            colDate: t("colDate"),
            colStatus: t("colStatus"),
            colScore: t("colScore"),
            colLanguage: t("colLanguage"),
            showingLabel: t("showingLabel"),
            filterLanguage: t("filterLanguage"),
            filterAll: t("filterAll"),
            fallbackBadge: t("fallbackBadge"),
          }}
        />
      </section>
    </main>
  );
}
