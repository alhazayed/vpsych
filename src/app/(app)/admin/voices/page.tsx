import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { VoiceManagementPanel } from "@/components/admin/VoiceManagementPanel";
import type { Avatar, VoiceProfile } from "@/lib/types";

export default async function AdminVoicesPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.voices");

  const [{ data: profiles }, { data: avatars }] = await Promise.all([
    supabase
      .from("voice_profiles")
      .select("*")
      .order("voice_name", { ascending: true }),
    supabase
      .from("avatars")
      .select("id, name, gender, voice_profile_id, is_active")
      .order("name", { ascending: true }),
  ]);

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

      <VoiceManagementPanel
        initialProfiles={(profiles as VoiceProfile[] | null) ?? []}
        avatars={
          (avatars as
            | Pick<
                Avatar,
                "id" | "name" | "gender" | "voice_profile_id" | "is_active"
              >[]
            | null) ?? []
        }
      />
    </main>
  );
}
