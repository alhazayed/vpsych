import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listBuiltinTemplates } from "@/lib/scenario-templates/catalog";
import { TemplateEnginePanel } from "@/components/admin/TemplateEnginePanel";

export default async function AdminTemplatesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.templates");

  const { data: templates } = await supabase
    .from("clinical_templates")
    .select(
      "id, slug, name, description, specialty, difficulty, language, therapy_modality, severity, assessment_type, enabled, version, estimated_duration_minutes",
    )
    .is("archived_at", null)
    .order("name");

  const list =
    templates && templates.length > 0
      ? templates
      : listBuiltinTemplates().map((tpl) => ({
          id: tpl.id,
          slug: tpl.slug,
          name: tpl.name,
          description: tpl.description,
          specialty: tpl.specialty,
          difficulty: tpl.difficulty,
          language: tpl.language,
          therapy_modality: tpl.therapy_modality,
          severity: tpl.severity,
          assessment_type: tpl.assessment_type,
          enabled: tpl.enabled,
          version: tpl.version,
          estimated_duration_minutes: tpl.estimated_duration_minutes,
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
          {t("library")}
        </h2>
        <ul className="space-y-3 text-sm">
          {list.map((tpl) => (
            <li
              key={tpl.id}
              className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[var(--on-surface)]">
                  {tpl.name}
                </span>
                <span className="text-[11px] text-[var(--on-surface-variant)]">
                  v{tpl.version} · {tpl.enabled ? "enabled" : "draft"}
                </span>
              </div>
              <p className="mt-1 text-[var(--on-surface-variant)]">
                {tpl.specialty} · {tpl.assessment_type} · {tpl.language} ·{" "}
                {tpl.difficulty} · {tpl.severity} · {tpl.therapy_modality}
              </p>
              {tpl.description && (
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {tpl.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("preview")}
        </h2>
        <TemplateEnginePanel
          templates={list.map((tpl) => ({
            id: tpl.id,
            slug: tpl.slug,
            name: tpl.name,
            specialty: tpl.specialty,
            language: tpl.language,
            difficulty: tpl.difficulty,
            enabled: tpl.enabled,
          }))}
        />
      </section>
    </main>
  );
}
