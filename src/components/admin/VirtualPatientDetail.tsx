"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AdvancedDetails, AdvancedJson } from "@/components/admin/AdvancedDetails";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PersonalityEnginePanel } from "@/components/admin/PersonalityEnginePanel";
import { VirtualPatientLifecycleActions } from "@/components/admin/VirtualPatientLifecycleActions";
import { StartAdminTestConversationButton } from "@/components/admin/StartAdminTestConversationButton";
import {
  CaseReadinessPanel,
  DEFAULT_READINESS_LABELS,
  type CaseReadinessLabels,
} from "@/components/admin/CaseReadinessPanel";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import { listAvailableLocales } from "@/lib/admin/virtual-patient-completeness";
import {
  lifecycleBadgeTone,
  readLifecycleFromRow,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient-lifecycle";
import type { CaseReadinessResult } from "@/lib/admin/virtual-patient";
import { disorderNameText } from "@/lib/sessions/diagnosis-label";
import type { Avatar, VoiceProfile } from "@/lib/types";
import { tabKeyTarget } from "./tab-keys";

type TabId =
  | "overview"
  | "clinical"
  | "personality"
  | "behaviour"
  | "voice"
  | "therapy"
  | "preview"
  | "advanced";

/** Tab labels live under `admin.vpDetail.tabs.<id>`. */
const TABS: { id: TabId }[] = [
  { id: "overview" },
  { id: "clinical" },
  { id: "personality" },
  { id: "behaviour" },
  { id: "voice" },
  { id: "therapy" },
  { id: "preview" },
  { id: "advanced" },
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

/** Phase 4 P0-1 — admin-test session row for the transcript review entry point. */
export type AdminTestSessionRef = {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
};

export function VirtualPatientDetail({
  avatar,
  voiceProfile,
  personalityAvatars,
  testSessions = [],
  initialReadiness = null,
  readinessLabels = DEFAULT_READINESS_LABELS,
  locked = false,
  labels,
}: {
  avatar: Avatar;
  voiceProfile: VoiceProfile | null;
  personalityAvatars: PersonalityAvatar[];
  testSessions?: AdminTestSessionRef[];
  initialReadiness?: CaseReadinessResult | null;
  readinessLabels?: CaseReadinessLabels;
  /** Arrived here from the editor because this patient cannot be edited. */
  locked?: boolean;
  labels: {
    home: string;
    library: string;
    statusDraft: string;
    statusTesting: string;
    statusPublished: string;
    statusArchived: string;
    continueAuthoring: string;
    testSessionsHeading: string;
    testSessionsEmpty: string;
    testSessionsView: string;
    testSessionsNotice: string;
    statusActive: string;
    statusCompleted: string;
    statusExpired: string;
  };
}) {
  const tTabs = useTranslations("admin.avatars");
  const t = useTranslations("admin.vpDetail");
  const tDisorders = useTranslations("skillTests.disorders");
  const tDefaultDisorders = useTranslations("avatars.defaultDisorders");
  const tGenders = useTranslations("avatars.genders");
  const uiLocale = useLocale();
  // Display only — the stored disorder / gender / locale values are untouched.
  const disorderText =
    disorderNameText(avatar.disorder, tDisorders, tDefaultDisorders) ??
    avatar.disorder;
  const genderText =
    avatar.gender && tGenders.has(avatar.gender)
      ? tGenders(avatar.gender)
      : avatar.gender;
  const localeName = (code: string): string =>
    t.has(`localeNames.${code}`) ? t(`localeNames.${code}`) : code;
  const [tab, setTab] = useState<TabId>("overview");
  // Server-authoritative: page.tsx computes readiness; router.refresh() after
  // lifecycle actions reloads the prop. No client-side authz mirror.
  const readiness = initialReadiness;
  const locales = useMemo(() => listAvailableLocales(avatar), [avatar]);
  const lifecycleStatus = readLifecycleFromRow(avatar);

  const statusLabel = (status: VirtualPatientLifecycleStatus): string => {
    switch (status) {
      case "draft":
        return labels.statusDraft;
      case "testing":
        return labels.statusTesting;
      case "published":
        return labels.statusPublished;
      case "archived":
        return labels.statusArchived;
    }
  };

  const clinicalCore =
    avatar.clinical_core && typeof avatar.clinical_core === "object"
      ? (avatar.clinical_core as Record<string, unknown>)
      : null;

  const displayName = avatar.name?.trim() || t("untitledPatient");

  const reviewReadiness = () => {
    setTab("overview");
    if (typeof document !== "undefined") {
      document.getElementById("case-readiness-heading")?.focus?.();
      document
        .getElementById("case-readiness-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={displayName}
        subtitle={`${disorderText}${avatar.age != null ? ` · ${avatar.age}` : ""}${genderText ? ` · ${genderText}` : ""}`}
        breadcrumbs={[
          { label: labels.home, href: "/admin" },
          { label: labels.library, href: "/admin/avatars" },
          { label: displayName },
        ]}
        actions={
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                {t("lifecycle")}
              </span>
              <StatusBadge
                label={statusLabel(lifecycleStatus).toUpperCase()}
                tone={lifecycleBadgeTone(lifecycleStatus)}
              />
            </div>
            {(lifecycleStatus === "draft" ||
              lifecycleStatus === "testing") && (
              <Link
                href={`/admin/avatars/${avatar.id}/edit`}
                className="btn-primary"
              >
                {labels.continueAuthoring}
              </Link>
            )}
            <VirtualPatientLifecycleActions
              avatarId={avatar.id}
              slug={avatar.slug ?? null}
              lifecycleStatus={lifecycleStatus}
              readiness={readiness}
              readinessLabels={readinessLabels}
              onReviewReadiness={reviewReadiness}
            />
            <StartAdminTestConversationButton
              avatarId={avatar.id}
              lifecycleStatus={lifecycleStatus}
            />
          </div>
        }
      />

      <div
        role="tablist"
        aria-label={tTabs("detailTabsLabel")}
        className="mb-6 flex flex-wrap gap-2 border-b border-[var(--outline-variant)] pb-3"
      >
        {TABS.map((tabItem) => {
          const selected = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              role="tab"
              id={`vp-tab-${tabItem.id}`}
              aria-selected={selected}
              aria-controls={`vp-tabpanel-${tabItem.id}`}
              tabIndex={selected ? 0 : -1}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                selected
                  ? "bg-[var(--surface-container)] text-[var(--primary)]"
                  : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
              }`}
              onClick={() => setTab(tabItem.id)}
              onKeyDown={(e) => {
                const target = tabKeyTarget(
                  e.key,
                  TABS.findIndex((x) => x.id === tabItem.id),
                  TABS.length,
                  uiLocale.startsWith("ar"),
                );
                if (target === null) return;
                e.preventDefault();
                const next = TABS[target]!;
                setTab(next.id);
                queueMicrotask(() =>
                  document.getElementById(`vp-tab-${next.id}`)?.focus(),
                );
              }}
            >
              {t(`tabs.${tabItem.id}`)}
            </button>
          );
        })}
      </div>

      {locked ? (
        <p
          role="status"
          className="mb-6 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-3 text-sm text-[var(--on-surface)]"
        >
          {lifecycleStatus === "archived"
            ? t("lockedArchived")
            : t("lockedPublished")}
        </p>
      ) : null}

      {tab === "overview" ? (
        <section
          id="vp-tabpanel-overview"
          role="tabpanel"
          aria-labelledby="vp-tab-overview"
          className="grid gap-4 md:grid-cols-2"
        >
          <div id="case-readiness-panel" className="md:col-span-2">
            <CaseReadinessPanel
              readiness={readiness}
              labels={readinessLabels}
              onReview={reviewReadiness}
            />
          </div>
          <div className="clinical-card space-y-3 p-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {t("languagesVoice")}
            </h2>
            <p className="text-sm text-[var(--on-surface)]">
              {locales.map(localeName).join(t("listSeparator")) ||
                avatar.language ||
                "—"}
            </p>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {voiceProfile
                ? `${voiceProfile.voice_name} (${voiceProfile.language}${voiceProfile.dialect ? ` / ${voiceProfile.dialect}` : ""})`
                : t("noRegistryVoice")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/voices" className="btn-secondary">
                {t("manageVoices")}
              </Link>
              <Link href="/admin/personality" className="btn-secondary">
                {t("openPersonalityEditor")}
              </Link>
            </div>
          </div>

          {/* Phase 4 P0-1 — Admin Test Conversation transcript entry point. */}
          <div className="clinical-card space-y-3 p-5 md:col-span-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
              {labels.testSessionsHeading}
            </h2>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {labels.testSessionsNotice}
            </p>
            {testSessions.length === 0 ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                {labels.testSessionsEmpty}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--outline-variant)]">
                {testSessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium text-[var(--on-surface)]"
                        suppressHydrationWarning
                      >
                        {new Date(s.startedAt).toLocaleString(uiLocale)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[var(--on-surface-variant)]">
                        {s.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge
                        label={
                          s.status === "active"
                            ? labels.statusActive
                            : s.status === "completed"
                              ? labels.statusCompleted
                              : s.status === "expired"
                                ? labels.statusExpired
                                : s.status
                        }
                        tone={s.status === "active" ? "warning" : "neutral"}
                      />
                      <Link
                        href={`/admin/test-sessions/${s.id}`}
                        className="btn-secondary"
                      >
                        {labels.testSessionsView}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === "clinical" ? (
        <section
          id="vp-tabpanel-clinical"
          role="tabpanel"
          aria-labelledby="vp-tab-clinical"
          className="clinical-card space-y-4 p-5"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("tabs.clinical")}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("listedDiagnosis")}
              </dt>
              <dd className="mt-1 text-sm">{disorderText}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("defaultLocale")}
              </dt>
              <dd className="mt-1 text-sm">
                {avatar.default_locale ? localeName(avatar.default_locale) : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("sessionDiagnosisNote")}
          </p>
          <AdvancedJson
            value={clinicalCore ?? { note: t("noClinicalCore") }}
            title={t("advancedClinicalCore")}
          />
        </section>
      ) : null}

      {tab === "personality" ? (
        <section
          id="vp-tabpanel-personality"
          role="tabpanel"
          aria-labelledby="vp-tab-personality"
          className="clinical-card p-5"
        >
          <PersonalityEnginePanel initialAvatars={personalityAvatars} />
        </section>
      ) : null}

      {tab === "behaviour" ? (
        <section
          id="vp-tabpanel-behaviour"
          role="tabpanel"
          aria-labelledby="vp-tab-behaviour"
          className="clinical-card space-y-3 p-5"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("tabs.behaviour")}
          </h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("behaviourBody")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/cases" className="btn-secondary">
              {t("linkCases")}
            </Link>
            <Link href="/admin/templates" className="btn-secondary">
              {t("linkTemplates")}
            </Link>
            <Link href="/admin/presets" className="btn-secondary">
              {t("linkPresets")}
            </Link>
          </div>
        </section>
      ) : null}

      {tab === "voice" ? (
        <section
          id="vp-tabpanel-voice"
          role="tabpanel"
          aria-labelledby="vp-tab-voice"
          className="clinical-card space-y-4 p-5"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("tabs.voice")}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("assignedProfile")}
              </dt>
              <dd className="mt-1 text-sm">
                {voiceProfile?.voice_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("languageDialect")}
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
                label={t("previewEnglish")}
              />
            ) : null}
            {avatar.voice_id_ar || avatar.voice_profile_id ? (
              <VoicePreviewButton
                locale="ar"
                voiceIdAr={avatar.voice_id_ar}
                voiceProfileId={avatar.voice_profile_id}
                avatarId={avatar.id}
                label={t("previewArabic")}
              />
            ) : null}
            <Link href="/admin/voices" className="btn-secondary">
              {t("openVoiceLibrary")}
            </Link>
          </div>
          <AdvancedDetails title={t("advancedVoiceIds")}>
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
        <section
          id="vp-tabpanel-therapy"
          role="tabpanel"
          aria-labelledby="vp-tab-therapy"
          className="clinical-card space-y-3 p-5"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("tabs.therapy")}
          </h2>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("therapyBody")}
          </p>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            <li>
              <Link className="text-[var(--primary)] underline" href="/admin/presets">
                {t("instructorPresets")}
              </Link>
            </li>
            <li>
              <Link className="text-[var(--primary)] underline" href="/admin/cases">
                {t("casePreview")}
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      {tab === "preview" ? (
        <section
          id="vp-tabpanel-preview"
          role="tabpanel"
          aria-labelledby="vp-tab-preview"
          className="clinical-card space-y-4 p-5"
        >
          <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
            {t("patientPreview")}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("name")}
              </dt>
              <dd className="mt-1 text-sm">{displayName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("diagnosisCatalog")}
              </dt>
              <dd className="mt-1 text-sm">{disorderText}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("languages")}
              </dt>
              <dd className="mt-1 text-sm">
                {locales.map(localeName).join(t("listSeparator")) || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("tabs.voice")}
              </dt>
              <dd className="mt-1 text-sm">
                {voiceProfile?.voice_name ?? t("notAssigned")}
              </dd>
            </div>
          </dl>
          {avatar.ideal_guidelines?.session_goals?.length ? (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                {t("idealSessionGoals")}
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
        <section
          id="vp-tabpanel-advanced"
          role="tabpanel"
          aria-labelledby="vp-tab-advanced"
          className="space-y-3"
        >
          <AdvancedJson
            value={{
              id: avatar.id,
              slug: avatar.slug,
              schema_version: avatar.schema_version,
              lifecycle_status: avatar.lifecycle_status ?? lifecycleStatus,
              is_active: avatar.is_active,
              default_locale: avatar.default_locale,
              available_locales: avatar.available_locales,
              voice_profile_id: avatar.voice_profile_id,
              voice_id: avatar.voice_id,
              voice_id_ar: avatar.voice_id_ar,
            }}
            title={t("identifiersSchema")}
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
