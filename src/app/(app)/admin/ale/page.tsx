import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AleDashboardClient } from "@/components/admin/AleDashboardClient";

export default async function AdaptiveLearningEffectivenessPage() {
  await requireAdmin();
  const t = await getTranslations("admin.ale");

  return (
    <main className="mx-auto max-w-[1280px] space-y-8 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
          {t("eyebrow")}
        </p>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("title")}
        </h1>
        <p className="max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </header>
      <AleDashboardClient />
    </main>
  );
}
