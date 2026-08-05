import type { EoiRecommendation, EoiOpportunityType } from "@/lib/eoi/types";

const CURRICULUM: Record<string, string[]> = {
  teaching_enhancement: ["case-engine", "scenario-templates", "prompt-engine"],
  clinical_realism: ["case-engine", "personas", "prompt-engine"],
  conversation_improvement: ["prompt-engine", "voice", "conversation-fidelity"],
  therapeutic_alliance: ["prompt-engine", "pme", "session-arc"],
  assessment_improvement: ["assessment", "avi", "reports"],
  supervisor_feedback: ["ace/coach", "reports", "instructor-presets"],
  adaptive_learning: ["ace", "cge", "instructor-presets"],
  scenario_variation: ["scenario-templates", "case-engine", "presets"],
  osce_improvement: ["instructor-presets", "assessment", "templates"],
  competency_mapping: ["cge", "ace", "templates"],
  reflection_opportunity: ["ace/coach", "complete-page"],
  communication_skills: ["prompt-engine", "voice", "session-ui"],
  professionalism: ["prompt-engine", "assessment"],
  ethics: ["prompt-engine", "safety-module"],
  cultural_competence: ["personas", "i18n", "prompt-engine"],
  patient_safety: ["risk-module", "assessment", "prompt-engine"],
  shared_decision_making: ["prompt-engine", "assessment"],
  evidence_based_practice: ["assessment", "research-export"],
  other: ["curriculum"],
};

export function buildEoiRecommendation(input: {
  title: string;
  opportunity_type: EoiOpportunityType | string;
  impact_avg: number;
  report_count: number;
  idea_samples: string[];
  disorders: string[];
  learners: string[];
  competencies: string[];
  languages: string[];
}): EoiRecommendation {
  const curriculum = CURRICULUM[input.opportunity_type] ?? CURRICULUM.other!;
  const educational_priority =
    input.impact_avg >= 4.5 && input.report_count >= 3
      ? "p0"
      : input.impact_avg >= 4 || input.report_count >= 5
        ? "p1"
        : input.impact_avg >= 3
          ? "p2"
          : "p3";

  const effort: EoiRecommendation["estimated_effort"] =
    input.opportunity_type === "scenario_variation" ||
    input.opportunity_type === "osce_improvement"
      ? "m"
      : input.opportunity_type === "adaptive_learning" ||
          input.opportunity_type === "competency_mapping"
        ? "l"
        : "s";

  const difficulty_level =
    input.learners.includes("consultant_psychiatrist") ||
    input.learners.includes("psychiatry_resident")
      ? "advanced"
      : input.learners.includes("medical_student") ||
          input.learners.includes("psychology_student")
        ? "foundational"
        : "intermediate";

  const educational_rationale = [
    `Expert educators identified a teaching enhancement (${input.opportunity_type.replace(/_/g, " ")}).`,
    `This is an educational asset — not a software defect.`,
    `${input.report_count} corroborating suggestion(s); mean impact ${input.impact_avg.toFixed(1)}/5.`,
    input.disorders.length
      ? `Primarily affects: ${input.disorders.join(", ")}.`
      : "Cross-disorder teaching opportunity.",
  ].join(" ");

  const expected_learner_benefit = [
    input.competencies.length
      ? `Strengthens competencies: ${input.competencies.join(", ")}.`
      : "Strengthens clinical interviewing / reasoning practice.",
    input.learners.length
      ? `Highest value for: ${input.learners.join(", ")}.`
      : "Broad learner benefit.",
    "Expected to improve deliberate practice fidelity and transfer to real clinical settings.",
  ].join(" ");

  const research_value =
    input.impact_avg >= 4
      ? "High — candidate for pre/post learner performance study"
      : "Moderate — useful for curriculum qualitative research";

  const strategic_value =
    educational_priority === "p0" || educational_priority === "p1"
      ? "High strategic value for residency/OSCE differentiation"
      : "Incremental curriculum quality gain";

  const samples = input.idea_samples
    .map((t, i) => `${i + 1}. ${t.slice(0, 220)}`)
    .join("\n");

  const cursor_prompt = [
    `Implement an EDUCATIONAL OPPORTUNITY (not a bugfix): ${input.title}`,
    `Type=${input.opportunity_type}; priority=${educational_priority}; effort=${effort}.`,
    `Question to answer: How could this improve learning?`,
    `Curriculum touchpoints: ${curriculum.join(", ")}.`,
    `Disorders: ${input.disorders.join(", ") || "n/a"}; learners: ${input.learners.join(", ") || "n/a"}.`,
    `Competencies: ${input.competencies.join(", ") || "n/a"}.`,
    "Constraints: do not mis-label as defect; preserve CQI/EOI separation; add tests where useful; human approval required before merge.",
    "Expert ideas:",
    samples || "(none)",
  ].join("\n");

  return {
    educational_rationale,
    expected_learner_benefit,
    affected_disorders: input.disorders,
    affected_curriculum: curriculum,
    affected_competencies: input.competencies,
    difficulty_level,
    estimated_effort: effort,
    educational_priority,
    research_value,
    strategic_value,
    cursor_prompt,
    backlog_notes: `Backlog item derived from EOI cluster (${input.report_count} reports).`,
    requires_human_approval: true,
    is_defect: false,
  };
}

/** Backlog score: impact↑, reports↑, research↑, effort↓ */
export function computeBacklogScore(input: {
  impact_avg: number;
  report_count: number;
  priority: string;
  effort: string;
  research_high: boolean;
}): number {
  const pri =
    input.priority === "p0"
      ? 40
      : input.priority === "p1"
        ? 30
        : input.priority === "p2"
          ? 20
          : 10;
  const effortPenalty =
    input.effort === "xl"
      ? 12
      : input.effort === "l"
        ? 8
        : input.effort === "m"
          ? 4
          : 0;
  return (
    Math.round(
      (input.impact_avg * 12 +
        Math.min(25, input.report_count * 3) +
        pri +
        (input.research_high ? 10 : 0) -
        effortPenalty) *
        10,
    ) / 10
  );
}
