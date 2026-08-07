import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { PersonalityEnginePanel } from "@/components/admin/PersonalityEnginePanel";
import {
  getBuiltinPersonality,
  listBuiltinPersonalitySlugs,
  resolveHumanPersonality,
} from "@/lib/personality-engine";
import type { Avatar } from "@/lib/types";

export default async function AdminPersonalityPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.personality");

  const { data: avatars } = await supabase
    .from("avatars")
    .select(
      "id, name, slug, disorder, age, gender, is_active, human_personality, personalities, schema_version, default_locale, clinical_core, persona_prompt, ideal_guidelines, rubric, portrait_url, created_at, updated_at",
    )
    .order("name");

  const list = ((avatars as Avatar[] | null) ?? []).map((avatar) => {
    const locale =
      avatar.default_locale ??
      (avatar.personalities && Object.keys(avatar.personalities)[0]) ??
      "en-US";
    const profile = resolveHumanPersonality({ avatar, locale });
    const locales = Object.keys(avatar.human_personality ?? {}).length
      ? Object.keys(avatar.human_personality ?? {})
      : avatar.slug && listBuiltinPersonalitySlugs().includes(avatar.slug)
        ? (["en-US", "ar-JO"] as const).filter((l) =>
            Boolean(getBuiltinPersonality(avatar.slug!, l)),
          )
        : [locale];
    return {
      id: avatar.id,
      name: avatar.name,
      slug: avatar.slug ?? null,
      disorder: avatar.disorder,
      is_active: avatar.is_active,
      locales: [...locales],
      profile: profile as unknown as Record<string, unknown>,
    };
  });

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          {t("subtitle")}
        </p>
      </section>

      <section className="clinical-card p-5">
        <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("editor")}
        </h2>
        <PersonalityEnginePanel initialAvatars={list} />
      </section>
    </main>
  );
}
