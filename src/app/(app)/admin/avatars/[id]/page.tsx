import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { VirtualPatientDetail } from "@/components/admin/VirtualPatientDetail";
import {
  getBuiltinPersonality,
  listBuiltinPersonalitySlugs,
  resolveHumanPersonality,
} from "@/lib/personality-engine";
import { coerceVoiceProfile } from "@/lib/voice/registry";
import type { Avatar, VoiceProfile } from "@/lib/types";
import { getTranslations } from "next-intl/server";

export default async function AdminAvatarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.avatars");
  const tHome = await getTranslations("admin.home");

  const { data: avatar } = await supabase
    .from("avatars")
    .select(
      "id, name, slug, disorder, age, gender, is_active, language, dialect, voice_id, voice_id_ar, voice_profile_id, human_personality, personalities, clinical_core, persona_prompt, ideal_guidelines, rubric, portrait_url, schema_version, default_locale, available_locales, created_at, updated_at, voice_profile:voice_profiles(*)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!avatar) notFound();

  const row = avatar as Avatar & {
    voice_profile?: VoiceProfile | VoiceProfile[] | null;
  };
  const voiceProfile = coerceVoiceProfile(row.voice_profile);

  const locale =
    row.default_locale ??
    (row.personalities && Object.keys(row.personalities)[0]) ??
    "en-US";
  const profile = resolveHumanPersonality({ avatar: row, locale });
  const locales = Object.keys(row.human_personality ?? {}).length
    ? Object.keys(row.human_personality ?? {})
    : row.slug && listBuiltinPersonalitySlugs().includes(row.slug)
      ? (["en-US", "ar-JO"] as const).filter((l) =>
          Boolean(getBuiltinPersonality(row.slug!, l)),
        )
      : [locale];

  const personalityAvatars = [
    {
      id: row.id,
      name: row.name,
      slug: row.slug ?? null,
      disorder: row.disorder,
      is_active: row.is_active,
      locales: [...locales],
      profile: profile as unknown as Record<string, unknown>,
    },
  ];

  return (
    <VirtualPatientDetail
      avatar={row}
      voiceProfile={voiceProfile}
      personalityAvatars={personalityAvatars}
      labels={{
        home: tHome("title"),
        library: t("title"),
        active: t("active"),
        inactive: t("inactive"),
      }}
    />
  );
}
