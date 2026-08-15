import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { VirtualPatientDetail } from "@/components/admin/VirtualPatientDetail";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
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
  const tTranscript = await getTranslations("admin.testTranscript");

  const { data: avatar } = await supabase
    .from("avatars")
    .select(
      "id, name, slug, disorder, age, gender, is_active, lifecycle_status, language, dialect, voice_id, voice_id_ar, voice_profile_id, human_personality, personalities, clinical_core, persona_prompt, ideal_guidelines, rubric, portrait_url, schema_version, default_locale, available_locales, created_at, updated_at, voice_profile:voice_profiles(*)",
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

  // Phase 4 P0-1 — admin-test sessions for this virtual patient, so a
  // completed test conversation is reachable for transcript review. The
  // admin-test determination comes from the persisted clinical_snapshot via
  // the shared helper, never from client state.
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, status, started_at, ended_at, created_at, clinical_snapshot")
    .eq("avatar_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const testSessions = ((sessionRows ?? []) as {
    id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
    created_at: string;
    clinical_snapshot: unknown;
  }[])
    .filter((s) => isAdminTestSnapshot(s.clinical_snapshot))
    .map((s) => ({
      id: s.id,
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      createdAt: s.created_at,
    }));

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
      testSessions={testSessions}
      labels={{
        home: tHome("title"),
        library: t("title"),
        statusDraft: t("statusDraft"),
        statusTesting: t("statusTesting"),
        statusPublished: t("statusPublished"),
        statusArchived: t("statusArchived"),
        testSessionsHeading: tTranscript("listHeading"),
        testSessionsEmpty: tTranscript("listEmpty"),
        testSessionsView: tTranscript("listView"),
        testSessionsNotice: tTranscript("listNotice"),
        statusActive: tTranscript("statusActive"),
        statusCompleted: tTranscript("statusCompleted"),
        statusExpired: tTranscript("statusExpired"),
      }}
    />
  );
}
