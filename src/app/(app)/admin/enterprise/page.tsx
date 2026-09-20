import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MetricCard } from "@/components/admin/AdminUi";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEnterprisePanel } from "@/components/enterprise/AdminEnterprisePanel";
import { AdvancedDetails } from "@/components/admin/AdvancedDetails";

export default async function AdminEnterprisePage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.organization");
  const tHome = await getTranslations("admin.home");

  const [{ data: institutions }, { data: memberships }, { data: sessionCounts }] =
    await Promise.all([
      supabase
        .from("institutions")
        .select(
          "id, slug, name, country_code, locale_default, sso_enabled, is_active",
        )
        .order("name"),
      supabase
        .from("institution_memberships")
        .select(
          "id, institution_id, role, is_active, profiles:user_id ( display_name )",
        )
        .eq("is_active", true)
        .limit(500),
      supabase
        .from("sessions")
        .select("id, institution_id")
        .not("institution_id", "is", null)
        .limit(2000),
    ]);

  const orgs = institutions ?? [];
  const members = memberships ?? [];
  const sess = sessionCounts ?? [];

  const memberCountByOrg = new Map<string, number>();
  for (const m of members) {
    memberCountByOrg.set(
      m.institution_id,
      (memberCountByOrg.get(m.institution_id) ?? 0) + 1,
    );
  }
  const sessionCountByOrg = new Map<string, number>();
  for (const s of sess) {
    if (!s.institution_id) continue;
    sessionCountByOrg.set(
      s.institution_id,
      (sessionCountByOrg.get(s.institution_id) ?? 0) + 1,
    );
  }

  const activeOrgs = orgs.filter((o) => o.is_active).length;

  return (
    <main className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 md:px-8">
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
          label={t("statOrgs")}
          value={String(orgs.length)}
          hint={t("statOrgsHint")}
        />
        <MetricCard
          label={t("statActiveOrgs")}
          value={String(activeOrgs)}
        />
        <MetricCard
          label={t("statMembers")}
          value={String(members.length)}
          hint={t("statMembersHint")}
        />
      </section>

      <section className="clinical-card overflow-hidden">
        <div className="border-b border-[var(--outline-variant)] px-5 py-4">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("rosterTitle")}
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            {t("rosterSubtitle")}
          </p>
        </div>
        {orgs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--on-surface-variant)]">
            {t("rosterEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  <th className="px-5 py-3">{t("colOrg")}</th>
                  <th className="px-4 py-3">{t("colMembers")}</th>
                  <th className="px-4 py-3">{t("colSessions")}</th>
                  <th className="px-4 py-3">{t("colLocale")}</th>
                  <th className="px-4 py-3">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-container)]">
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{org.name}</p>
                      <p className="font-mono text-xs text-[var(--on-surface-variant)]">
                        {org.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {memberCountByOrg.get(org.id) ?? 0}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {sessionCountByOrg.get(org.id) ?? 0}
                    </td>
                    <td className="px-4 py-3 uppercase text-[var(--on-surface-variant)]">
                      {org.locale_default ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={
                          org.is_active ? t("statusActive") : t("statusInactive")
                        }
                        tone={org.is_active ? "active" : "inactive"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("membersTitle")}
        </h2>
        <p className="mb-4 text-sm text-[var(--on-surface-variant)]">
          {t("membersHint")}
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("membersEmpty")}
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {members.slice(0, 50).map((m) => {
              const profile = m.profiles as unknown as {
                display_name: string;
              } | null;
              const orgName =
                orgs.find((o) => o.id === m.institution_id)?.name ?? "—";
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--outline-variant)] px-3 py-2"
                >
                  <span>
                    {profile?.display_name ?? t("unknownMember")} · {orgName}
                  </span>
                  <StatusBadge label={String(m.role)} tone="neutral" />
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
          {t("rolesNote")}
        </p>
      </section>

      <AdvancedDetails title={t("controlPlane")}>
        <p className="mb-4 text-sm text-[var(--on-surface-variant)]">
          {t("controlPlaneHint")}{" "}
          <Link href="/admin/feedback" className="text-[var(--primary)] underline">
            {t("feedbackLink")}
          </Link>
        </p>
        <AdminEnterprisePanel />
      </AdvancedDetails>
    </main>
  );
}
