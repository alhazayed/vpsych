"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GuidedCaseBuilder } from "@/components/admin/case-builder/GuidedCaseBuilder";
import {
  VirtualPatientWizard,
  type WizardDisorderOption,
  type WizardVoiceOption,
} from "@/components/admin/VirtualPatientWizard";

type Props = {
  voices: WizardVoiceOption[];
  disorders: WizardDisorderOption[];
};

/**
 * Guided Mode (default) vs Advanced Mode (existing Virtual Patient wizard).
 * Switching modes with unsaved Guided or Advanced work requires confirmation.
 */
export function CreatePatientModeSwitch({ voices, disorders }: Props) {
  const t = useTranslations("admin.caseBuilder");
  const [mode, setMode] = useState<"guided" | "advanced">("guided");
  const [advancedDirty, setAdvancedDirty] = useState(false);

  function switchToAdvanced() {
    // GuidedCaseBuilder already confirms when dirty before calling this.
    setMode("advanced");
  }

  function switchToGuided() {
    if (advancedDirty) {
      const ok = window.confirm(t("unsavedAdvancedConfirm"));
      if (!ok) return;
    } else {
      const ok = window.confirm(t("switchToGuidedConfirm"));
      if (!ok) return;
    }
    setAdvancedDirty(false);
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
        {advancedDirty ? (
          <p className="text-xs text-[var(--on-surface-variant)]" role="status">
            {t("unsavedChanges")}
          </p>
        ) : null}
        <VirtualPatientWizard
          voices={voices}
          disorders={disorders}
          onDirtyChange={setAdvancedDirty}
        />
      </div>
    );
  }

  return (
    <GuidedCaseBuilder
      mode="create"
      voices={voices.map((v) => ({
        id: v.id,
        voice_name: v.voice_name,
        voice_id: v.voice_id,
        gender: v.gender,
      }))}
      onSwitchAdvanced={switchToAdvanced}
    />
  );
}
