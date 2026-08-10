"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdvancedDetails, AdvancedJson } from "@/components/admin/AdvancedDetails";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PersonalityEnginePanel } from "@/components/admin/PersonalityEnginePanel";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import {
  assessVirtualPatientCompleteness,
  listAvailableLocales,
} from "@/lib/admin/virtual-patient-completeness";
import type { Avatar, VoiceProfile } from "@/lib/types";

type TabId =
  | "overview"
  | "clinical"
  | "personality"
  | "behaviour"
  | "voice"
  | "therapy"
  | "preview"
  | "advanced";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "clinical", label: "Clinical profile" },
  { id: "personality", label: "Personality" },
  { id: "behaviour", label: "Behaviour" },
  { id: "voice", label: "Voice" },
  { id: "therapy", label: "Therapy configuration" },
  { id: "preview", label: "Preview" },
  { id: "advanced", label: "Advanced" },
];

type PersonalityAvatar = {
  id: string;
  name: string;
  slug: string | null;
  disorder: string;
  is_active: boolean;
  locales: string[];
  profile: Record<string, unknown>;
};

export function VirtualPatientDetail({
  avatar,
  voiceProfile,
  personalityAvatars,
  labels,
}: {
  avatar: Avatar;
  voiceProfile: VoiceProfile | null;
  personalityAvatars: PersonalityAvatar[];
  labels: {
    home: string;
    library: string;
    active: string;
    inactive: string;
  };
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const completeness = useMemo(
    () => assessVirtualPatientCompleteness(avatar),
    [avatar],
  );
  const locales = useMemo(() => listAvailableLocales(avatar), [avatar]);

  const clinicalCore =
    avatar.clinical_core && typeof avatar.clinical_core === "object"
      ? (avatar.clinical_core as Record<string, unknown>)
      : null;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={avatar.name}
        subtitle={`${avatar.disorder}${avatar.age != null ? ` · ${avatar.age}` : ""}${avatar.gender ? ` · ${avatar.gender}` : ""}`}
        breadcrumbs={[
          { label: labels.home, href: "/admin" },
          { label: labels.library, href: "/admin/avatars" },
          { label: avatar.name },
        ]}
        actions={
          <StatusBadge
            label={avatar.is_active ? labels.active : labels.inactive}
            tone={avatar.is_active ? "active" : "inactive"}
          />
        }
      />

      <div
        role="tablist"
        aria-label="Virtual patient sections"
        className="mb-6 flex flex-wrap gap-2 border-b border-[var(--outline-variant)] pb-3"
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "bg-[var(--surface-container)] text-[var(--primary)]"
                  : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="clinical-card space-y-3 p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              Completeness
            </h2>
            <StatusBadge
              label={completeness.isComplete ? "Ready" : "Needs attention"}
              tone={completeness.isComplete ? "info" : "warning"}
            />
            {completeness.incompleteReasons.length ? (
              <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--on-surface-variant)]">
                {completeness.incompleteReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--on-surface-variant)]">
                Personality, voice, and clinical profile look complete for
                library use.
              </p>
            )}
          </div>
          <div className="clinical-card space-y-3 p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              Languages & voice
            </h2>
            <p className="text-sm text-[var(--on-surface)]">
              {locales.join(", ") || avatar.language || "—"}
            </p>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {voiceProfile
                ? `${voiceProfile.voice_name} (${voiceProfile.language}${voiceProfile.dialect ? ` / ${voiceProfile.dialect}` : ""})`
                : "No registry voice assigned"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/voices" className="btn-secondary">
                Manage voices
              </Link>
              <Link href="/admin/personality" className="btn-secondary">
                Open personality editor
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "clinical" ? (
        <section className="clinical-card space-y-4 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Clinical profile
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Listed diagnosis
              </dt>
              <dd className="mt-1 text-sm">{avatar.disorder}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Default locale
              </dt>
              <dd className="mt-1 text-sm">
                {avatar.default_locale ?? "—"}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Session diagnosis is minted per assessment by the case engine and
            stored on the clinical snapshot — it is not permanently owned by
            this patient record.
          </p>
          <AdvancedJson
            value={clinicalCore ?? { note: "No clinical_core JSON on row" }}
            title="Advanced: clinical_core"
          />
        </section>
      ) : null}

      {tab === "personality" ? (
        <section className="clinical-card p-5">
          <PersonalityEnginePanel initialAvatars={personalityAvatars} />
        </section>
      ) : null}

      {tab === "behaviour" ? (
        <section className="clinical-card space-y-3 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Behaviour
          </h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Disclosure style, resistance, and emotional reaction rules are
            authored in clinical packages and applied at session time. Editing
            those packages remains available through Cases / Templates /
            Presets — this tab consolidates orientation without duplicating
            engines.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/cases" className="btn-secondary">
              Cases
            </Link>
            <Link href="/admin/templates" className="btn-secondary">
              Templates
            </Link>
            <Link href="/admin/presets" className="btn-secondary">
              Presets
            </Link>
          </div>
        </section>
      ) : null}

      {tab === "voice" ? (
        <section className="clinical-card space-y-4 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Voice
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Assigned profile
              </dt>
              <dd className="mt-1 text-sm">
                {voiceProfile?.voice_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Language / dialect
              </dt>
              <dd className="mt-1 text-sm">
                {voiceProfile
                  ? `${voiceProfile.language}${voiceProfile.dialect ? ` · ${voiceProfile.dialect}` : ""}`
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {avatar.voice_id || avatar.voice_profile_id ? (
              <VoicePreviewButton
                locale="en"
                voiceId={avatar.voice_id}
                voiceProfileId={avatar.voice_profile_id}
                avatarId={avatar.id}
                label="Preview English"
              />
            ) : null}
            {avatar.voice_id_ar || avatar.voice_profile_id ? (
              <VoicePreviewButton
                locale="ar"
                voiceIdAr={avatar.voice_id_ar}
                voiceProfileId={avatar.voice_profile_id}
                avatarId={avatar.id}
                label="Preview Arabic"
              />
            ) : null}
            <Link href="/admin/voices" className="btn-secondary">
              Open voice library
            </Link>
          </div>
          <AdvancedDetails title="Advanced: voice identifiers">
            <pre className="overflow-auto text-xs">
              {JSON.stringify(
                {
                  voice_profile_id: avatar.voice_profile_id,
                  voice_id: avatar.voice_id,
                  voice_id_ar: avatar.voice_id_ar,
                  voiceProfile,
                },
                null,
                2,
              )}
            </pre>
          </AdvancedDetails>
        </section>
      ) : null}

      {tab === "therapy" ? (
        <section className="clinical-card space-y-3 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Therapy configuration
          </h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            Modality, difficulty, and objectives are selected when a session
            starts (or via instructor presets). Use the content libraries to
            preview configurations.
          </p>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            <li>
              <Link className="text-[var(--primary)] underline" href="/admin/presets">
                Instructor presets
              </Link>
            </li>
            <li>
              <Link className="text-[var(--primary)] underline" href="/admin/cases">
                Case preview
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      {tab === "preview" ? (
        <section className="clinical-card space-y-4 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            Patient preview
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Name
              </dt>
              <dd className="mt-1 text-sm">{avatar.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Diagnosis (catalog)
              </dt>
              <dd className="mt-1 text-sm">{avatar.disorder}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Languages
              </dt>
              <dd className="mt-1 text-sm">{locales.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Voice
              </dt>
              <dd className="mt-1 text-sm">
                {voiceProfile?.voice_name ?? "Not assigned"}
              </dd>
            </div>
          </dl>
          {avatar.ideal_guidelines?.session_goals?.length ? (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                Ideal session goals
              </h3>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                {avatar.ideal_guidelines.session_goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "advanced" ? (
        <section className="space-y-3">
          <AdvancedJson
            value={{
              id: avatar.id,
              slug: avatar.slug,
              schema_version: avatar.schema_version,
              is_active: avatar.is_active,
              default_locale: avatar.default_locale,
              available_locales: avatar.available_locales,
              voice_profile_id: avatar.voice_profile_id,
              voice_id: avatar.voice_id,
              voice_id_ar: avatar.voice_id_ar,
            }}
            title="Identifiers & schema"
          />
          <AdvancedJson
            value={avatar.clinical_core}
            title="clinical_core JSON"
          />
          <AdvancedJson
            value={avatar.human_personality}
            title="human_personality JSON"
          />
        </section>
      ) : null}
    </main>
  );
}
