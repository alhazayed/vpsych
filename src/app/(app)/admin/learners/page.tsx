import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState, ErrorState, MetricCard } from "@/components/admin/AdminUi";
import {
  LEARNER_PAGE_SIZE,
  clampPage,
  parsePositiveInt,
  totalPages,
  type LearnerListRow,
} from "@/lib/admin/learner-ops";

export default async function AdminLearnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.learners");
  const tHome = await getTranslations("admin.home");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const requestedPage = parsePositiveInt(sp.page, 1);

  let profileQuery = supabase
    .from("profiles")
    .select("id, display_name, role, preferred_language, primary_institution_id, updated_at", {
      count: "exact",
    })
    .eq("role", "therapist")
    .order("updated_at", { ascending: false });

  if (q) {
    profileQuery = profileQuery.ilike("display_name", `%${q}%`);
  }

  let countQuery = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "therapist");
  if (q) {
    countQuery = countQuery.ilike("display_name", `%${q}%`);
  }
  const { count: totalCount, error: countError } = await countQuery;

  if (countError) {
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
        <ErrorState
          title={t("loadErrorTitle")}
          description={t("loadErrorDescription")}
        />
      </main>
    );
  }

  const total = totalCount ?? 0;
  const pages = totalPages(total, LEARNER_PAGE_SIZE);
  const page = clampPage(requestedPage, pages || 1);
  const from = (page - 1) * LEARNER_PAGE_SIZE;
  const to = from + LEARNER_PAGE_SIZE - 1;

  const { data: profiles, error: listError } = await profileQuery.range(from, to);

  if (listError) {
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
        <ErrorState
          title={t("loadErrorTitle")}
          description={t("loadErrorDescription")}
        />
      </main>
    );
  }

  const list = profiles ?? [];
  const ids = list.map((p) => p.id);

  const institutionIds = Array.from(
    new Set(
      list
        .map((p) => p.primary_institution_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [{ data: institutions }, { data: sessions }] = await Promise.all([
    institutionIds.length
      ? supabase.from("institutions").select("id, name").in("id", institutionIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ids.length
      ? supabase
          .from("sessions")
          .select("id, therapist_id, status, started_at, ended_at")
          .in("therapist_id", ids)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            therapist_id: string;
            status: string;
            started_at: string;
            ended_at: string | null;
          }>,
        }),
  ]);

  const orgById = new Map((institutions ?? []).map((i) => [i.id, i.name]));
  const statsByLearner = new Map<
    string,
    { total: number; completed: number; last: string | null }
  >();
  for (const s of sessions ?? []) {
    const cur = statsByLearner.get(s.therapist_id) ?? {
      total: 0,
      completed: 0,
      last: null,
    };
    cur.total += 1;
    if (s.status === "completed") cur.completed += 1;
    const stamp = s.ended_at ?? s.started_at;
    if (!cur.last || stamp > cur.last) cur.last = stamp;
    statsByLearner.set(s.therapist_id, cur);
  }

  const rows: LearnerListRow[] = list.map((p) => {
    const stats = statsByLearner.get(p.id);
    return {
      id: p.id,
      displayName: p.display_name?.trim() || t("unnamed"),
      role: p.role,
      organization: p.primary_institution_id
        ? (orgById.get(p.primary_institution_id) ?? null)
        : null,
      preferredLanguage: p.preferred_language ?? null,
      sessionCount: stats?.total ?? 0,
      completedCount: stats?.completed ?? 0,
      lastActiveAt: stats?.last ?? null,
    };
  });

  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + rows.length, total);
  const filtersActive = Boolean(q);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/learners?${qs}` : "/admin/learners";
  }

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

      <section className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label={t("statTotal")}
          value={String(total)}
          hint={t("statTotalHint")}
        />
        <MetricCard
          label={t("statPage")}
          value={pages > 0 ? `${page} / ${pages}` : "—"}
          hint={t("statPageHint")}
        />
      </section>

      <section className="clinical-card overflow-hidden">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 border-b border-[var(--outline-variant)] bg-[var(--surface-bright)] px-4 py-4 md:px-6"
        >
          <label className="min-w-[12rem] flex-1 text-xs font-medium text-[var(--on-surface-variant)]">
            <span className="mb-1 block">{t("searchLabel")}</span>
            <input
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <button type="submit" className="btn-secondary">
            {t("searchSubmit")}
          </button>
          {filtersActive ? (
            <Link href="/admin/learners" className="btn-secondary">
              {t("clearFilters")}
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <EmptyState
            title={filtersActive ? t("emptyFilteredTitle") : t("emptyTitle")}
            description={
              filtersActive
                ? t("emptyFilteredDescription")
                : t("emptyDescription")
            }
            icon="group"
            action={
              filtersActive ? (
                <Link href="/admin/learners" className="btn-secondary">
                  {t("clearFilters")}
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <p className="px-4 py-2 text-xs text-[var(--on-surface-variant)] md:px-6">
              {t("showingRange", {
                from: showingFrom,
                to: showingTo,
                total,
              })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-start text-sm">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                    <th className="px-4 py-3 font-bold md:px-6">
                      {t("colLearner")}
                    </th>
                    <th className="px-4 py-3 font-bold">{t("colOrganization")}</th>
                    <th className="px-4 py-3 font-bold">{t("colSessions")}</th>
                    <th className="px-4 py-3 font-bold">{t("colCompleted")}</th>
                    <th className="px-4 py-3 font-bold">{t("colLastActive")}</th>
                    <th className="px-4 py-3 font-bold text-end md:px-6">
                      {t("colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-container)]">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-[var(--surface-container-low)]"
                    >
                      <td className="px-4 py-3 md:px-6">
                        <Link
                          href={`/admin/learners/${r.id}`}
                          className="font-medium text-[var(--primary)] hover:underline"
                        >
                          {r.displayName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                        {r.organization ?? t("unassignedOrg")}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{r.sessionCount}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.completedCount}
                      </td>
                      <td className="px-4 py-3 text-[var(--on-surface-variant)]">
                        {r.lastActiveAt
                          ? new Date(r.lastActiveAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-end md:px-6">
                        <Link
                          href={`/admin/learners/${r.id}`}
                          className="text-xs font-medium text-[var(--primary)] hover:underline"
                        >
                          {t("actionView")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 ? (
              <nav
                className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--outline-variant)] px-4 py-3 md:px-6"
                aria-label={t("paginationLabel")}
              >
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="btn-secondary">
                    {t("prev")}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs text-[var(--on-surface-variant)]">
                  {t("pageOf", { page, pages })}
                </span>
                {page < pages ? (
                  <Link href={pageHref(page + 1)} className="btn-secondary">
                    {t("next")}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </section>

      <p className="text-xs text-[var(--on-surface-variant)]">{t("privacyNote")}</p>
      <p className="text-xs text-[var(--on-surface-variant)]">{t("identityNote")}</p>
    </main>
  );
}
