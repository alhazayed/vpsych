import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MetricCard } from "@/components/admin/AdminUi";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default async function AdminContentHubPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.contentHub");
  const tHome = await getTranslations("admin.home");

  const [
    { data: avatars },
    { count: voiceCount },
    { count: disorderCount },
    { count: templateCount },
    { count: presetCount },
  ] = await Promise.all([
    supabase
      .from("avatars")
      .select("id, lifecycle_status, updated_at, name, disorder")
      .order("updated_at", { ascending: false }),
    supabase
      .from("voice_profiles")
      .select("id", { count: "exact", head: true }),
    supabase.from("disorders").select("id", { count: "exact", head: true }),
    supabase
      .from("clinical_templates")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase
      .from("instructor_presets")
      .select("id", { count: "exact", head: true }),
  ]);

  const list = avatars ?? [];
  const byLifecycle = {
    draft: list.filter((a) => a.lifecycle_status === "draft").length,
    testing: list.filter((a) => a.lifecycle_status === "testing").length,
    published: list.filter((a) => a.lifecycle_status === "published").length,
    archived: list.filter((a) => a.lifecycle_status === "archived").length,
  };
  const recent = list.slice(0, 6);

  const libraries = [
    {
      href: "/admin/avatars",
      title: t("libPatients"),
      description: t("libPatientsHint"),
      count: list.length,
      icon: "psychology",
    },
    {
      href: "/admin/voices",
      title: t("libVoices"),
      description: t("libVoicesHint"),
      count: voiceCount ?? 0,
      icon: "record_voice_over",
    },
    {
      href: "/admin/cases",
      title: t("libCases"),
      description: t("libCasesHint"),
      count: disorderCount ?? 0,
      icon: "biotech",
    },
    {
      href: "/admin/templates",
      title: t("libTemplates"),
      description: t("libTemplatesHint"),
      count: templateCount ?? 0,
      icon: "schema",
    },
    {
      href: "/admin/presets",
      title: t("libPresets"),
      description: t("libPresetsHint"),
      count: presetCount ?? 0,
      icon: "school",
    },
  ];

  return (
    <main className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
        actions={
          <Link href="/admin/avatars/new" className="btn-primary">
            {t("createPatient")}
          </Link>
        }
      />

      <p className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
        {t("simulationNotice")}
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("statPublished")}
          value={String(byLifecycle.published)}
          href="/admin/avatars"
        />
        <MetricCard
          label={t("statDraft")}
          value={String(byLifecycle.draft)}
          href="/admin/avatars"
          tone={byLifecycle.draft > 0 ? "warning" : "default"}
        />
        <MetricCard
          label={t("statTesting")}
          value={String(byLifecycle.testing)}
          href="/admin/avatars"
        />
        <MetricCard
          label={t("statArchived")}
          value={String(byLifecycle.archived)}
          href="/admin/avatars"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {libraries.map((lib) => (
          <Link
            key={lib.href}
            href={lib.href}
            className="clinical-card block p-5 transition-colors hover:bg-[var(--surface-container-low)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[var(--primary)]"
                aria-hidden
              >
                {lib.icon}
              </span>
              <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                {lib.title}
              </h2>
            </div>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {lib.description}
            </p>
            <p className="mt-4 font-[family-name:var(--font-headline)] text-2xl font-semibold tabular-nums text-[var(--primary)]">
              {lib.count}
            </p>
          </Link>
        ))}
      </section>

      <section className="clinical-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("recentlyUpdated")}
          </h2>
          <Link
            href="/admin/avatars"
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            {t("viewLibrary")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("recentEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--surface-container)]">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/avatars/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-[var(--surface-container-low)]"
                >
                  <div>
                    <p className="font-medium text-[var(--on-surface)]">
                      {a.name}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {a.disorder}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={String(a.lifecycle_status ?? "draft")}
                      tone={
                        a.lifecycle_status === "published"
                          ? "active"
                          : a.lifecycle_status === "archived"
                            ? "inactive"
                            : "warning"
                      }
                    />
                    <span className="text-xs text-[var(--on-surface-variant)]">
                      {a.updated_at
                        ? new Date(a.updated_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
