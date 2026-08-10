import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { getBuiltinCatalog } from "@/lib/case-engine/catalog";
import { CaseEnginePanel } from "@/components/admin/CaseEnginePanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdvancedDetails } from "@/components/admin/AdvancedDetails";

export default async function AdminCasesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.cases");
  const tHome = await getTranslations("admin.home");

  const { data: avatars } = await supabase
    .from("avatars")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("name");

  const { data: disorders } = await supabase
    .from("disorders")
    .select("id, slug, name, dsm5_code, icd11_code, is_active")
    .eq("is_active", true)
    .order("name");

  const { data: recent } = await supabase
    .from("case_instances")
    .select(
      "id, assessment_id, locale, difficulty, therapy_modality, severity, created_at, clinical_snapshot",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const catalog = getBuiltinCatalog();
  const disorderList =
    disorders && disorders.length > 0
      ? disorders
      : catalog.disorders.map((d) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          dsm5_code: d.dsm5_code,
          icd11_code: d.icd11_code,
          is_active: d.is_active,
        }));

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

      <section className="mb-10 clinical-card p-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("disorders")}
        </h2>
        <ul className="space-y-2 text-sm">
          {disorderList.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--outline-variant)] pb-2 last:border-0"
            >
              <span className="font-medium text-[var(--on-surface)]">{d.name}</span>
              <span className="text-[var(--on-surface-variant)]">
                DSM-5 {d.dsm5_code ?? "—"} · ICD-11 {d.icd11_code ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 clinical-card p-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("preview")}
        </h2>
        <CaseEnginePanel
          avatars={(avatars ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            slug: a.slug,
          }))}
          disorders={disorderList}
        />
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("recent")}
        </h2>
        {!recent?.length ? (
          <p className="text-sm text-[var(--on-surface-variant)]">{t("empty")}</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {recent.map((c) => {
              const snap = c.clinical_snapshot as {
                primary_diagnosis?: { name?: string };
                persona?: { display_name?: string };
              } | null;
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
                >
                  <div className="font-medium text-[var(--on-surface)]">
                    {snap?.persona?.display_name ?? "Persona"} ·{" "}
                    {snap?.primary_diagnosis?.name ?? "Diagnosis"}
                  </div>
                  <div className="mt-1 text-[var(--on-surface-variant)]">
                    {c.locale} · {c.difficulty} · {c.therapy_modality} ·{" "}
                    {c.severity}
                  </div>
                  <div className="mt-2">
                    <AdvancedDetails title="Advanced details">
                      <pre className="overflow-auto text-xs">
                        {JSON.stringify(
                          {
                            assessment_id: c.assessment_id,
                            clinical_snapshot: c.clinical_snapshot,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </AdvancedDetails>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
