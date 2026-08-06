import type { BtcRatingSubmission, Likert5 } from "@/lib/cvl/types";
import { assertBlindSubmission } from "@/lib/cvl/blinding";
import { likertTo100 } from "@/lib/cvl/statistics";

export function validateBtcSubmission(
  raw: unknown,
): { ok: true; submission: BtcRatingSubmission } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<BtcRatingSubmission> & {
    blinded?: boolean;
    arm_unknown_to_rater?: boolean;
  };
  const blind = assertBlindSubmission(body);
  if (!blind.ok) return blind;
  if (!body.study_id || !body.assignment_id || !body.reviewer_token) {
    return { ok: false, error: "study_id, assignment_id, reviewer_token required" };
  }
  if (!body.reviewer_type || !body.ratings) {
    return { ok: false, error: "reviewer_type and ratings required" };
  }
  const keys = [
    "alliance",
    "communication",
    "clinical_consistency",
    "educational_realism",
    "session_progression",
    "therapy_quality",
  ] as const;
  for (const k of keys) {
    const v = body.ratings[k];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) {
      return { ok: false, error: `ratings.${k} must be integer 1–5` };
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
      ratings: body.ratings as BtcRatingSubmission["ratings"],
      final_diagnosis_guess: body.final_diagnosis_guess,
      believed_is_ai:
        typeof body.believed_is_ai === "boolean" ? body.believed_is_ai : null,
      confidence_pct: conf,
      free_comments: body.free_comments,
      rated_at: body.rated_at ?? new Date().toISOString(),
    },
  };
}

export function scoreBtcComposite(
  ratings: BtcRatingSubmission["ratings"],
): number {
  const vals = Object.values(ratings) as Likert5[];
  const avg =
    vals.reduce((a, v) => a + likertTo100(v), 0) / Math.max(1, vals.length);
  return Math.round(avg * 10) / 10;
}
