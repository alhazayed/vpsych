import type {
  BpcRatingDimensions,
  BpcRatingSubmission,
  CvlArm,
  Likert5,
} from "@/lib/cvl/types";
import { likertTo100, mean } from "@/lib/cvl/statistics";
import { assertBlindSubmission } from "@/lib/cvl/blinding";

const DIM_WEIGHTS: Record<keyof BpcRatingDimensions, number> = {
  clinical_realism: 0.12,
  emotional_realism: 0.1,
  diagnostic_consistency: 0.1,
  speech_naturalness: 0.1,
  thought_process: 0.08,
  affect: 0.08,
  rapport: 0.08,
  therapeutic_alliance: 0.08,
  disclosure_timing: 0.08,
  resistance: 0.08,
  educational_usefulness: 0.1,
};

export function validateBpcSubmission(
  raw: unknown,
): { ok: true; submission: BpcRatingSubmission } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<BpcRatingSubmission> & {
    blinded?: boolean;
    arm_unknown_to_rater?: boolean;
  };
  const blind = assertBlindSubmission(body);
  if (!blind.ok) return blind;

  if (!body.study_id || !body.assignment_id || !body.reviewer_token) {
    return { ok: false, error: "study_id, assignment_id, reviewer_token required" };
  }
  if (!body.reviewer_type) {
    return { ok: false, error: "reviewer_type required" };
  }
  if (!body.ratings || typeof body.ratings !== "object") {
    return { ok: false, error: "ratings required" };
  }
  for (const key of Object.keys(DIM_WEIGHTS) as Array<keyof BpcRatingDimensions>) {
    const v = body.ratings[key];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
      return { ok: false, error: `ratings.${key} must be integer 1–5` };
    }
  }
  const conf = Number(body.confidence_pct ?? NaN);
  if (!Number.isFinite(conf) || conf < 0 || conf > 100) {
    return { ok: false, error: "confidence_pct must be 0–100" };
  }

  return {
    ok: true,
    submission: {
      study_id: body.study_id,
      assignment_id: body.assignment_id,
      reviewer_token: body.reviewer_token,
      reviewer_type: body.reviewer_type,
      modality: body.modality ?? "transcript",
      ratings: body.ratings as BpcRatingDimensions,
      would_teach_with_case:
        typeof body.would_teach_with_case === "boolean"
          ? body.would_teach_with_case
          : null,
      believed_arm: (body.believed_arm as BpcRatingSubmission["believed_arm"]) ?? null,
      confidence_pct: conf,
      free_comments: body.free_comments,
      teaching_opportunities: body.teaching_opportunities,
      quality_concerns: body.quality_concerns,
      rated_at: body.rated_at ?? new Date().toISOString(),
    },
  };
}

export function scoreBpcComposite(ratings: BpcRatingDimensions): number {
  let sum = 0;
  for (const [k, w] of Object.entries(DIM_WEIGHTS) as Array<
    [keyof BpcRatingDimensions, number]
  >) {
    sum += likertTo100(ratings[k] as Likert5) * w;
  }
  return Math.round(sum * 10) / 10;
}

export function discriminationByArm(input: {
  ratings: Array<{ arm: CvlArm; composite: number; believed_arm: string | null }>;
}): {
  n: number;
  hit_rate_vpsych_as_ai: number | null;
  mean_composite_by_arm: Record<string, number | null>;
  insufficient_data: boolean;
} {
  const byArm = new Map<string, number[]>();
  for (const r of input.ratings) {
    const list = byArm.get(r.arm) ?? [];
    list.push(r.composite);
    byArm.set(r.arm, list);
  }
  const mean_composite_by_arm: Record<string, number | null> = {};
  for (const [arm, xs] of byArm) mean_composite_by_arm[arm] = mean(xs);

  const vpsych = input.ratings.filter((r) => r.arm === "vpsych_avatar");
  const hits = vpsych.filter((r) => r.believed_arm === "vpsych_avatar");
  const insufficient = input.ratings.length < 6;

  return {
    n: input.ratings.length,
    hit_rate_vpsych_as_ai:
      vpsych.length >= 3 ? hits.length / vpsych.length : null,
    mean_composite_by_arm,
    insufficient_data: insufficient,
  };
}
