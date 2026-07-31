import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import type { Avatar } from "@/lib/types";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";

export default async function AdminAvatarsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.avatars");
  const tCommon = await getTranslations("common");
  const { data: avatars } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, is_active, ideal_guidelines, rubric, language, dialect, voice_id, voice_id_ar",
    )
    .order("name");

  const list =
    (avatars as
      | Pick<
          Avatar,
          | "id"
          | "name"
          | "disorder"
          | "age"
          | "gender"
          | "is_active"
          | "ideal_guidelines"
          | "rubric"
          | "language"
          | "dialect"
          | "voice_id"
          | "voice_id_ar"
        >[]
      | null) ?? [];

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

      <ul className="space-y-4">
        {list.map((avatar) => (
          <li key={avatar.id} className="clinical-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
                {avatar.name}
              </h2>
              <span
                className={`status-chip ${
                  avatar.is_active ? "status-chip-active" : "status-chip-warn"
                }`}
              >
                {avatar.is_active ? tCommon("active") : tCommon("inactive")}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              {avatar.disorder}
              {avatar.age ? ` · ${avatar.age}` : ""}
              {avatar.gender ? ` · ${avatar.gender}` : ""}
            </p>

            <div className="mt-4 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                  ElevenLabs voice
                </h3>
                <p className="text-[11px] text-[var(--on-surface-variant)]">
                  Stored as voice_id / voice_id_ar on the avatar
                </p>
              </div>
              <dl className="mt-2 grid gap-2 text-sm text-[var(--on-surface-variant)] sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider">
                    Language
                  </dt>
                  <dd className="font-medium text-[var(--on-surface)]">
                    {avatar.language ?? "en"}
                    {avatar.dialect ? ` · ${avatar.dialect}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider">
                    English voice_id
                  </dt>
                  <dd className="break-all font-mono text-xs text-[var(--on-surface)]">
                    {avatar.voice_id ?? "— (env default)"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider">
                    Arabic voice_id
                  </dt>
                  <dd className="break-all font-mono text-xs text-[var(--on-surface)]">
                    {avatar.voice_id_ar ?? "— (env default)"}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <VoicePreviewButton
                  locale="en"
                  voiceId={avatar.voice_id}
                  voiceIdAr={avatar.voice_id_ar}
                  label="Preview English"
                />
                <VoicePreviewButton
                  locale="ar"
                  voiceId={avatar.voice_id}
                  voiceIdAr={avatar.voice_id_ar}
                  label="Preview Arabic"
                />
              </div>
            </div>

            <h3 className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("goals")}
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--on-surface-variant)]">
              {(avatar.ideal_guidelines?.session_goals ?? []).map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">
                    check_circle
                  </span>
                  {g}
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("rubric")}
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--on-surface-variant)]">
              {(avatar.rubric ?? []).map((r) => (
                <li key={r.id}>
                  {t("rubricItem", {
                    label: r.label,
                    max: r.max,
                    weight: r.weight,
                  })}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
