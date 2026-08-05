/**
 * Adapter: session transcript + case context → HCFI compute input.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { HcfiComputeInput, HcfiMessage } from "@/lib/hcfi/types";
import { PROMPT_ENGINE_VERSION } from "@/lib/scientific/versions";
import type { AllianceBand } from "@/lib/conversation-fidelity/alliance";

export function hcfiInputFromSession(opts: {
  messages: HcfiMessage[];
  clinicalSnapshot?: CaseInstanceSnapshot | null;
  locale?: string | null;
  language?: string | null;
  modelVersion?: string | null;
  personaVersion?: string | null;
  personaFallback?: boolean;
  hasSpeechProfile?: boolean;
  hasAllianceReactivity?: boolean;
  hasVoiceSettings?: boolean;
  allianceBand?: AllianceBand | "unknown";
}): HcfiComputeInput {
  const snap = opts.clinicalSnapshot ?? null;
  const locale =
    opts.locale ??
    snap?.locale ??
    (opts.language === "ar" ? "ar-JO" : "en-US");

  return {
    disorder_slug: snap?.primary_diagnosis?.slug ?? "unknown",
    disorder_category: snap?.primary_diagnosis?.category ?? null,
    locale,
    messages: opts.messages,
    has_speech_profile: opts.hasSpeechProfile ?? true,
    has_alliance_reactivity: opts.hasAllianceReactivity ?? true,
    has_cultural_cues: Boolean(
      snap?.clinical_core || locale.toLowerCase().startsWith("ar"),
    ),
    has_voice_settings: opts.hasVoiceSettings ?? true,
    prompt_version: PROMPT_ENGINE_VERSION,
    model_version: opts.modelVersion ?? null,
    persona_version: opts.personaVersion ?? null,
    persona_fallback: opts.personaFallback ?? false,
    alliance_band: opts.allianceBand ?? "unknown",
  };
}
