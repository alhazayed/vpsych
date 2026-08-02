import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { listBuiltinPresets } from "@/lib/instructor-presets";
import { InstructorPresetPanel } from "@/components/admin/InstructorPresetPanel";

export default async function AdminPresetsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.presets");

  const { data: presets } = await supabase
    .from("instructor_presets")
    .select(
      "id, slug, name, description, specialty, target_learner, learning_level, assessment_type, primary_objective, difficulty, time_limit_minutes, language, therapy_modality, grading_mode, feedback_mode, allow_hints, enabled, version",
    )
    .is("archived_at", null)
    .order("name");

  const list =
    presets && presets.length > 0
      ? presets
      : listBuiltinPresets().map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          specialty: p.specialty,
          target_learner: p.target_learner,
          learning_level: p.learning_level,
          assessment_type: p.assessment_type,
          primary_objective: p.primary_objective,
          difficulty: p.difficulty,
          time_limit_minutes: p.time_limit_minutes,
          language: p.language,
          therapy_modality: p.therapy_modality,
          grading_mode: p.grading_mode,
          feedback_mode: p.feedback_mode,
          allow_hints: p.allow_hints,
          enabled: p.enabled,
          version: p.version,
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
          {list.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[var(--on-surface)]">
                  {p.name}
                </span>
                <span className="text-[11px] text-[var(--on-surface-variant)]">
                  v{p.version} · {p.enabled ? "enabled" : "draft"}
                </span>
              </div>
              <p className="mt-1 text-[var(--on-surface-variant)]">
                {p.target_learner} · {p.primary_objective} · {p.assessment_type}{" "}
                · {p.language} · {p.difficulty} · {p.time_limit_minutes}min ·{" "}
                {p.therapy_modality}
              </p>
              {p.description && (
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {p.description}
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
        <InstructorPresetPanel
          presets={list.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            language: p.language,
            difficulty: p.difficulty,
            primary_objective: p.primary_objective,
            target_learner: p.target_learner,
            enabled: p.enabled,
          }))}
        />
      </section>
    </main>
  );
}
