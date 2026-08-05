import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { EoiAdminDashboard } from "@/components/eoi/EoiAdminDashboard";

export default async function AdminEoiPage() {
  await requireAdmin();
  const t = await getTranslations("admin.eoi");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-teal-900">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </header>
      <EoiAdminDashboard />
    </div>
  );
}
