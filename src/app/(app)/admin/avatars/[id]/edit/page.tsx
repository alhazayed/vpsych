import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { throwOnLoadError } from "@/lib/admin/page-load";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EditPatientModeSwitch } from "@/components/admin/case-builder/EditPatientModeSwitch";
import type {
  WizardDisorderOption,
  WizardVoiceOption,
} from "@/components/admin/VirtualPatientWizard";
import {
  assessCaseReadinessFromAvatar,
  isEditableLifecycle,
  readLifecycleStatus,
} from "@/lib/admin/virtual-patient";
import { avatarToGuidedDraft } from "@/lib/admin/case-builder";
import type { Avatar } from "@/lib/types";
import { getTranslations } from "next-intl/server";

/**
 * Phase 10C-2 — Guided Edit (default) + Advanced for existing draft|testing
 * Virtual Patients. Published/archived are immutable; duplicate or restore first.
 * Guided saves merge approved fields only — never full reconstruct/overwrite.
 */
export default async function AdminEditVirtualPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.avatars");
  const tHome = await getTranslations("admin.home");
  const tBuilder = await getTranslations("admin.caseBuilder");

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwOnLoadError(avatarError, "admin-avatar-edit");
  if (!avatar) notFound();

  const typed = avatar as Avatar;
  const lifecycleStatus = readLifecycleStatus(typed);
  if (!isEditableLifecycle(lifecycleStatus)) {
    redirect(`/admin/avatars/${id}`);
  }

  const [{ data: voiceRows }, { data: disorderRows }, { data: persona }] =
    await Promise.all([
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
      supabase
        .from("personas")
        .select(
          "id, slug, display_name, default_disorder_id, identity, traits, is_active",
        )
        .eq("avatar_id", id)
        .maybeSingle(),
    ]);

  const voices = (voiceRows as WizardVoiceOption[] | null) ?? [];
  const disorders = (disorderRows as WizardDisorderOption[] | null) ?? [];
  const mapped = avatarToGuidedDraft(typed, persona);
  const readiness = assessCaseReadinessFromAvatar(typed, persona);

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("continueAuthoring")}
        subtitle={tBuilder("editPageSubtitle", {
          name: typed.name ?? id,
        })}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title"), href: "/admin/avatars" },
          {
            label: typed.name ?? id,
            href: `/admin/avatars/${id}`,
          },
          { label: t("continueAuthoring") },
        ]}
      />

      <EditPatientModeSwitch
        voices={voices}
        disorders={disorders}
        caseIdentity={{
          id: typed.id,
          name: typed.name ?? typed.slug ?? id,
          slug: typed.slug ?? "",
          lifecycleStatus,
        }}
        initialDraft={mapped.draft}
        initialReadiness={readiness}
        arabicAuthorship={mapped.arabicAuthorship}
        presentationUnresolved={mapped.presentationUnresolved}
      />
    </main>
  );
}
