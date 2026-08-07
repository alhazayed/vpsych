import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { SupervisorDashboardPanel } from "@/components/supervisor/SupervisorDashboardPanel";

export default async function SupervisorLearningPage() {
  await requireUser();
  const t = await getTranslations("learning.supervisor");

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>
      <SupervisorDashboardPanel />
    </main>
  );
}
