import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type {
  WizardDisorderOption,
  WizardVoiceOption,
} from "@/components/admin/VirtualPatientWizard";
import { CreatePatientModeSwitch } from "@/components/admin/case-builder/CreatePatientModeSwitch";
import { getTranslations } from "next-intl/server";

/**
 * Phase 9 — Guided AI Case Builder (default) + Advanced Virtual Patient wizard.
 */
export default async function AdminCreateVirtualPatientPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.avatars");
  const tHome = await getTranslations("admin.home");
  const tBuilder = await getTranslations("admin.caseBuilder");

  const [{ data: voiceRows }, { data: disorderRows }] = await Promise.all([
    supabase
      .from("voice_profiles")
      .select("id, voice_name, language, dialect, gender, is_active")
      .eq("is_active", true)
      .order("voice_name", { ascending: true }),
    supabase
      .from("disorders")
      .select("id, slug, name, is_active, category")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const voices = (voiceRows as WizardVoiceOption[] | null) ?? [];
  const disorders = (disorderRows as WizardDisorderOption[] | null) ?? [];

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={tBuilder("pageTitle")}
        subtitle={tBuilder("pageSubtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title"), href: "/admin/avatars" },
          { label: tBuilder("pageTitle") },
        ]}
      />

      <CreatePatientModeSwitch voices={voices} disorders={disorders} />
    </main>
  );
}
