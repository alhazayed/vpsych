import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { CqiAdminDashboard } from "@/components/cqi/CqiAdminDashboard";

export default async function AdminCqiPage() {
  await requireAdmin();
  const t = await getTranslations("admin.cqi");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </header>
      <CqiAdminDashboard />
    </div>
  );
}
