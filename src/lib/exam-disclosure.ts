/**
 * Ground-truth disclosure helpers for exam / OSCE sessions.
 * When feedback is withheld (feedback_mode "none") or grading is exam/osce,
 * therapists must not see the case diagnosis, DSM/ICD codes, or diagnostic goals.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

export function shouldHideGroundTruth(
  snapshot: CaseInstanceSnapshot | null | undefined,
): boolean {
  const preset = snapshot?.instructor_preset;
  if (!preset) return false;
  const feedback = (preset.feedback_mode ?? "").toLowerCase();
  const grading = (preset.grading_mode ?? "").toLowerCase();
  const assessment = (preset.assessment_type ?? "").toLowerCase();
  if (feedback === "none") return true;
  if (grading === "osce" || grading === "exam") return true;
  if (assessment === "osce_examination") return true;
  return false;
}
