/**
 * Stage 7 competency framework — maps educational domains onto ACE CompetencyIds.
 * ACE remains the persistence / EMA owner. Weights are educational framework metadata.
 */

import type { CompetencyId, LearnerCompetency } from "@/lib/ace/types";
import type {
  EducationCompetencyDefinition,
  EducationCompetencyDomainId,
  EducationCompetencyScore,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

export const EDUCATION_COMPETENCY_DEFINITIONS: EducationCompetencyDefinition[] = [
  {
    id: "diagnostic_interviewing",
    label: "Diagnostic interviewing",
    description: "Structured psychiatric interview coverage and sequencing",
    weight: 7,
    ace_competencies: ["diagnostic_interview"],
    category: "interview",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "rapport",
    label: "Rapport",
    description: "Collaborative alliance and engagement",
    weight: 5,
    ace_competencies: ["therapeutic_alliance"],
    category: "alliance",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "empathy",
    label: "Empathy",
    description: "Empathic attunement and validation",
    weight: 5,
    ace_competencies: ["empathy"],
    category: "alliance",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "reflective_listening",
    label: "Reflective listening",
    description: "Accurate reflections and summaries",
    weight: 4,
    ace_competencies: ["empathy", "professional_communication"],
    category: "alliance",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "question_quality",
    label: "Question quality",
    description: "Open vs closed balance; avoid leading questions",
    weight: 5,
    ace_competencies: ["diagnostic_interview", "professional_communication"],
    category: "interview",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "risk_assessment",
    label: "Risk assessment",
    description: "Suicide, violence, and safety formulation",
    weight: 8,
    ace_competencies: ["risk_assessment", "suicide_assessment", "violence_assessment"],
    category: "safety",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "mental_state_examination",
    label: "Mental State Examination",
    description: "MSE completeness and accuracy",
    weight: 6,
    ace_competencies: ["mental_status_examination"],
    category: "interview",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "diagnostic_formulation",
    label: "Diagnostic formulation",
    description: "Biopsychosocial / clinical formulation",
    weight: 6,
    ace_competencies: ["psychodynamic_interviewing", "treatment_planning"],
    category: "diagnosis",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "differential_diagnosis",
    label: "Differential diagnosis",
    description: "Generate and rule out differentials",
    weight: 6,
    ace_competencies: ["differential_diagnosis"],
    category: "diagnosis",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "dsm_reasoning",
    label: "DSM reasoning",
    description: "Educational DSM-5 criteria reasoning",
    weight: 5,
    ace_competencies: ["dsm5_reasoning"],
    category: "diagnosis",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "icd_reasoning",
    label: "ICD reasoning",
    description: "Educational ICD-11 criteria reasoning",
    weight: 5,
    ace_competencies: ["icd11_reasoning"],
    category: "diagnosis",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "treatment_planning",
    label: "Treatment planning",
    description: "Collaborative, modality-congruent plans",
    weight: 5,
    ace_competencies: ["treatment_planning", "medication_management"],
    category: "treatment",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "psychotherapy_skills",
    label: "Psychotherapy skills",
    description: "CBT/DBT/ACT/MI/supportive skills",
    weight: 6,
    ace_competencies: [
      "cbt_skills",
      "dbt_skills",
      "act_skills",
      "motivational_interviewing",
      "supportive_therapy",
    ],
    category: "treatment",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "crisis_management",
    label: "Crisis management",
    description: "Acute risk and emergency psychiatry",
    weight: 5,
    ace_competencies: ["emergency_psychiatry", "suicide_assessment"],
    category: "safety",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "documentation_quality",
    label: "Documentation quality",
    description: "Clear clinical documentation",
    weight: 3,
    ace_competencies: ["documentation"],
    category: "professional",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "professionalism",
    label: "Professionalism",
    description: "Professional conduct and boundaries",
    weight: 3,
    ace_competencies: ["professional_communication", "ethical_decision_making"],
    category: "professional",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "ethics",
    label: "Ethics",
    description: "Ethical decision-making",
    weight: 3,
    ace_competencies: ["ethical_decision_making"],
    category: "professional",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "communication",
    label: "Communication",
    description: "Clear professional communication",
    weight: 4,
    ace_competencies: ["professional_communication", "cultural_competence"],
    category: "professional",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "clinical_judgement",
    label: "Clinical judgement",
    description: "Integrated clinical judgment under uncertainty",
    weight: 5,
    ace_competencies: [
      "differential_diagnosis",
      "risk_assessment",
      "treatment_planning",
    ],
    category: "diagnosis",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
  {
    id: "session_structure",
    label: "Session structure",
    description: "Opening, pacing, closure, time use",
    weight: 4,
    ace_competencies: ["time_management", "documentation"],
    category: "structure",
    version: EDUCATION_FRAMEWORK_VERSION,
  },
];

export function educationCompetencyById(
  id: EducationCompetencyDomainId,
): EducationCompetencyDefinition {
  const d = EDUCATION_COMPETENCY_DEFINITIONS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown education competency: ${id}`);
  return d;
}

function aceScore(
  competencies: LearnerCompetency[],
  id: CompetencyId,
): { score: number; samples: number; trend: number } {
  const row = competencies.find((c) => c.competency_id === id);
  return {
    score: row?.score ?? 50,
    samples: row?.samples ?? 0,
    trend: row?.trend ?? 0,
  };
}

/** Aggregate ACE competency EMAs into Stage 7 domain scores. */
export function scoreEducationCompetencies(
  aceCompetencies: LearnerCompetency[],
): EducationCompetencyScore[] {
  return EDUCATION_COMPETENCY_DEFINITIONS.map((def) => {
    const sources = def.ace_competencies.map((id) => {
      const s = aceScore(aceCompetencies, id);
      return { competency_id: id, score: s.score, samples: s.samples, trend: s.trend };
    });
    const score = Math.round(
      sources.reduce((a, s) => a + s.score, 0) / Math.max(1, sources.length),
    );
    const samples = Math.max(...sources.map((s) => s.samples), 0);
    const trend = Math.round(
      sources.reduce((a, s) => a + s.trend, 0) / Math.max(1, sources.length),
    );
    return {
      id: def.id,
      score,
      weight: def.weight,
      ace_sources: sources.map((s) => ({
        competency_id: s.competency_id,
        score: s.score,
      })),
      samples,
      trend,
    };
  });
}

/** Weighted overall from Stage 7 domains (educational — not assessment SSOT). */
export function weightedEducationOverall(scores: EducationCompetencyScore[]): number {
  const w = scores.reduce((a, s) => a + s.weight, 0) || 1;
  return Math.round(scores.reduce((a, s) => a + s.score * s.weight, 0) / w);
}
