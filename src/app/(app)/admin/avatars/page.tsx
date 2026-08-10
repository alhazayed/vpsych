import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  VirtualPatientLibrary,
  type VirtualPatientListItem,
} from "@/components/admin/VirtualPatientLibrary";
import { coerceVoiceProfile } from "@/lib/voice/registry";
import type { VoiceProfile } from "@/lib/types";

type AvatarAdminRow = VirtualPatientListItem & {
  voice_profile?: VoiceProfile | VoiceProfile[] | null;
};

export default async function AdminAvatarsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.avatars");
  const tHome = await getTranslations("admin.home");

  const { data: avatars } = await supabase
    .from("avatars")
    .select(
      "id, name, slug, disorder, age, gender, is_active, language, dialect, voice_id, voice_id_ar, voice_profile_id, human_personality, personalities, clinical_core, persona_prompt, available_locales, portrait_url, voice_profile:voice_profiles(*)",
    )
    .order("name");

  const patients: VirtualPatientListItem[] = (
    (avatars as AvatarAdminRow[] | null) ?? []
  ).map((row) => {
    const profile = coerceVoiceProfile(row.voice_profile);
    return {
      ...row,
      voice_profile_name: profile?.voice_name ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title") },
        ]}
      />
      <VirtualPatientLibrary
        patients={patients}
        labels={{
          search: t("search"),
          filterAll: t("filterAll"),
          filterActive: t("filterActive"),
          filterInactive: t("filterInactive"),
          filterIncomplete: t("filterIncomplete"),
          sortName: t("sortName"),
          sortDiagnosis: t("sortDiagnosis"),
          sortStatus: t("sortStatus"),
          sortCompleteness: t("sortCompleteness"),
          empty: t("empty"),
          view: t("view"),
          create: t("create"),
          createHint: t("createHint"),
          active: t("active"),
          inactive: t("inactive"),
          complete: t("complete"),
          incomplete: t("incomplete"),
          voiceOk: t("voiceOk"),
          voiceMissing: t("voiceMissing"),
          personalityOk: t("personalityOk"),
          personalityPartial: t("personalityPartial"),
          personalityMissing: t("personalityMissing"),
        }}
      />
    </main>
  );
}
