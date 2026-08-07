/**
 * Learning Recommendation Engine — evidence-linked practice suggestions.
 */

import type {
  ExpertReviewReport,
  LearningRecommendation,
} from "@/lib/supervisor/types";

export function generateLearningRecommendations(
  review: ExpertReviewReport,
): LearningRecommendation[] {
  const weak = [...review.skill_scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  const recs: LearningRecommendation[] = weak.map((s, i) => ({
    id: `rec-${s.id}-${i}`,
    priority: (s.score < 40 ? "high" : s.score < 60 ? "medium" : "low") as
      | "high"
      | "medium"
      | "low",
    skill_id: s.id,
    title: `Practice ${s.id.replace(/_/g, " ")}`,
    rationale:
      s.notes[0] ??
      review.session_review.missed_opportunities[0] ??
      `Score ${s.score}/100 on observed evidence.`,
    evidence: s.evidence.slice(0, 2),
    practice_suggestion:
      s.id === "risk_assessment"
        ? "In the next session, ask a direct SI question before offering advice."
        : s.id === "reflection"
          ? "Offer one content and one feeling reflection in the first 10 minutes."
          : `Design one deliberate practice turn targeting ${s.id.replace(/_/g, " ")}.`,
  }));

  // Stage 8 metrics — only recommend when metrics exist and are weak.
  const m = review.validation_metrics;
  if (m && typeof m.alliance_score === "number" && m.alliance_score < 55) {
    recs.unshift({
      id: "rec-validation-alliance",
      priority: "high",
      skill_id: "alliance",
      title: "Strengthen alliance (Stage 8 alliance_score grounding)",
      rationale: `Stage 8 observational alliance_score=${m.alliance_score}.`,
      evidence: [
        {
          source: "validation",
          excerpt: `alliance_score=${m.alliance_score}; session_quality=${m.session_quality ?? "n/a"}`,
          skill: "alliance",
        },
      ],
      practice_suggestion:
        "Negotiate a shared agenda and check bond mid-session.",
    });
  }

  if (m && typeof m.session_quality === "number" && m.session_quality < 50) {
    recs.push({
      id: "rec-validation-session-quality",
      priority: "medium",
      skill_id: "session_structure",
      title: "Improve session structure (Stage 8 session_quality)",
      rationale: `Stage 8 session_quality=${m.session_quality}.`,
      evidence: [
        {
          source: "validation",
          excerpt: `session_quality=${m.session_quality}`,
          skill: "session_structure",
        },
      ],
      practice_suggestion: "Use opening agenda, mid-summary, and explicit close.",
    });
  }

  return recs.slice(0, 8);
}
