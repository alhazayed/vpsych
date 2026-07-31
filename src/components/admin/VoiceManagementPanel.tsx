"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import type { Avatar, VoiceProfile } from "@/lib/types";
import { normalizeSpeechLocale } from "@/lib/voice/config";

type AvatarRow = Pick<
  Avatar,
  "id" | "name" | "gender" | "voice_profile_id" | "is_active"
>;

export function VoiceManagementPanel({
  initialProfiles,
  avatars,
}: {
  initialProfiles: VoiceProfile[];
  avatars: AvatarRow[];
}) {
  const t = useTranslations("admin.voices");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [avatarMap, setAvatarMap] = useState(() =>
    Object.fromEntries(avatars.map((a) => [a.id, a.voice_profile_id ?? null])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assignmentsByProfile = useMemo(() => {
    const map = new Map<string, AvatarRow[]>();
    for (const avatar of avatars) {
      const pid = avatarMap[avatar.id];
      if (!pid) continue;
      const list = map.get(pid) ?? [];
      list.push(avatar);
      map.set(pid, list);
    }
    return map;
  }, [avatarMap, avatars]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function toggleActive(profile: VoiceProfile) {
    setError(null);
    const next = !profile.is_active;
    const res = await fetch(`/api/admin/voice-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? t("errors.toggle"));
      return;
    }
    const data = (await res.json()) as { voiceProfile: VoiceProfile };
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? data.voiceProfile : p)),
    );
    refresh();
  }

  async function assignAvatar(avatarId: string, voiceProfileId: string | null) {
    setError(null);
    const res = await fetch(`/api/admin/avatars/${avatarId}/voice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_profile_id: voiceProfileId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? t("errors.assign"));
      return;
    }
    setAvatarMap((prev) => ({ ...prev, [avatarId]: voiceProfileId }));
    refresh();
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-[var(--error)]/30 bg-[color-mix(in_srgb,var(--error)_8%,transparent)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </p>
      )}

      <ul className="space-y-4">
        {profiles.map((profile) => {
          const locale = normalizeSpeechLocale(profile.language);
          const assigned = assignmentsByProfile.get(profile.id) ?? [];
          return (
            <li key={profile.id} className="clinical-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
                    {profile.voice_name}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[var(--on-surface-variant)]">
                    {profile.voice_id}
                  </p>
                </div>
                <span
                  className={`status-chip ${
                    profile.is_active
                      ? "status-chip-active"
                      : "status-chip-warn"
                  }`}
                >
                  {profile.is_active ? tCommon("active") : tCommon("inactive")}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--outline)]">
                    {t("columns.gender")}
                  </dt>
                  <dd className="mt-0.5 font-medium capitalize text-[var(--on-surface)]">
                    {profile.gender ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--outline)]">
                    {t("columns.language")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--on-surface)]">
                    {profile.language === "ar"
                      ? tCommon("arabic")
                      : tCommon("english")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--outline)]">
                    {t("columns.dialect")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--on-surface)]">
                    {profile.dialect ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--outline)]">
                    {t("columns.provider")}
                  </dt>
                  <dd className="mt-0.5 font-medium capitalize text-[var(--on-surface)]">
                    {profile.provider}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <VoicePreviewButton
                  locale={locale}
                  voiceId={locale === "en" ? profile.voice_id : undefined}
                  voiceIdAr={locale === "ar" ? profile.voice_id : undefined}
                  voiceProfileId={profile.id}
                  label={t("preview")}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void toggleActive(profile)}
                  className="btn-secondary h-9 px-3 text-xs"
                >
                  {profile.is_active ? t("disable") : t("enable")}
                </button>
              </div>

              <div className="mt-5 border-t border-[var(--outline-variant)] pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                  {t("assignTitle")}
                </h3>
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {assigned.length
                    ? t("assignedTo", {
                        names: assigned.map((a) => a.name).join(", "),
                      })
                    : t("unassigned")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {avatars.map((avatar) => {
                    const isAssigned = avatarMap[avatar.id] === profile.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        disabled={pending || (!profile.is_active && !isAssigned)}
                        onClick={() =>
                          void assignAvatar(
                            avatar.id,
                            isAssigned ? null : profile.id,
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          isAssigned
                            ? "bg-[var(--primary)] text-[var(--on-primary)]"
                            : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                        } disabled:opacity-50`}
                      >
                        {isAssigned
                          ? t("unassignAvatar", { name: avatar.name })
                          : t("assignAvatar", { name: avatar.name })}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {profiles.length === 0 && (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("empty")}</p>
      )}
    </div>
  );
}
