/**
 * Map clinical speech / affect to ElevenLabs voice_settings (Mission 20 E).
 */

import type { SpeechProfile } from "@/lib/conversation-fidelity/speech-profiles";

export type ClinicalVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  /** Documented intent for HCFI / headers — not always sent upstream. */
  clinical_intent: string;
};

const DEFAULT: ClinicalVoiceSettings = {
  stability: 0.4,
  similarity_boost: 0.75,
  style: 0.35,
  use_speaker_boost: true,
  clinical_intent: "neutral_interview",
};

export function resolveClinicalVoiceSettings(opts: {
  speechProfile?: SpeechProfile | null;
  pace?: string | null;
  allianceBand?: "low" | "moderate" | "high" | null;
}): ClinicalVoiceSettings {
  const hint = opts.speechProfile?.voice_hint ?? "neutral";
  const pace = opts.pace ?? opts.speechProfile?.pace ?? "measured";
  let s: ClinicalVoiceSettings = { ...DEFAULT };

  switch (hint) {
    case "depressed":
      s = {
        stability: 0.62,
        similarity_boost: 0.7,
        style: 0.15,
        use_speaker_boost: false,
        clinical_intent: "low_energy_slow_depressed",
      };
      break;
    case "anxious":
      s = {
        stability: 0.32,
        similarity_boost: 0.78,
        style: 0.45,
        use_speaker_boost: true,
        clinical_intent: "tense_anxious",
      };
      break;
    case "manic":
      s = {
        stability: 0.22,
        similarity_boost: 0.8,
        style: 0.65,
        use_speaker_boost: true,
        clinical_intent: "pressured_manic",
      };
      break;
    case "psychotic":
      s = {
        stability: 0.55,
        similarity_boost: 0.68,
        style: 0.25,
        use_speaker_boost: false,
        clinical_intent: "flat_guarded_psychotic",
      };
      break;
    case "trauma":
      s = {
        stability: 0.48,
        similarity_boost: 0.72,
        style: 0.3,
        use_speaker_boost: true,
        clinical_intent: "guarded_trauma",
      };
      break;
    case "ocd":
      s = {
        stability: 0.38,
        similarity_boost: 0.76,
        style: 0.4,
        use_speaker_boost: true,
        clinical_intent: "uncertain_reassurance_seeking",
      };
      break;
    case "personality":
      s = {
        stability: 0.35,
        similarity_boost: 0.74,
        style: 0.5,
        use_speaker_boost: true,
        clinical_intent: "labile_relational",
      };
      break;
    default:
      s = { ...DEFAULT };
  }

  if (pace === "slow" || pace === "pressured") {
    // Slow → more stable; pressured → less stable / more style
    if (pace === "slow") {
      s = {
        ...s,
        stability: Math.min(0.85, s.stability + 0.08),
        style: Math.max(0.05, s.style - 0.08),
      };
    } else {
      s = {
        ...s,
        stability: Math.max(0.15, s.stability - 0.08),
        style: Math.min(0.85, s.style + 0.1),
      };
    }
  }

  if (opts.allianceBand === "low") {
    s = {
      ...s,
      stability: Math.min(0.8, s.stability + 0.05),
      style: Math.max(0.05, s.style - 0.05),
      clinical_intent: `${s.clinical_intent}+low_alliance_guarded`,
    };
  } else if (opts.allianceBand === "high") {
    s = {
      ...s,
      style: Math.min(0.8, s.style + 0.05),
      clinical_intent: `${s.clinical_intent}+higher_alliance_open`,
    };
  }

  return {
    stability: round2(s.stability),
    similarity_boost: round2(s.similarity_boost),
    style: round2(s.style),
    use_speaker_boost: s.use_speaker_boost,
    clinical_intent: s.clinical_intent,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
