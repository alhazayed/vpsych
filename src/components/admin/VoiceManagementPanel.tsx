"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import type { Avatar, VoiceProfile } from "@/lib/types";
import { normalizeSpeechLocale } from "@/lib/voice/config";
import type {
  ClinicalEmotion,
  EffectiveClinicalVoice,
} from "@/lib/clinical-voice";

type AvatarRow = Pick<
  Avatar,
  "id" | "name" | "gender" | "voice_profile_id" | "is_active"
>;

type ClinicalDraft = {
  speech_rate: number;
  pitch: number;
  energy: NonNullable<VoiceProfile["energy"]>;
  prosody: NonNullable<VoiceProfile["prosody"]>;
  breathing: NonNullable<VoiceProfile["breathing"]>;
  hesitation_frequency: number;
  speaker_boost: number;
  emotion_modulation: boolean;
  pronunciation_ar: string;
  pronunciation_en: string;
};

const EMOTIONS: ClinicalEmotion[] = [
  "neutral",
  "depressed",
  "anxious",
  "manic",
  "psychotic",
];

function draftFromProfile(profile: VoiceProfile): ClinicalDraft {
  return {
    speech_rate: profile.speech_rate ?? 1,
    pitch: profile.pitch ?? 1,
    energy: profile.energy ?? "moderate",
    prosody: profile.prosody ?? "measured",
    breathing: profile.breathing ?? "calm",
    hesitation_frequency: profile.hesitation_frequency ?? 0.18,
    speaker_boost: profile.speaker_boost ?? 0.75,
    emotion_modulation: profile.emotion_modulation ?? true,
    pronunciation_ar: profile.pronunciation_ar ?? "",
    pronunciation_en: profile.pronunciation_en ?? "",
  };
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClinicalDraft | null>(null);
  const [liveEmotion, setLiveEmotion] = useState<ClinicalEmotion>("neutral");
  const [effective, setEffective] = useState<EffectiveClinicalVoice | null>(
    null,
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

  function openEditor(profile: VoiceProfile) {
    setEditingId(profile.id);
    setDraft(draftFromProfile(profile));
    setLiveEmotion("neutral");
    setEffective(null);
    setError(null);
  }

  function closeEditor() {
    setEditingId(null);
    setDraft(null);
    setEffective(null);
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

  async function saveClinical(profileId: string) {
    if (!draft) return;
    setError(null);
    const res = await fetch(`/api/admin/voice-profiles/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speech_rate: draft.speech_rate,
        pitch: draft.pitch,
        energy: draft.energy,
        prosody: draft.prosody,
        breathing: draft.breathing,
        hesitation_frequency: draft.hesitation_frequency,
        speaker_boost: draft.speaker_boost,
        emotion_modulation: draft.emotion_modulation,
        pronunciation_ar: draft.pronunciation_ar || null,
        pronunciation_en: draft.pronunciation_en || null,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? t("errors.save"));
      return;
    }
    const data = (await res.json()) as { voiceProfile: VoiceProfile };
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? data.voiceProfile : p)),
    );
    setDraft(draftFromProfile(data.voiceProfile));
    refresh();
  }

  async function previewLiveSwitch(profileId: string, emotion: ClinicalEmotion) {
    setLiveEmotion(emotion);
    setError(null);
    const res = await fetch(
      `/api/admin/voice-profiles/${profileId}/live-switch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emotion }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? t("errors.liveSwitch"));
      return;
    }
    const data = (await res.json()) as { effective: EffectiveClinicalVoice };
    setEffective(data.effective);
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
          const isEditing = editingId === profile.id;
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
                    {t("columns.rate")}
                  </dt>
                  <dd className="mt-0.5 font-medium text-[var(--on-surface)]">
                    {(profile.speech_rate ?? 1).toFixed(2)}× ·{" "}
                    {profile.energy ?? "moderate"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <VoicePreviewButton
                  locale={locale}
                  voiceId={locale === "en" ? profile.voice_id : undefined}
                  voiceIdAr={locale === "ar" ? profile.voice_id : undefined}
                  voiceProfileId={profile.id}
                  emotion={isEditing ? liveEmotion : undefined}
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    isEditing ? closeEditor() : openEditor(profile)
                  }
                  className="btn-secondary h-9 px-3 text-xs"
                >
                  {isEditing ? t("editor.close") : t("editor.open")}
                </button>
              </div>

              {isEditing && draft && (
                <div className="mt-5 space-y-4 border-t border-[var(--outline-variant)] pt-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                    {t("editor.title")}
                  </h3>
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {t("editor.subtitle")}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.speechRate")}
                      </span>
                      <input
                        type="number"
                        min={0.5}
                        max={1.8}
                        step={0.01}
                        value={draft.speech_rate}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            speech_rate: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.pitch")}
                      </span>
                      <input
                        type="number"
                        min={0.5}
                        max={1.8}
                        step={0.01}
                        value={draft.pitch}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            pitch: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.energy")}
                      </span>
                      <select
                        value={draft.energy}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            energy: e.target
                              .value as ClinicalDraft["energy"],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      >
                        <option value="low">low</option>
                        <option value="moderate">moderate</option>
                        <option value="high">high</option>
                        <option value="labile">labile</option>
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.prosody")}
                      </span>
                      <select
                        value={draft.prosody}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            prosody: e.target
                              .value as ClinicalDraft["prosody"],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      >
                        <option value="flat">flat</option>
                        <option value="measured">measured</option>
                        <option value="anxious_edge">anxious_edge</option>
                        <option value="pressured">pressured</option>
                        <option value="fragmented">fragmented</option>
                        <option value="labile">labile</option>
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.breathing")}
                      </span>
                      <select
                        value={draft.breathing}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            breathing: e.target
                              .value as ClinicalDraft["breathing"],
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      >
                        <option value="calm">calm</option>
                        <option value="short">short</option>
                        <option value="deep">deep</option>
                        <option value="irregular">irregular</option>
                        <option value="held">held</option>
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.hesitation")}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={draft.hesitation_frequency}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            hesitation_frequency: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="text-[var(--outline)]">
                        {t("editor.speakerBoost")}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={draft.speaker_boost}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            speaker_boost: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs pt-6">
                      <input
                        type="checkbox"
                        checked={draft.emotion_modulation}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            emotion_modulation: e.target.checked,
                          })
                        }
                      />
                      <span className="text-[var(--on-surface)]">
                        {t("editor.emotionModulation")}
                      </span>
                    </label>
                    <label className="block text-xs sm:col-span-2">
                      <span className="text-[var(--outline)]">
                        {t("editor.pronunciationAr")}
                      </span>
                      <input
                        type="text"
                        value={draft.pronunciation_ar}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            pronunciation_ar: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs sm:col-span-2">
                      <span className="text-[var(--outline)]">
                        {t("editor.pronunciationEn")}
                      </span>
                      <input
                        type="text"
                        value={draft.pronunciation_en}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            pronunciation_en: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void saveClinical(profile.id)}
                      className="btn-primary h-9 px-3 text-xs"
                    >
                      {t("editor.save")}
                    </button>
                  </div>

                  <div className="rounded-lg bg-[var(--surface-container)] p-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                      {t("liveSwitch.title")}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                      {t("liveSwitch.subtitle")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {EMOTIONS.map((emotion) => (
                        <button
                          key={emotion}
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            void previewLiveSwitch(profile.id, emotion)
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                            liveEmotion === emotion
                              ? "bg-[var(--primary)] text-[var(--on-primary)]"
                              : "bg-[var(--surface)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                          }`}
                        >
                          {t(`liveSwitch.emotions.${emotion}`)}
                        </button>
                      ))}
                    </div>
                    {effective && (
                      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-[var(--outline)]">
                            {t("editor.speechRate")}
                          </dt>
                          <dd className="font-medium">
                            {effective.speech_rate.toFixed(2)}×
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--outline)]">
                            {t("editor.energy")}
                          </dt>
                          <dd className="font-medium capitalize">
                            {effective.energy}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[var(--outline)]">
                            {t("editor.prosody")}
                          </dt>
                          <dd className="font-medium">{effective.prosody}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--outline)]">
                            {t("editor.breathing")}
                          </dt>
                          <dd className="font-medium">{effective.breathing}</dd>
                        </div>
                        <div>
                          <dt className="text-[var(--outline)]">
                            {t("liveSwitch.pauseScale")}
                          </dt>
                          <dd className="font-medium">
                            {effective.pause_scale.toFixed(2)}
                          </dd>
                        </div>
                        <div className="sm:col-span-3">
                          <dt className="text-[var(--outline)]">
                            {t("liveSwitch.note")}
                          </dt>
                          <dd className="mt-0.5 text-[var(--on-surface-variant)]">
                            {effective.modulation_note}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>
              )}

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
