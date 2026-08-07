/**
 * Feedback Generator — beginner → board banded supervision.
 */

import { weightedTherapistOverall } from "@/lib/supervisor/therapist-evaluation";
import type {
  BandedFeedback,
  ExpertReviewReport,
  SupervisionBand,
  SupervisionFeedbackPack,
} from "@/lib/supervisor/types";
import { SUPERVISOR_FRAMEWORK_VERSION } from "@/lib/supervisor/types";
import type { LearnerProfile } from "@/lib/ace/types";

function bandFromProfile(
  profile: LearnerProfile | null | undefined,
  overall: number,
): SupervisionBand {
  const level = profile?.training_level;
  if (level === "fellowship" || level === "certification_track") {
    return overall >= 88 ? "board" : "consultant";
  }
  if (level === "residency" && overall >= 80) return "advanced";
  if (level === "residency") return "intermediate";
  if (overall >= 90) return "board";
  if (overall >= 75) return "advanced";
  if (overall >= 55) return "intermediate";
  return "beginner";
}

function makeBand(
  band: SupervisionBand,
  review: ExpertReviewReport,
  expectations: string[],
): BandedFeedback {
  const top = [...review.skill_scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const weak = [...review.skill_scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return {
    band,
    summary: `${band.replace(/_/g, " ")} supervision: ${review.overall_impression}`,
    strengths: top.map(
      (s) =>
        `${s.id.replace(/_/g, " ")} (${s.score}) — ${s.evidence[0]?.excerpt?.slice(0, 80) ?? "evidenced"}`,
    ),
    growth_areas: weak.map(
      (s) =>
        `${s.id.replace(/_/g, " ")} (${s.score}): ${s.notes[0] ?? review.session_review.missed_opportunities[0] ?? "practice needed"}`,
    ),
    expectations,
    next_actions: review.session_review.alternative_interventions.slice(0, 3),
  };
}

export function generateSupervisionFeedback(
  review: ExpertReviewReport,
  profile?: LearnerProfile | null,
): SupervisionFeedbackPack {
  const overall = weightedTherapistOverall(review.skill_scores);
  const primaryBand = bandFromProfile(profile, overall);

  const beginner = makeBand("beginner", review, [
    "Use open questions and reflections before advice.",
    "Always ask about safety when distress is present.",
    "Close with a brief summary.",
  ]);
  const intermediate = makeBand("intermediate", review, [
    "Link symptoms to differentials using case evidence only.",
    "Balance validation with collaborative agenda setting.",
    "Document next steps and risk status educationally.",
  ]);
  const advanced = makeBand("advanced", review, [
    "Integrate formulation with modality-congruent interventions.",
    "Repair alliance ruptures explicitly.",
    "Prioritize acuity and ethics under ambiguity.",
  ]);
  const consultant = makeBand("consultant", review, [
    "Model flexible modality recognition without forcing labels.",
    "Supervise risk and differential reasoning aloud.",
    "Coach juniors on evidence-linked feedback.",
  ]);
  const board = makeBand("board", review, [
    "Board-level: demonstrate consistent safety, ethics, and formulation across cases.",
    "No invented diagnoses; cite transcript and case teaching only.",
    "Sustain reflective practice and bias checks every session.",
  ]);

  const packs = { beginner, intermediate, advanced, consultant, board };

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    ...packs,
    primary: packs[primaryBand],
  };
}
