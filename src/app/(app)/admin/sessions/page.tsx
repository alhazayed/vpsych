import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState, MetricCard } from "@/components/admin/AdminUi";
import { SessionsTable } from "@/components/admin/SessionsTable";
import {
  formatSessionDurationDisplay,
  isAdminTestClinicalSnapshot,
  type AdminSessionListRow,
} from "@/lib/admin/session-ops";
import {
  SESSION_PAGE_SIZE,
  clampPage,
  parsePositiveInt,
  totalPages,
} from "@/lib/admin/learner-ops";
import { expireStaleSessionsVisible } from "@/lib/session-expiry";
import type { SessionStatus } from "@/lib/types";

type StatusFilter = "all" | SessionStatus;
type ReportFilter = "all" | "available" | "none";

function parseStatus(v: string | undefined): StatusFilter {
  if (v === "active" || v === "completed" || v === "expired") return v;
  return "all";
}

function parseReport(v: string | undefined): ReportFilter {
  if (v === "available" || v === "none") return v;
  return "all";
}

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    report?: string;
    q?: string;
    learner?: string;
  }>;
}) {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.sessions");
  const tHome = await getTranslations("admin.home");
  const sp = await searchParams;

  await expireStaleSessionsVisible(supabase);

  const status = parseStatus(sp.status);
  const report = parseReport(sp.report);
  const q = (sp.q ?? "").trim();
  const learnerId = (sp.learner ?? "").trim() || null;
  const requestedPage = parsePositiveInt(sp.page, 1);

  let learnerName: string | null = null;
  if (learnerId) {
    const { data: learner } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", learnerId)
      .maybeSingle();
    learnerName = learner?.display_name?.trim() || t("unknownLearner");
  }

  // Fetch a bounded working set for server filter + pagination.
  // Cap remains defensive; filters reduce before paging.
  let query = supabase
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
      therapist_id,
      profiles ( display_name ),
      avatars ( name, disorder ),
      institutions:institution_id ( name ),
      session_reports ( id, scores )
    `,
    )
    .order("started_at", { ascending: false })
    .limit(500);

  if (learnerId) {
    query = query.eq("therapist_id", learnerId);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: sessions, error: sessionsError } = await query;

  if (sessionsError) {
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

  const list = sessions ?? [];
  const mapped: AdminSessionListRow[] = list.map((s) => {
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
    const reportRow = Array.isArray(reports) ? reports[0] : reports;
    const overall =
      reportRow?.scores && typeof reportRow.scores === "object"
        ? (reportRow.scores as { overall?: number }).overall
        : null;
    const sessStatus = s.status as SessionStatus;
    const duration = formatSessionDurationDisplay(
      sessStatus,
      s.started_at,
      s.ended_at,
      s.max_duration_sec ?? undefined,
    );
    const durationLabel =
      duration == null
        ? null
        : duration.label === "past_limit"
          ? t("durationPastLimit")
          : sessStatus === "active"
            ? t("durationElapsed", { duration: duration.label })
            : duration.label;

    return {
      id: s.id,
      status: sessStatus,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      language: String(s.language ?? "en"),
      learner: profile?.display_name ?? t("unknownLearner"),
      learnerId: s.therapist_id as string,
      patient: avatar?.name ?? t("unknownPatient"),
      disorder: avatar?.disorder ?? "",
      organization: institution?.name ?? null,
      institutionId: s.institution_id,
      durationLabel,
      durationStale: duration?.stale ?? false,
      score: typeof overall === "number" ? overall : null,
      reportStatus: reportRow ? "available" : "none",
      isAdminTest: isAdminTestClinicalSnapshot(s.clinical_snapshot),
      difficulty: s.difficulty ?? null,
      modality: s.therapy_modality ?? null,
    };
  });

  const filtered = mapped.filter((r) => {
    if (report !== "all" && r.reportStatus !== report) return false;
    if (!q) return true;
    const queryLower = q.toLowerCase();
    return (
      r.id.toLowerCase().includes(queryLower) ||
      r.learner.toLowerCase().includes(queryLower) ||
      r.patient.toLowerCase().includes(queryLower) ||
      r.disorder.toLowerCase().includes(queryLower) ||
      (r.organization ?? "").toLowerCase().includes(queryLower)
    );
  });

  const total = filtered.length;
  const pages = totalPages(total, SESSION_PAGE_SIZE);
  const page = clampPage(requestedPage, pages || 1);
  const from = (page - 1) * SESSION_PAGE_SIZE;
  const rows = filtered.slice(from, from + SESSION_PAGE_SIZE);

  const active = mapped.filter((r) => r.status === "active").length;
  const completed = mapped.filter((r) => r.status === "completed").length;
  const withReport = mapped.filter((r) => r.reportStatus === "available").length;
  const staleCount = mapped.filter((r) => r.durationStale).length;

  function hrefFor(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const next = {
      q: q || null,
      status: status === "all" ? null : status,
      report: report === "all" ? null : report,
      learner: learnerId,
      page: page > 1 ? String(page) : null,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/admin/sessions?${qs}` : "/admin/sessions";
  }

  return (
    <main className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          ...(learnerId
            ? [
                {
                  label: t("learnersCrumb"),
                  href: "/admin/learners",
                },
                {
                  label: learnerName ?? t("unknownLearner"),
                  href: `/admin/learners/${learnerId}`,
                },
              ]
            : []),
          { label: t("title") },
        ]}
      />

      {learnerId ? (
        <p
          className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm"
          role="status"
        >
          {t("filteredByLearner", { name: learnerName ?? t("unknownLearner") })}{" "}
          <Link
            href="/admin/sessions"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            {t("clearLearnerFilter")}
          </Link>
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <MetricCard
          label={t("statStale")}
          value={String(staleCount)}
          hint={t("statStaleHint")}
          tone={staleCount > 0 ? "warning" : "default"}
        />
      </section>

      <section className="clinical-card overflow-hidden">
        <SessionsTable
          rows={rows}
          mode="server"
          filterState={{
            q,
            status,
            report,
            action: "/admin/sessions",
            learnerId,
          }}
          pagination={{
            page,
            pages,
            total,
            from: total === 0 ? 0 : from + 1,
            to: Math.min(from + rows.length, total),
            prevHref: page > 1 ? hrefFor({ page: String(page - 1) }) : null,
            nextHref:
              page < pages ? hrefFor({ page: String(page + 1) }) : null,
            clearHref: hrefFor({
              q: null,
              status: null,
              report: null,
              page: null,
              learner: learnerId,
            }),
          }}
          labels={{
            searchPlaceholder: t("searchPlaceholder"),
            emptyTitle: t("emptyTitle"),
            emptyDescription: t("emptyDescription"),
            emptyFilteredTitle: t("emptyFilteredTitle"),
            emptyFilteredDescription: t("emptyFilteredDescription"),
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
            showingRange: t("showingRange", {
              from: total === 0 ? 0 : from + 1,
              to: Math.min(from + rows.length, total),
              total,
            }),
            unassignedOrg: t("unassignedOrg"),
            staleBadge: t("staleBadge"),
            prev: t("prev"),
            next: t("next"),
            pageOf: t("pageOf", { page, pages: Math.max(pages, 1) }),
            paginationLabel: t("paginationLabel"),
            searchSubmit: t("searchSubmit"),
          }}
        />
      </section>
      <p className="text-xs text-[var(--on-surface-variant)]">
        {t("paginationNote")}
      </p>
    </main>
  );
}
