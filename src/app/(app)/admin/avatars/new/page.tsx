import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdvancedDetails } from "@/components/admin/AdvancedDetails";
import { getTranslations } from "next-intl/server";

/**
 * Phase 2 create entry point — UX shell only.
 * Persistence is intentionally disabled until a reviewed admin create API exists.
 */
export default async function AdminCreateVirtualPatientPage() {
  await requireAdmin();
  const t = await getTranslations("admin.avatars");
  const tHome = await getTranslations("admin.home");

  const steps = [
    t("wizard.stepIdentity"),
    t("wizard.stepClinical"),
    t("wizard.stepPersonality"),
    t("wizard.stepBehaviour"),
    t("wizard.stepVoice"),
    t("wizard.stepTherapy"),
    t("wizard.stepPreview"),
    t("wizard.stepValidate"),
    t("wizard.stepPublish"),
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("create")}
        subtitle={t("createHint")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title"), href: "/admin/avatars" },
          { label: t("create") },
        ]}
      />

      <div className="clinical-card space-y-6 p-6">
        <p className="text-sm text-[var(--on-surface-variant)]">
          {t("wizard.intro")}
        </p>
        <ol className="list-decimal space-y-2 ps-5 text-sm text-[var(--on-surface)]">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--secondary)_8%,transparent)] p-4 text-sm">
          <p className="font-semibold text-[var(--on-surface)]">
            {t("wizard.persistenceDisabled")}
          </p>
          <p className="mt-1 text-[var(--on-surface-variant)]">
            {t("wizard.persistenceDisabledHint")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled>
            {t("wizard.saveDisabled")}
          </button>
          <Link href="/admin/avatars" className="btn-secondary">
            {t("wizard.back")}
          </Link>
        </div>

        <AdvancedDetails title={t("wizard.advancedTitle")}>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {t("wizard.advancedBody")}
          </p>
        </AdvancedDetails>
      </div>
    </main>
  );
}
