import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdvancedDetails } from "@/components/admin/AdvancedDetails";
import { getTranslations } from "next-intl/server";

/** Advanced / diagnostics landing — technical links only. */
export default async function AdminDiagnosticsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.diagnostics");
  const tHome = await getTranslations("admin.home");

  const links = [
    { href: "/admin/cidp", label: t("operations") },
    { href: "/admin/supervisor", label: t("supervisorFramework") },
    { href: "/admin/personality", label: t("legacyPersonality") },
    { href: "/api/health", label: t("health"), external: true },
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />

      <section className="clinical-card space-y-3 p-5">
        <p className="text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <AdvancedDetails title={t("engineNames")}>
          <ul className="list-disc space-y-1 ps-5 text-xs text-[var(--on-surface-variant)]">
            <li>ACE — Adaptive Curriculum (Learners &amp; Progress)</li>
            <li>CGE — Competency Graph (Competencies)</li>
            <li>CIDP — Controlled Institutional Deployment (Operations)</li>
            <li>VQI / AVI / CFI / ERI / RRS — scientific index APIs</li>
          </ul>
        </AdvancedDetails>
      </section>
    </main>
  );
}
