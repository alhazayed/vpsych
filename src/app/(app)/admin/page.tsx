import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  AlertPanel,
  MetricCard,
  QuickActions,
} from "@/components/admin/AdminUi";
import { assessVirtualPatientCompleteness } from "@/lib/admin/virtual-patient-completeness";
import { PACKAGE_VERSION } from "@/lib/ops/versions";
import { getTranslations } from "next-intl/server";

function startOfUtcDay(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default async function AdminHomePage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.home");

  const todayStart = startOfUtcDay();
  const weekStart = daysAgoIso(7);

  const [
    { data: avatars },
    { data: reports },
    feedbackRes,
    { data: recentSessions },
    { count: sessionsToday },
    { data: weekSessions },
    { count: reportsTotal },
  ] = await Promise.all([
    supabase
      .from("avatars")
      .select(
        "id, name, disorder, is_active, human_personality, personalities, persona_prompt, voice_profile_id, voice_id, voice_id_ar, clinical_core",
      )
      .order("name"),
    supabase
      .from("session_reports")
      .select(
        `
        id, session_id, created_at, scores, language,
        sessions (
          profiles ( display_name ),
          avatars ( name )
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("institutional_feedback").select("id, status").limit(100),
    supabase
      .from("sessions")
      .select("id, status, created_at, avatar_id, profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("sessions")
      .select("id, status")
      .gte("created_at", weekStart),
    supabase
      .from("session_reports")
      .select("id", { count: "exact", head: true }),
  ]);

  const openFeedback = (feedbackRes.data ?? []).filter((f) => {
    const s = String(f.status ?? "");
    return s !== "resolved" && s !== "wont_fix" && s !== "duplicate";
  }).length;

  const avatarNameById = new Map(
    (avatars ?? []).map((a) => [a.id, a.name] as const),
  );

  const list = avatars ?? [];
  const activeCount = list.filter((a) => a.is_active).length;
  const incomplete = list.filter(
    (a) => !assessVirtualPatientCompleteness(a).isComplete,
  );

  const week = weekSessions ?? [];
  const weekCompleted = week.filter((s) => s.status === "completed").length;
  const completionRate =
    week.length > 0 ? Math.round((weekCompleted / week.length) * 100) : null;

  const reportScores = (reports ?? [])
    .map((r) => {
      const scores =
        r.scores && typeof r.scores === "object"
          ? (r.scores as { overall?: number })
          : null;
      return scores?.overall;
    })
    .filter((n): n is number => typeof n === "number");
  const avgRecentScore =
    reportScores.length > 0
      ? Math.round(
          reportScores.reduce((a, b) => a + b, 0) / reportScores.length,
        )
      : null;

  const attention: Array<{
    id: string;
    label: string;
    href: string;
    actionLabel: string;
  }> = [];
  if (incomplete.length) {
    attention.push({
      id: "incomplete",
      label: t("attentionIncomplete", { count: incomplete.length }),
      href: "/admin/avatars",
      actionLabel: t("review"),
    });
  }
  if (openFeedback > 0) {
    attention.push({
      id: "feedback",
      label: t("attentionFeedback", { count: openFeedback }),
      href: "/admin/feedback",
      actionLabel: t("review"),
    });
  }

  const expiredNoReportHint =
    week.filter((s) => s.status === "expired").length > 0;
  if (expiredNoReportHint) {
    const expiredCount = week.filter((s) => s.status === "expired").length;
    attention.push({
      id: "expired",
      label: t("attentionExpired", { count: expiredCount }),
      href: "/admin/reports",
      actionLabel: t("review"),
    });
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("greetingHint")}
          </p>
        }
      />

      <section
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        aria-label={t("kpiRegion")}
      >
        <MetricCard
          label={t("statActiveLearnersSessions")}
          value={String(sessionsToday ?? 0)}
          hint={t("statSessionsTodayHint")}
          href="/admin/reports"
        />
        <MetricCard
          label={t("statCompletion")}
          value={completionRate != null ? `${completionRate}%` : "—"}
          hint={t("statCompletionHint")}
          href="/admin/curriculum"
        />
        <MetricCard
          label={t("statAvgScore")}
          value={avgRecentScore != null ? String(avgRecentScore) : "—"}
          hint={t("statAvgScoreHint")}
          href="/admin/reports"
        />
        <MetricCard
          label={t("statActive")}
          value={String(activeCount)}
          hint={t("statActiveHint")}
          href="/admin/avatars"
        />
        <MetricCard
          label={t("statIncomplete")}
          value={String(incomplete.length)}
          hint={t("statIncompleteHint")}
          tone={incomplete.length > 0 ? "warning" : "default"}
          href="/admin/avatars"
        />
        <MetricCard
          label={t("statOpenFeedback")}
          value={String(openFeedback)}
          hint={t("statOpenFeedbackHint")}
          href="/admin/feedback"
          tone={openFeedback > 0 ? "warning" : "default"}
        />
      </section>

      <div className="mb-6">
        <QuickActions
          title={t("quickActions")}
          actions={[
            {
              href: "/admin/avatars/new",
              label: t("actionNewPatient"),
              icon: "person_add",
            },
            {
              href: "/admin/reports",
              label: t("actionReviewReports"),
              icon: "assignment",
            },
            {
              href: "/admin/curriculum",
              label: t("actionLearners"),
              icon: "group",
            },
            {
              href: "/admin/feedback",
              label: t("actionFeedback"),
              icon: "inbox",
            },
            {
              href: "/admin/cases",
              label: t("actionCases"),
              icon: "biotech",
            },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AlertPanel
          title={t("needsAttention")}
          emptyLabel={t("needsAttentionEmpty")}
          items={attention}
        />

        <section className="clinical-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("recentReports")}
            </h2>
            <Link
              href="/admin/reports"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              {t("viewAll")}
              {reportsTotal != null ? ` (${reportsTotal})` : ""}
            </Link>
          </div>
          {(reports ?? []).length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("recentReportsEmpty")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(reports ?? []).map((r) => {
                const scores =
                  r.scores && typeof r.scores === "object"
                    ? (r.scores as { overall?: number })
                    : null;
                const session = r.sessions as unknown as {
                  profiles: { display_name: string } | null;
                  avatars: { name: string } | null;
                } | null;
                const learner =
                  session?.profiles?.display_name ?? t("unknownLearner");
                const patient =
                  session?.avatars?.name ?? t("unknownPatient");
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/reports/${r.session_id}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2 hover:bg-[var(--surface-container-low)]"
                    >
                      <span>
                        {learner} · {patient}
                      </span>
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        {scores?.overall != null ? `${scores.overall}` : "—"} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("recentActivity")}
          </h2>
          {(recentSessions ?? []).length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("recentActivityEmpty")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(recentSessions ?? []).map((s) => {
                const name =
                  avatarNameById.get(s.avatar_id) ?? t("unknownPatient");
                const learner =
                  (s.profiles as unknown as { display_name?: string } | null)
                    ?.display_name ?? t("unknownLearner");
                const tone =
                  s.status === "completed"
                    ? "active"
                    : s.status === "expired"
                      ? "warning"
                      : "info";
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2"
                  >
                    <span>
                      {learner} · {name}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                      <StatusBadge
                        label={t(`status.${s.status}` as "status.active")}
                        tone={tone}
                      />
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {incomplete.length > 0 ? (
            <div className="mt-4 border-t border-[var(--outline-variant)] pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                {t("incompletePatients")}
              </p>
              <ul className="space-y-1 text-sm text-[var(--on-surface-variant)]">
                {incomplete.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/avatars/${a.id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span> — {a.disorder}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="clinical-card p-5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("systemStatus")}
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>{t("systemApp")}</span>
              <StatusBadge label={t("statusOperational")} tone="active" />
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>{t("systemAdminAccess")}</span>
              <StatusBadge label={t("statusOperational")} tone="active" />
            </li>
            <li className="flex items-center justify-between gap-2 text-xs text-[var(--on-surface-variant)]">
              <span>{t("systemVersion")}</span>
              <span className="font-mono">{PACKAGE_VERSION}</span>
            </li>
            <li className="pt-2 text-xs text-[var(--on-surface-variant)]">
              {t("systemHint")}
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/cidp" className="btn-secondary">
              {t("openOperations")}
            </Link>
            <Link href="/admin/diagnostics" className="btn-secondary">
              {t("openDiagnostics")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
