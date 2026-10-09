import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { InstitutionalFeedbackForm } from "@/components/enterprise/InstitutionalFeedbackForm";

export default async function FeedbackPage() {
  await requireProfile();
  const t = await getTranslations("feedback");

  return (
    <main className="mx-auto max-w-[720px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("intro")}
        </p>
      </section>
      <InstitutionalFeedbackForm />
    </main>
  );
}
