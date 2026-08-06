import type { CvlArm, CvlAssignment } from "@/lib/cvl/types";

/** Public view of an assignment — arm never included. */
export type BlindedAssignmentView = {
  assignment_id: string;
  study_id: string;
  reviewer_token: string;
  reviewer_type: string;
  case_ref: string;
  disorder_slug: string | null;
  modality: string;
  blinded: true;
  arm_unknown_to_rater: true;
  instructions: string;
};

export function toBlindedAssignmentView(
  a: CvlAssignment,
): BlindedAssignmentView {
  return {
    assignment_id: a.id,
    study_id: a.study_id,
    reviewer_token: a.reviewer_token,
    reviewer_type: a.reviewer_type,
    case_ref: a.case_ref,
    disorder_slug: a.disorder_slug,
    modality: a.modality,
    blinded: true,
    arm_unknown_to_rater: true,
    instructions:
      "You are reviewing a clinical teaching case. Do not attempt to identify whether the patient is real, an actor, or a simulator. Rate only what you observe.",
  };
}

/** Unblind only after study status allows analysis — admin-only. */
export function revealArm(
  a: CvlAssignment,
  studyStatus: string,
): { arm: CvlArm } | { error: string } {
  if (!["analysis", "completed", "archived"].includes(studyStatus)) {
    return {
      error: "Arm reveal forbidden until study reaches analysis/completed status",
    };
  }
  return { arm: a.arm };
}

export function assertBlindSubmission(flags: {
  blinded?: boolean;
  arm_unknown_to_rater?: boolean;
  believed_arm?: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (flags.blinded !== true || flags.arm_unknown_to_rater !== true) {
    return {
      ok: false,
      error: "Blinded submissions must set blinded=true and arm_unknown_to_rater=true",
    };
  }
  return { ok: true };
}
