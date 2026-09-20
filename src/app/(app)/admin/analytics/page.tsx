import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState, MetricCard } from "@/components/admin/AdminUi";

type RangeKey = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.analytics");
  const tHome = await getTranslations("admin.home");
  const sp = await searchParams;
  const rangeKey: RangeKey =
    sp.range === "7d" || sp.range === "90d" ? sp.range : "30d";
  const rangeDays = RANGE_DAYS[rangeKey];
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - rangeDays);
  const sinceIso = since.toISOString();

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, status, language, institution_id, institutions:institution_id ( name )",
    )
    .gte("created_at", sinceIso);

  const list = sessions ?? [];
  const sessionsStarted = list.length;
  const sessionsCompleted = list.filter((s) => s.status === "completed").length;
  const sessionsExpired = list.filter((s) => s.status === "expired").length;
  const sessionsActive = list.filter((s) => s.status === "active").length;
  const terminal = sessionsCompleted + sessionsExpired;
  const completionRate =
    terminal > 0 ? Math.round((sessionsCompleted / terminal) * 100) : null;

  const langMap = new Map<string, number>();
  const orgMap = new Map<
    string,
    { id: string | null; name: string; count: number }
  >();
  for (const s of list) {
    const lang = String(s.language ?? "unknown").toLowerCase();
    langMap.set(lang, (langMap.get(lang) ?? 0) + 1);
    const inst = s.institutions as unknown as { name: string } | null;
    const key = s.institution_id ?? "none";
    const existing = orgMap.get(key);
    if (existing) existing.count += 1;
    else
      orgMap.set(key, {
        id: s.institution_id,
        name: inst?.name ?? t("unassigned"),
        count: 1,
      });
  }

  const sessionIds = list.map((s) => s.id).slice(0, 500);
  let reportsCount = 0;
  let avgOverall: number | null = null;
  if (sessionIds.length > 0) {
    const { data: reports } = await supabase
      .from("session_reports")
      .select("id, scores")
      .in("session_id", sessionIds);
    const reps = reports ?? [];
    reportsCount = reps.length;
    const scores = reps
      .map((r) => {
        const o =
          r.scores && typeof r.scores === "object"
            ? (r.scores as { overall?: number }).overall
            : null;
        return o;
      })
      .filter((n): n is number => typeof n === "number");
    if (scores.length > 0) {
      avgOverall = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length,
      );
    }
  }

  const byLanguage = Array.from(langMap.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
  const byInstitution = Array.from(orgMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  const empty =
    sessionsStarted === 0 && reportsCount === 0 && sessionsActive === 0;

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />

      <p
        className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface)]"
        role="status"
      >
        <span className="font-medium">{t("scopePlatform")}</span>
        <span className="text-[var(--on-surface-variant)]">
          {" · "}
          {t("scopeAllOrgs")}
          {" · "}
          {t(`range.${rangeKey}`)}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--on-surface-variant)]">
          {t("dateRange")}
        </span>
        {(["7d", "30d", "90d"] as const).map((key) => (
          <Link
            key={key}
            href={`/admin/analytics?range=${key}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              rangeKey === key
                ? "border-[var(--primary)] bg-[var(--primary-fixed)] text-[var(--primary)]"
                : "border-[var(--outline-variant)] text-[var(--on-surface-variant)]"
            }`}
          >
            {t(`range.${key}`)}
          </Link>
        ))}
        <Link
          href="/admin/cidp"
          className="ms-auto text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {t("openOperations")}
        </Link>
      </div>

      {empty ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          icon="analytics"
        />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("sectionSimulation")}
            </h2>
            <p className="mb-3 text-sm text-[var(--on-surface-variant)]">
              {t("qSimulation")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label={t("metricStarted")}
                value={String(sessionsStarted)}
                hint={t("metricStartedHint")}
              />
              <MetricCard
                label={t("metricCompleted")}
                value={String(sessionsCompleted)}
              />
              <MetricCard
                label={t("metricExpired")}
                value={String(sessionsExpired)}
              />
              <MetricCard
                label={t("metricCompletion")}
                value={
                  completionRate != null ? `${completionRate}%` : "—"
                }
                hint={t("metricCompletionHint")}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("sectionAssessment")}
            </h2>
            <p className="mb-3 text-sm text-[var(--on-surface-variant)]">
              {t("qAssessment")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                label={t("metricReports")}
                value={String(reportsCount)}
                href="/admin/reports"
              />
              <MetricCard
                label={t("metricAvgScore")}
                value={avgOverall != null ? String(avgOverall) : "—"}
                hint={t("metricAvgScoreHint")}
                href="/admin/reports"
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="clinical-card p-5">
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                {t("byLanguage")}
              </h2>
              <p className="mb-3 text-sm text-[var(--on-surface-variant)]">
                {t("qLanguage")}
              </p>
              <ul className="space-y-2 text-sm">
                {byLanguage.map((row) => (
                  <li
                    key={row.language}
                    className="flex justify-between gap-2 border-b border-[var(--surface-container)] py-2"
                  >
                    <span className="uppercase">{row.language}</span>
                    <span className="font-semibold tabular-nums">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="clinical-card p-5">
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                {t("byOrganization")}
              </h2>
              <p className="mb-3 text-sm text-[var(--on-surface-variant)]">
                {t("qOrganization")}
              </p>
              <ul className="space-y-2 text-sm">
                {byInstitution.map((row) => (
                  <li
                    key={row.id ?? "none"}
                    className="flex justify-between gap-2 border-b border-[var(--surface-container)] py-2"
                  >
                    <span>{row.name}</span>
                    <span className="font-semibold tabular-nums">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("disclaimer")}
          </p>
        </>
      )}
    </main>
  );
}
