import type { PmeUxCues, VocalizationKind } from "@/lib/conversation/types";

export type VocalizationResult = {
  kind: VocalizationKind;
  /** Prefixed text for TTS only — never sent to the LLM / patient agent. */
  ttsPrefix: string;
  /** Optional SSML-ish pause hint in ms before main content. */
  pauseBeforeMs: number;
};

const NONE: VocalizationResult = {
  kind: null,
  ttsPrefix: "",
  pauseBeforeMs: 0,
};

/**
 * Natural vocalization driven by PME UX cues / diagnosis — never random.
 * Prefixes are TTS-only and must not alter clinical message content.
 */
export function selectVocalization(
  cues: PmeUxCues,
  locale: "en" | "ar" = "en",
): VocalizationResult {
  if (!cues.permitsVocalization) return NONE;

  const severity = cues.severity ?? "moderate";
  const pace = cues.pace ?? "measured";
  const energy = cues.energy ?? "moderate";
  const hesitation = cues.hesitation ?? 0.35;
  const confidence = cues.confidence ?? 0.55;
  const emotion = (cues.emotion ?? "").toLowerCase();
  const category = (cues.disorderCategory ?? "").toLowerCase();
  const slug = (cues.diagnosisSlug ?? "").toLowerCase();

  // Psychosis / severe thought disorder: avoid theatrical fillers.
  if (category === "psychosis" || slug.includes("schizophren")) {
    if (hesitation > 0.55) {
      return {
        kind: "long_pause",
        ttsPrefix: "",
        pauseBeforeMs: 650,
      };
    }
    return NONE;
  }

  // Crying / grief — mood, trauma, severe only.
  if (
    (emotion.includes("grief") ||
      emotion.includes("tear") ||
      emotion.includes("cry")) &&
    (category === "mood" || category === "trauma") &&
    (severity === "moderate" || severity === "severe")
  ) {
    return {
      kind: "crying",
      ttsPrefix: locale === "ar" ? "…" : "…",
      pauseBeforeMs: 400,
    };
  }

  // Voice tremor — anxiety / trauma with low confidence.
  if (
    (category === "anxiety" || category === "trauma" || slug.includes("gad")) &&
    confidence < 0.45 &&
    energy !== "low"
  ) {
    return {
      kind: "voice_tremor",
      ttsPrefix: locale === "ar" ? "يعني…" : "I…",
      pauseBeforeMs: 280,
    };
  }

  // Nervous laugh — anxiety / mania-adjacent, not depression.
  if (
    (category === "anxiety" || pace === "pressured" || pace === "fast") &&
    energy === "high" &&
    !emotion.includes("sad") &&
    severity !== "severe"
  ) {
    return {
      kind: "nervous_laugh",
      ttsPrefix: locale === "ar" ? "ههه…" : "heh…",
      pauseBeforeMs: 120,
    };
  }

  // Long sigh — low energy mood.
  if (
    (category === "mood" || energy === "low" || pace === "slow") &&
    hesitation > 0.4
  ) {
    return {
      kind: "long_sigh",
      ttsPrefix: locale === "ar" ? "آه…" : "sigh…",
      pauseBeforeMs: 350,
    };
  }

  // Breathing — trauma / panic.
  if (
    category === "trauma" ||
    emotion.includes("panic") ||
    slug.includes("ptsd")
  ) {
    return {
      kind: "breathing",
      ttsPrefix: "",
      pauseBeforeMs: 500,
    };
  }

  // "I don't know…" — low confidence + hesitation.
  if (confidence < 0.4 && hesitation > 0.5) {
    return {
      kind: "i_dont_know",
      ttsPrefix: locale === "ar" ? "ما بعرف…" : "I don't know…",
      pauseBeforeMs: 200,
    };
  }

  // hmm — mild hesitation, most diagnoses.
  if (hesitation > 0.45 || confidence < 0.5) {
    return {
      kind: "hmm",
      ttsPrefix: locale === "ar" ? "همم…" : "hmm…",
      pauseBeforeMs: 180,
    };
  }

  if (pace === "slow" || energy === "low") {
    return {
      kind: "long_pause",
      ttsPrefix: "",
      pauseBeforeMs: 450,
    };
  }

  return NONE;
}

/** Compose TTS text without mutating the clinical transcript string. */
export function composeTtsText(
  clinicalContent: string,
  vocalization: VocalizationResult,
): string {
  const prefix = vocalization.ttsPrefix.trim();
  if (!prefix) return clinicalContent;
  return `${prefix} ${clinicalContent}`;
}
