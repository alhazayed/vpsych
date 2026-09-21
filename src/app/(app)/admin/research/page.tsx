import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { ResearchValidationPanel } from "@/components/admin/ResearchValidationPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminResearchValidationPage() {
  await requireAdmin();
  const t = await getTranslations("admin.researchValidation");
  const tHome = await getTranslations("admin.home");

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />
      <div
        role="note"
        className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--secondary)_35%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--secondary)_8%,transparent)] px-4 py-3 text-sm text-[var(--on-surface)]"
      >
        <p className="font-semibold">{t("workspaceTitle")}</p>
        <p className="mt-1 text-[var(--on-surface-variant)]">
          {t("workspaceDisclaimer")}
        </p>
      </div>
      <ResearchValidationPanel />
    </main>
  );
}
