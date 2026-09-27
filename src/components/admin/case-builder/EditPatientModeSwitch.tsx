"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  GuidedCaseBuilder,
  type GuidedCaseIdentity,
} from "@/components/admin/case-builder/GuidedCaseBuilder";
import {
  VirtualPatientWizard,
  type WizardDisorderOption,
  type WizardVoiceOption,
} from "@/components/admin/VirtualPatientWizard";
import type {
  ArabicAuthorshipState,
  GuidedCaseDraft,
} from "@/lib/admin/case-builder";
import type { CaseReadinessResult } from "@/lib/admin/virtual-patient";

type Props = {
  voices: WizardVoiceOption[];
  disorders: WizardDisorderOption[];
  caseIdentity: GuidedCaseIdentity;
  initialDraft: GuidedCaseDraft;
  initialReadiness: CaseReadinessResult | null;
  arabicAuthorship: ArabicAuthorshipState;
  presentationUnresolved: boolean;
};

/**
 * Phase 10C-2 — Guided (default) vs Advanced for existing draft|testing cases.
 * Mode switches require confirmation when Guided has unsaved changes.
 */
export function EditPatientModeSwitch({
  voices,
  disorders,
  caseIdentity,
  initialDraft,
  initialReadiness,
  arabicAuthorship,
  presentationUnresolved,
}: Props) {
  const t = useTranslations("admin.caseBuilder");
  const [mode, setMode] = useState<"guided" | "advanced">("guided");

  function switchToAdvanced() {
    // GuidedCaseBuilder already confirms when dirty before calling this.
    setMode("advanced");
  }

  function switchToGuided() {
    // Advanced wizard manages its own dirty state; confirm leaving Advanced.
    const ok = window.confirm(t("switchToGuidedConfirm"));
    if (!ok) return;
    setMode("guided");
  }

  if (mode === "advanced") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--on-surface-variant)]">
            {t("advancedIntro")}
          </p>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={switchToGuided}
          >
            {t("guidedMode")}
          </button>
        </div>
        <VirtualPatientWizard
          voices={voices}
          disorders={disorders}
          avatarId={caseIdentity.id}
        />
      </div>
    );
  }

  return (
    <GuidedCaseBuilder
      mode="edit"
      voices={voices.map((v) => ({ id: v.id, voice_name: v.voice_name }))}
      caseIdentity={caseIdentity}
      initialDraft={initialDraft}
      initialReadiness={initialReadiness}
      arabicAuthorship={arabicAuthorship}
      presentationUnresolved={presentationUnresolved}
      onDirtyChange={onDirtyChange}
      onSwitchAdvanced={switchToAdvanced}
    />
  );
}
