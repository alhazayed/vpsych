import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { getBuiltinCatalog } from "@/lib/case-engine/catalog";
import { CaseEnginePanel } from "@/components/admin/CaseEnginePanel";
import { disorderNameText } from "@/lib/sessions/diagnosis-label";

export default async function AdminCasesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.cases");
  const tDisorders = await getTranslations("skillTests.disorders");
  const tDefaultDisorders = await getTranslations("avatars.defaultDisorders");
  const tDifficulty = await getTranslations("skillTests.difficulty");
  // Display only — stored names / slugs are never rewritten.
  const disorderText = (
    slug: string | null | undefined,
    name: string | null | undefined,
  ): string | null =>
    slug && tDisorders.has(slug)
      ? tDisorders(slug)
      : disorderNameText(name, tDisorders, tDefaultDisorders);
  const optionText = (
    group: "modalities" | "locales",
    value: string | null,
  ): string =>
    value && t.has(`${group}.${value}`) ? t(`${group}.${value}`) : (value ?? "—");

  const { data: avatars, error: avatarsError } = await supabase
    .from("avatars")
    .select("id, name, slug, is_active")
    .eq("is_active", true)
    .order("name");

  const { data: disorders, error: disordersError } = await supabase
    .from("disorders")
    .select("id, slug, name, dsm5_code, icd11_code, is_active")
    .eq("is_active", true)
    .order("name");

  const { data: recent, error: recentError } = await supabase
    .from("case_instances")
    .select(
      "id, assessment_id, locale, difficulty, therapy_modality, severity, created_at, clinical_snapshot",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  // Failed reads must not look like empty data or the built-in catalog.
  const failed = [avatarsError, disordersError, recentError].filter(Boolean);
  if (failed.length > 0) {
    console.error("[admin/cases] load failed", {
      errors: failed.map((e) => e?.message),
    });
    throw new Error("cases_unavailable");
  }

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
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>

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
              <span className="font-medium text-[var(--on-surface)]">
                {disorderText(d.slug, d.name) ?? d.name}
              </span>
              <span className="text-[var(--on-surface-variant)]">
                {t("codes", {
                  dsm: d.dsm5_code ?? "—",
                  icd: d.icd11_code ?? "—",
                })}
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
                primary_diagnosis?: { name?: string; slug?: string };
                persona?: { display_name?: string };
              } | null;
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
                >
                  <div className="font-medium text-[var(--on-surface)]">
                    {snap?.persona?.display_name ?? t("personaFallback")} ·{" "}
                    {disorderText(
                      snap?.primary_diagnosis?.slug,
                      snap?.primary_diagnosis?.name,
                    ) ?? t("diagnosisFallback")}
                  </div>
                  <div className="mt-1 text-[var(--on-surface-variant)]">
                    {c.assessment_id} · {optionText("locales", c.locale)} ·{" "}
                    {c.difficulty && tDifficulty.has(c.difficulty)
                      ? tDifficulty(c.difficulty)
                      : c.difficulty}{" "}
                    · {optionText("modalities", c.therapy_modality)} ·{" "}
                    {c.severity && t.has(`severities.${c.severity}`)
                      ? t(`severities.${c.severity}`)
                      : c.severity}
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
