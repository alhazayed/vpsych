import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminFeedbackPanel } from "@/components/enterprise/AdminFeedbackPanel";

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const t = await getTranslations("admin.feedbackPage");

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <section className="mb-8">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>
      <AdminFeedbackPanel />
    </main>
  );
}
