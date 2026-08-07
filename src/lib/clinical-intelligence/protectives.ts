/**
 * Protective factors + MSE promotion (Case Engine ownership).
 */

import type {
  InsightBand,
  MentalStatusExam,
  ProtectiveFactor,
} from "@/lib/clinical-intelligence/types";
import { MSE_VERSION } from "@/lib/clinical-intelligence/types";
import { findFormulationSeed } from "@/lib/clinical-intelligence/package-seeds";
import { isInsightBand } from "@/lib/clinical-intelligence/validation";

/** Map difficulty insight strings onto InsightBand. */
export function insightBandFromDifficulty(insight: string | null | undefined): InsightBand {
  const key = (insight ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "high" || key === "good") return "good";
  if (key === "moderate") return "partial";
  if (key === "partial") return "partial";
  if (key === "low" || key === "poor") return "poor";
  if (key === "very_low" || key === "absent") return "absent";
  if (key === "intellectual_only" || key === "intellectual") return "intellectual_only";
  if (isInsightBand(key)) return key;
  return "partial";
}

export function promoteProtectiveFactors(input: {
  disorderSlug?: string | null;
  authored?: ProtectiveFactor[] | null;
  personaProtectives?: string[] | null;
}): ProtectiveFactor[] {
  if (input.authored && input.authored.length > 0) {
    return input.authored.map((p) => ({ ...p }));
  }
  const seed = findFormulationSeed(input.disorderSlug);
  const fromSeed = seed.protective_factors.map((p) => ({ ...p }));
  if (input.personaProtectives?.length) {
    for (const label of input.personaProtectives) {
      const id = `pf-persona-${label.toLowerCase().replace(/\W+/g, "-").slice(0, 40)}`;
      if (!fromSeed.some((p) => p.label === label)) {
        fromSeed.push({
          id,
          label,
          category: "other",
          strength: 50,
        });
      }
    }
  }
  return fromSeed;
}

export function promoteMentalStatusExam(input: {
  disorderSlug?: string | null;
  difficultyInsight?: string | null;
  authored?: Partial<MentalStatusExam> | null;
}): MentalStatusExam {
  const seed = findFormulationSeed(input.disorderSlug);
  const insight =
    (input.authored?.insight && isInsightBand(input.authored.insight)
      ? input.authored.insight
      : null) ??
    seed.insight_band ??
    insightBandFromDifficulty(input.difficultyInsight);

  return {
    version: MSE_VERSION,
    appearance: input.authored?.appearance ?? seed.mse_defaults.appearance,
    behavior: input.authored?.behavior ?? seed.mse_defaults.behavior,
    speech: input.authored?.speech ?? seed.mse_defaults.speech,
    mood: input.authored?.mood ?? seed.mse_defaults.mood,
    affect: input.authored?.affect ?? seed.mse_defaults.affect,
    thought_process:
      input.authored?.thought_process ?? seed.mse_defaults.thought_process,
    thought_content:
      input.authored?.thought_content ?? seed.mse_defaults.thought_content,
    perception: input.authored?.perception ?? seed.mse_defaults.perception,
    insight,
    judgement: input.authored?.judgement ?? seed.mse_defaults.judgement,
    cognition: input.authored?.cognition ?? seed.mse_defaults.cognition,
    risk_summary: input.authored?.risk_summary ?? seed.mse_defaults.risk_summary,
  };
}

/** Protective factor strength → Emotion baseline hope/trust prior offsets. */
export function protectiveEmotionPriors(factors: ProtectiveFactor[]): {
  hope_offset: number;
  trust_offset: number;
  motivation_offset: number;
} {
  if (!factors.length) {
    return { hope_offset: 0, trust_offset: 0, motivation_offset: 0 };
  }
  const avg =
    factors.reduce((a, f) => a + (f.strength ?? 50), 0) / factors.length;
  // Map avg 0–100 → modest offsets (−8 … +12)
  const centered = (avg - 50) / 50;
  return {
    hope_offset: Math.round(centered * 12),
    trust_offset: Math.round(centered * 8),
    motivation_offset: Math.round(centered * 6),
  };
}
