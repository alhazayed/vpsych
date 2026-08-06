import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { ReviewerValidationDashboard } from "@/components/cvp/ReviewerValidationDashboard";

export default async function ValidationPage() {
  await requireProfile();
  const t = await getTranslations("cvp.reviewer");

  return (
    <main className="mx-auto max-w-[960px] space-y-6 px-4 py-8 md:px-8">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          {t("eyebrow")}
        </p>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </header>
      <ReviewerValidationDashboard />
    </main>
  );
}
