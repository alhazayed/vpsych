import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  VirtualPatientWizard,
  type WizardDisorderOption,
  type WizardVoiceOption,
} from "@/components/admin/VirtualPatientWizard";
import {
  isEditableLifecycle,
  readLifecycleStatus,
} from "@/lib/admin/virtual-patient";
import type { Avatar } from "@/lib/types";
import { getTranslations } from "next-intl/server";

/**
 * Phase 10C-1 — Advanced editor for existing draft|testing Virtual Patients.
 * Published/archived are immutable here; duplicate or restore first.
 * Does not implement Guided Edit (later 10C stages).
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
  const tWizard = await getTranslations("admin.avatars.wizard");

  const { data: avatar } = await supabase
    .from("avatars")
    .select("id, name, slug, lifecycle_status, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!avatar) notFound();

  const lifecycleStatus = readLifecycleStatus(avatar as Avatar);
  if (!isEditableLifecycle(lifecycleStatus)) {
    redirect(`/admin/avatars/${id}`);
  }

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
        title={t("continueAuthoring")}
        subtitle={t("continueAuthoringSubtitle", {
          name: (avatar as { name?: string }).name ?? id,
        })}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: t("title"), href: "/admin/avatars" },
          {
            label: (avatar as { name?: string }).name ?? id,
            href: `/admin/avatars/${id}`,
          },
          { label: t("continueAuthoring") },
        ]}
      />

      <p className="mb-6 text-sm text-[var(--on-surface-variant)]">
        {tWizard("editIntro")}
      </p>

      <VirtualPatientWizard
        voices={voices}
        disorders={disorders}
        avatarId={id}
      />
    </main>
  );
}
