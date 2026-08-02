import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { InstructorGraphPanel } from "@/components/cge/InstructorGraphPanel";

export default async function AdminCompetencyGraphPage() {
  await requireAdmin();
  const t = await getTranslations("admin.graph");

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
      <InstructorGraphPanel />
    </main>
  );
}
