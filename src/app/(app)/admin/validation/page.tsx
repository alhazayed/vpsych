import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { ClinicalValidationDashboard } from "@/components/cvp/ClinicalValidationDashboard";

export default async function AdminValidationPage() {
  await requireAdmin();
  const t = await getTranslations("cvp.admin");

  return (
    <main className="mx-auto max-w-[1280px] space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          {t("eyebrow")}
        </p>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-3xl text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </header>
      <ClinicalValidationDashboard />
    </main>
  );
}
