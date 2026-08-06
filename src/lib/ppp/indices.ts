import {
  PPP_INDICES_VERSION,
  type Likert1to5,
  type PppSessionRating,
  type ReviewerAnalyticsIndices,
} from "./types";

/** Convert a 1–5 Likert mean to a 0–100 index. */
export function likertMeanToIndex(mean: number | null): number | null {
  if (mean === null || !Number.isFinite(mean)) return null;
  const clamped = Math.min(5, Math.max(1, mean));
  return Math.round(((clamped - 1) / 4) * 1000) / 10;
}

export function meanLikert(
  values: Array<number | null | undefined>,
): number | null {
  const nums = values.filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 5,
  );
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pick(
  ratings: Pick<
    PppSessionRating,
    | "clinical_realism"
    | "educational_value"
    | "conversation_naturalness"
    | "therapeutic_alliance"
    | "patient_believability"
    | "learning_impact"
    | "voice_realism"
    | "arabic_quality"
    | "english_quality"
  >[],
  key: keyof (typeof ratings)[number],
): Array<Likert1to5 | null> {
  return ratings.map((r) => r[key] as Likert1to5 | null);
}

/**
 * Compute Reviewer Analytics indices from expert session ratings.
 * Clinical Authenticity = mean(clinical_realism, patient_believability).
 * All other indices map 1:1 from their Likert field.
 * Returns null per index when no ratings contribute.
 */
export function computeReviewerAnalytics(
  ratings: Array<
    Pick<
      PppSessionRating,
      | "clinical_realism"
      | "educational_value"
      | "conversation_naturalness"
      | "therapeutic_alliance"
      | "patient_believability"
      | "learning_impact"
      | "voice_realism"
      | "arabic_quality"
      | "english_quality"
    >
  >,
): ReviewerAnalyticsIndices {
  const clinicalMeans = ratings.flatMap((r) => [
    r.clinical_realism,
    r.patient_believability,
  ]);

  const voice = pick(ratings, "voice_realism").filter(
    (v): v is Likert1to5 => v != null,
  );
  const arabic = pick(ratings, "arabic_quality").filter(
    (v): v is Likert1to5 => v != null,
  );
  const english = pick(ratings, "english_quality").filter(
    (v): v is Likert1to5 => v != null,
  );

  return {
    clinical_authenticity_index: likertMeanToIndex(meanLikert(clinicalMeans)),
    educational_value_index: likertMeanToIndex(
      meanLikert(pick(ratings, "educational_value")),
    ),
    conversation_naturalness_index: likertMeanToIndex(
      meanLikert(pick(ratings, "conversation_naturalness")),
    ),
    therapeutic_alliance_score: likertMeanToIndex(
      meanLikert(pick(ratings, "therapeutic_alliance")),
    ),
    patient_believability_score: likertMeanToIndex(
      meanLikert(pick(ratings, "patient_believability")),
    ),
    learning_impact_score: likertMeanToIndex(
      meanLikert(pick(ratings, "learning_impact")),
    ),
    voice_realism_score: likertMeanToIndex(meanLikert(voice)),
    arabic_quality_score: likertMeanToIndex(meanLikert(arabic)),
    english_quality_score: likertMeanToIndex(meanLikert(english)),
    sample_size: ratings.length,
    voice_sample_size: voice.length,
    arabic_sample_size: arabic.length,
    english_sample_size: english.length,
    indices_version: PPP_INDICES_VERSION,
  };
}
