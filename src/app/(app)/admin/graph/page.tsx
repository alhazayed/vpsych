import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { InstructorGraphPanel } from "@/components/cge/InstructorGraphPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default async function AdminCompetencyGraphPage() {
  await requireAdmin();
  const t = await getTranslations("admin.graph");
  const tHome = await getTranslations("admin.home");

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />
      <InstructorGraphPanel />
    </main>
  );
}
