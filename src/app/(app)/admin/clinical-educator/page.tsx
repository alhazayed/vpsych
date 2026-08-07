import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { ClinicalEducatorPanel } from "@/components/admin/ClinicalEducatorPanel";

export default async function AdminClinicalEducatorPage() {
  await requireAdmin();
  const t = await getTranslations("admin.clinicalEducator");

  return (
    <main className="mx-auto max-w-[1100px] space-y-8 px-4 py-8 md:px-8">
      <section className="fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>
      <ClinicalEducatorPanel />
    </main>
  );
}
