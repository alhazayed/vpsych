import type { HcfEvaluationRow, HcfFacetScores } from "@/lib/cvl/types";
import { clamp01to100, mean } from "@/lib/cvl/statistics";

const FACETS: Array<keyof HcfFacetScores> = [
  "naturalness",
  "interruptions",
  "repair",
  "silence",
  "hesitation",
  "emotion",
  "deflection",
  "contradiction",
  "topic_switching",
  "language_fit",
  "speech_tempo",
  "thought_disorder",
  "affect",
];

export function validateHcfEvaluation(
  raw: unknown,
): { ok: true; row: HcfEvaluationRow } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<HcfEvaluationRow>;
  if (!body.study_id || !body.case_ref || !body.disorder_slug || !body.rater_token) {
    return {
      ok: false,
      error: "study_id, case_ref, disorder_slug, rater_token required",
    };
  }
  if (!body.facets || typeof body.facets !== "object") {
    return { ok: false, error: "facets required" };
  }
  for (const f of FACETS) {
    const v = body.facets[f];
    if (typeof v !== "number" || v < 0 || v > 100) {
      return { ok: false, error: `facets.${f} must be 0–100` };
    }
  }
  const overall =
    typeof body.overall === "number"
      ? clamp01to100(body.overall)
      : clamp01to100(mean(FACETS.map((f) => body.facets![f])) ?? 0);

  return {
    ok: true,
    row: {
      study_id: body.study_id,
      case_ref: body.case_ref,
      disorder_slug: body.disorder_slug,
      locale: body.locale ?? "en",
      facets: body.facets as HcfFacetScores,
      overall,
      rater_token: body.rater_token,
      rated_at: body.rated_at ?? new Date().toISOString(),
    },
  };
}

export function hcfFacetCatalog(): Array<{ id: keyof HcfFacetScores; label: string }> {
  return [
    { id: "naturalness", label: "Naturalness" },
    { id: "interruptions", label: "Interruptions" },
    { id: "repair", label: "Repair" },
    { id: "silence", label: "Silence" },
    { id: "hesitation", label: "Hesitation" },
    { id: "emotion", label: "Emotion" },
    { id: "deflection", label: "Deflection" },
    { id: "contradiction", label: "Contradiction" },
    { id: "topic_switching", label: "Topic switching" },
    { id: "language_fit", label: "Language (EN/AR fit)" },
    { id: "speech_tempo", label: "Speech tempo" },
    { id: "thought_disorder", label: "Thought disorder" },
    { id: "affect", label: "Affect" },
  ];
}
