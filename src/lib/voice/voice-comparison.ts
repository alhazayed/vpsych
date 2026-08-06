/**
 * Offline-scorable voice comparison rubric for standardized-patient casting.
 * Used by scripts/compare-elevenlabs-voices.mjs and unit tests.
 *
 * Scores are 0–10 per dimension. Higher = better fit for psychiatrist training.
 */

export type VoiceComparisonDimensions = {
  naturalness: number;
  clinicalRealism: number;
  warmth: number;
  emotionalExpression: number;
  arabicPronunciation: number;
  englishPronunciation: number;
  conversationFlow: number;
  /** Inverse of latency — higher score = faster first-byte (still 0–10). */
  latency: number;
};

export type VoiceCandidate = {
  id: string;
  label: string;
  locale: "en" | "ar" | "both";
  /** Premade / library notes for human review. */
  notes?: string;
};

/** Curated candidates known to work on typical ElevenLabs API plans. */
export const PATIENT_VOICE_CANDIDATES: VoiceCandidate[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Sarah",
    locale: "en",
    notes: "Warm adult female; strong default for EN SP interviews",
  },
  {
    id: "FGY2WhTYpPnrIDTdsKH5",
    label: "Laura",
    locale: "en",
    notes: "Softer, slightly anxious edge — good for GAD/MDD",
  },
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    label: "Matilda",
    locale: "en",
    notes: "Narrative warmth; careful not to sound too polished",
  },
  {
    id: "pFZP5JQG7iQjIQuC4Bku",
    label: "Lily",
    locale: "en",
    notes: "Younger adult; lighter affect",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    label: "Adam",
    locale: "both",
    notes: "Multilingual male; Arabic-capable fallback",
  },
  {
    id: "N2lVS1w4EtoT3dr4eOWO",
    label: "Callum",
    locale: "en",
    notes: "Deeper male; guarded/trauma-adjacent affect",
  },
  {
    id: "XB0fDUnXU5powFXDhCwa",
    label: "Charlotte",
    locale: "both",
    notes: "Multilingual female; often strong AR+EN",
  },
  {
    id: "iP95p4xoKVk53GoZ742B",
    label: "Chris",
    locale: "en",
    notes: "Conversational male",
  },
];

export const COMPARISON_SCRIPT_EN =
  "I… I don't sleep much anymore. My mind just keeps going — what if I mess up at work, what if something happens to my kids. Sorry. I know that sounds dramatic. I'm just tired of feeling like this.";

export const COMPARISON_SCRIPT_AR =
  "يعني… ما بنام كثير. فكري طول الوقت شغال — شو بصير إذا أخطأت بالشغل، شو بصير مع الأولاد. بعتذر. بعرف إنه شكله مبالغ فيه. بس تعبت من هالشعور.";

/** Weighted composite used to pick the winning voice. */
export function scoreVoiceComposite(d: VoiceComparisonDimensions): number {
  const weights: Record<keyof VoiceComparisonDimensions, number> = {
    naturalness: 0.2,
    clinicalRealism: 0.2,
    warmth: 0.1,
    emotionalExpression: 0.15,
    arabicPronunciation: 0.1,
    englishPronunciation: 0.1,
    conversationFlow: 0.1,
    latency: 0.05,
  };
  let total = 0;
  for (const key of Object.keys(weights) as (keyof VoiceComparisonDimensions)[]) {
    const v = Math.max(0, Math.min(10, d[key]));
    total += v * weights[key];
  }
  return Math.round(total * 100) / 100;
}

/** Map measured TTS latency (ms) onto 0–10 (≤400ms → 10, ≥2500ms → 1). */
export function latencyScoreFromMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 5;
  if (ms <= 400) return 10;
  if (ms >= 2500) return 1;
  return Math.round((10 - ((ms - 400) / 2100) * 9) * 10) / 10;
}

/**
 * Heuristic pre-score when human listening is unavailable.
 * Prefer warmer conversational casting; demote overly "assistant" voices.
 */
export function heuristicVoiceDimensions(
  candidate: VoiceCandidate,
): VoiceComparisonDimensions {
  const base: VoiceComparisonDimensions = {
    naturalness: 7,
    clinicalRealism: 7,
    warmth: 6.5,
    emotionalExpression: 6.5,
    arabicPronunciation: candidate.locale === "en" ? 4 : 7,
    englishPronunciation: candidate.locale === "ar" ? 5 : 7.5,
    conversationFlow: 7,
    latency: 7,
  };

  switch (candidate.label) {
    case "Sarah":
      return {
        ...base,
        naturalness: 8.5,
        clinicalRealism: 8.2,
        warmth: 8.4,
        emotionalExpression: 8,
        englishPronunciation: 8.5,
        conversationFlow: 8.3,
      };
    case "Laura":
      return {
        ...base,
        naturalness: 8.2,
        clinicalRealism: 8.4,
        warmth: 7.6,
        emotionalExpression: 8.5,
        englishPronunciation: 8.2,
        conversationFlow: 8,
      };
    case "Charlotte":
      return {
        ...base,
        naturalness: 8,
        clinicalRealism: 7.8,
        warmth: 8,
        emotionalExpression: 7.8,
        arabicPronunciation: 8.2,
        englishPronunciation: 8,
        conversationFlow: 8,
      };
    case "Adam":
      return {
        ...base,
        naturalness: 7.2,
        clinicalRealism: 7,
        warmth: 6.2,
        emotionalExpression: 6.5,
        arabicPronunciation: 7.5,
        englishPronunciation: 7.5,
        conversationFlow: 7,
      };
    case "Matilda":
      return {
        ...base,
        naturalness: 7.8,
        clinicalRealism: 7.2,
        warmth: 8.2,
        emotionalExpression: 7.5,
        conversationFlow: 7.4,
      };
    default:
      return base;
  }
}

export function rankVoiceCandidates(
  candidates: VoiceCandidate[] = PATIENT_VOICE_CANDIDATES,
): Array<{
  candidate: VoiceCandidate;
  dimensions: VoiceComparisonDimensions;
  composite: number;
}> {
  return candidates
    .map((candidate) => {
      const dimensions = heuristicVoiceDimensions(candidate);
      return {
        candidate,
        dimensions,
        composite: scoreVoiceComposite(dimensions),
      };
    })
    .sort((a, b) => b.composite - a.composite);
}

/** Recommended production defaults from the ranking. */
export function recommendedPatientVoices(): {
  en: VoiceCandidate;
  ar: VoiceCandidate;
  ranking: ReturnType<typeof rankVoiceCandidates>;
} {
  const ranking = rankVoiceCandidates();
  // Prefer locale-specialized casting; only fall back to bilingual voices.
  const en =
    ranking.find((r) => r.candidate.locale === "en")?.candidate ??
    ranking.find((r) => r.candidate.locale === "both")?.candidate ??
    PATIENT_VOICE_CANDIDATES[0]!;
  const ar =
    ranking.find((r) => r.candidate.locale === "ar")?.candidate ??
    ranking.find((r) => r.candidate.locale === "both")?.candidate ??
    PATIENT_VOICE_CANDIDATES.find((c) => c.label === "Charlotte") ??
    PATIENT_VOICE_CANDIDATES[4]!;
  return { en, ar, ranking };
}
