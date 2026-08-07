/**
 * Certification Engine — conservative, explainable supervision bands.
 */

import { weightedTherapistOverall } from "@/lib/supervisor/therapist-evaluation";
import type {
  CertificationProgress,
  ExpertReviewReport,
  SupervisionBand,
} from "@/lib/supervisor/types";
import type { LearnerProfile } from "@/lib/ace/types";

const BAND_ORDER: SupervisionBand[] = [
  "beginner",
  "intermediate",
  "advanced",
  "consultant",
  "board",
];

export function evaluateSupervisorCertification(input: {
  review: ExpertReviewReport;
  profile?: LearnerProfile | null;
  feedbackBand: SupervisionBand;
}): CertificationProgress {
  const overall = weightedTherapistOverall(input.review.skill_scores);
  const risk =
    input.review.skill_scores.find((s) => s.id === "risk_assessment")?.score ??
    0;
  const ethics =
    input.review.skill_scores.find((s) => s.id === "ethics")?.score ?? 0;

  const milestones_met: string[] = [];
  const milestones_pending: string[] = [];

  if (overall >= 45) milestones_met.push("Foundational interviewing");
  else milestones_pending.push("Foundational interviewing (overall ≥ 45)");

  if (risk >= 60) milestones_met.push("Basic risk inquiry");
  else milestones_pending.push("Basic risk inquiry (risk ≥ 60)");

  if (overall >= 65 && risk >= 70)
    milestones_met.push("Competent safety + process");
  else milestones_pending.push("Competent safety + process");

  if (overall >= 78 && ethics >= 70)
    milestones_met.push("Advanced professional practice");
  else milestones_pending.push("Advanced professional practice");

  if (overall >= 88 && risk >= 80 && ethics >= 80)
    milestones_met.push("Board-level expectations");
  else milestones_pending.push("Board-level expectations");

  const cases = input.profile?.completed_case_count ?? 0;
  if (cases >= 10) milestones_met.push("10 supervised cases");
  else milestones_pending.push(`10 supervised cases (have ${cases})`);

  const board_ready =
    overall >= 88 && risk >= 80 && ethics >= 80 && cases >= 25;

  const progress_pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (milestones_met.length /
          Math.max(1, milestones_met.length + milestones_pending.length)) *
          100,
      ),
    ),
  );

  return {
    current_band: input.feedbackBand,
    progress_pct,
    milestones_met,
    milestones_pending,
    board_ready,
    rationale: [
      `Therapist skill overall ${overall}/100.`,
      `Risk ${risk}/100; ethics ${ethics}/100.`,
      `Primary supervision band: ${input.feedbackBand}.`,
      board_ready
        ? "Board-ready criteria met on educational thresholds (not a clinical license)."
        : "Board-ready criteria not yet met — continue deliberate practice.",
      `Band ladder: ${BAND_ORDER.join(" → ")}.`,
    ],
  };
}
