import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { CompetencyGraphView } from "@/components/cge/CompetencyGraphView";

export default async function LearningGraphPage() {
  await requireUser();
  const t = await getTranslations("learning.graph");
  const tLearning = await getTranslations("learning");

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-6 fade-in-up">
        <Link
          href="/learning"
          className="text-sm font-semibold text-[var(--primary)] hover:underline"
        >
          ← {tLearning("title")}
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>
      <CompetencyGraphView />
    </main>
  );
}
