/**
 * Voice Personality — patient-specific delivery profile for presentation.
 * Reads authored/resolved avatar + CVP hints; never invents diagnosis.
 */

import type {
  RealtimeSpeechLocale,
  VoicePersonalityProfile,
} from "@/lib/realtime/types";

export type VoicePersonalityInput = {
  locale?: string | null;
  age?: number | null;
  gender?: string | null;
  accentHint?: string | null;
  educationHint?: string | null;
  cultureHint?: string | null;
  disorderSlug?: string | null;
  emotion?: string | null;
  speechPace?: string | null;
  speechEnergy?: string | null;
  stability?: number | null;
  style?: number | null;
};

export function buildVoicePersonality(
  input: VoicePersonalityInput,
): VoicePersonalityProfile {
  const locale = normalizeLocale(input.locale);
  const ageBand = ageToBand(input.age);
  const genderPresentation = mapGender(input.gender);
  const pace = mapPace(input.speechPace);
  const energy = mapEnergy(input.speechEnergy);
  const confidence = confidenceFromEmotion(input.emotion, energy);
  const vocabularyRegister = registerFromEducation(input.educationHint);

  return {
    ageBand,
    genderPresentation,
    accentHint: input.accentHint ?? (locale === "ar" ? "levantine" : null),
    educationHint: input.educationHint ?? null,
    cultureHint:
      input.cultureHint ?? (locale === "ar" ? "jordanian_levantine" : "generic"),
    prosody: {
      stability: clamp01(input.stability ?? 0.45),
      style: clamp01(input.style ?? 0.35),
      speechPace: pace,
      speechEnergy: energy,
    },
    speechTempo: pace === "slow" ? 0.85 : pace === "fast" ? 1.15 : 1,
    vocabularyRegister,
    confidence,
    emotionalTone: (input.emotion ?? "neutral").toLowerCase(),
    locale,
  };
}

function normalizeLocale(locale?: string | null): RealtimeSpeechLocale {
  const v = (locale ?? "en").toLowerCase();
  if (v === "mixed") return "mixed";
  if (v.startsWith("ar")) return "ar";
  return "en";
}

function ageToBand(
  age?: number | null,
): VoicePersonalityProfile["ageBand"] {
  if (age == null || !Number.isFinite(age)) return "unknown";
  if (age < 30) return "young_adult";
  if (age < 45) return "adult";
  if (age < 65) return "middle_age";
  return "older_adult";
}

function mapGender(
  gender?: string | null,
): VoicePersonalityProfile["genderPresentation"] {
  const g = (gender ?? "").toLowerCase();
  if (/female|woman|feminine|f\b/.test(g)) return "feminine";
  if (/male|man|masculine|\bm\b/.test(g)) return "masculine";
  if (!g) return "unknown";
  return "neutral";
}

function mapPace(pace?: string | null): "slow" | "normal" | "fast" {
  const p = (pace ?? "normal").toLowerCase();
  if (p === "slow") return "slow";
  if (p === "fast") return "fast";
  return "normal";
}

function mapEnergy(energy?: string | null): "low" | "medium" | "high" {
  const e = (energy ?? "medium").toLowerCase();
  if (e === "low") return "low";
  if (e === "high") return "high";
  return "medium";
}

function confidenceFromEmotion(
  emotion?: string | null,
  energy: "low" | "medium" | "high" = "medium",
): number {
  const e = (emotion ?? "").toLowerCase();
  if (/anxious|fear|depressed|sad|avoid/.test(e)) return 0.35;
  if (/manic|irrit/.test(e)) return 0.8;
  if (energy === "low") return 0.45;
  if (energy === "high") return 0.75;
  return 0.6;
}

function registerFromEducation(
  education?: string | null,
): VoicePersonalityProfile["vocabularyRegister"] {
  const e = (education ?? "").toLowerCase();
  if (/phd|graduate|university|college|bachelor|master/.test(e)) {
    return "abstract";
  }
  if (/primary|basic|elementary/.test(e)) return "concrete";
  return "mixed";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
