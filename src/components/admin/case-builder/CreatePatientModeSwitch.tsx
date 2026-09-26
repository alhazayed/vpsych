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
 */
export function CreatePatientModeSwitch({ voices, disorders }: Props) {
  const t = useTranslations("admin.caseBuilder");
  const [mode, setMode] = useState<"guided" | "advanced">("guided");

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
            onClick={() => setMode("guided")}
          >
            {t("guidedMode")}
          </button>
        </div>
        <VirtualPatientWizard voices={voices} disorders={disorders} />
      </div>
    );
  }

  return (
    <GuidedCaseBuilder
      voices={voices.map((v) => ({ id: v.id, voice_name: v.voice_name }))}
      onSwitchAdvanced={() => setMode("advanced")}
    />
  );
}
