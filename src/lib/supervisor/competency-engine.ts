/**
 * Competency Engine — Dreyfus progression mapped to observable evidence.
 * Educational only. Never writes patient state.
 */

import type {
  CompetencyLevel,
  CompetencyProgressionEntry,
  CompetencyProgressionReport,
  EvidenceCitation,
  TherapistSkillDefinition,
  TherapistSkillId,
  TherapistSkillScore,
} from "@/lib/supervisor/types";
import { SUPERVISOR_FRAMEWORK_VERSION } from "@/lib/supervisor/types";

export const COMPETENCY_LEVEL_ORDER: CompetencyLevel[] = [
  "novice",
  "advanced_beginner",
  "competent",
  "proficient",
  "expert",
  "master",
];

export function levelFromScore(score: number): CompetencyLevel {
  if (score >= 95) return "master";
  if (score >= 88) return "expert";
  if (score >= 78) return "proficient";
  if (score >= 65) return "competent";
  if (score >= 45) return "advanced_beginner";
  return "novice";
}

export function levelRank(level: CompetencyLevel): number {
  return COMPETENCY_LEVEL_ORDER.indexOf(level);
}

export function nextLevel(level: CompetencyLevel): CompetencyLevel | null {
  const i = levelRank(level);
  if (i < 0 || i >= COMPETENCY_LEVEL_ORDER.length - 1) return null;
  return COMPETENCY_LEVEL_ORDER[i + 1]!;
}

/** Canonical Stage 9 therapist skill catalogue (weights sum ≈ 100). */
export const THERAPIST_SKILL_DEFINITIONS: TherapistSkillDefinition[] = [
  {
    id: "rapport",
    label: "Rapport",
    description: "Warm engagement and collaborative tone",
    weight: 5,
    category: "alliance",
    ace_competencies: ["therapeutic_alliance"],
    observable_markers: ["greeting warmth", "collaborative language", "pacing"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "alliance",
    label: "Therapeutic alliance",
    description: "Shared goals, tasks, and bond",
    weight: 6,
    category: "alliance",
    ace_competencies: ["therapeutic_alliance"],
    observable_markers: ["goal negotiation", "repair attempts", "bond statements"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "empathy",
    label: "Empathy",
    description: "Accurate empathic attunement",
    weight: 6,
    category: "alliance",
    ace_competencies: ["empathy"],
    observable_markers: ["affect reflections", "perspective-taking"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "active_listening",
    label: "Active listening",
    description: "Attending without premature advice",
    weight: 5,
    category: "communication",
    ace_competencies: ["empathy", "professional_communication"],
    observable_markers: ["follow-up on patient words", "minimal encouragers"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "reflection",
    label: "Reflection",
    description: "Content and feeling reflections",
    weight: 5,
    category: "communication",
    ace_competencies: ["empathy"],
    observable_markers: ["it sounds like", "what I hear"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "validation",
    label: "Validation",
    description: "Legitimizing patient experience",
    weight: 5,
    category: "communication",
    ace_competencies: ["empathy", "dbt_skills"],
    observable_markers: ["that makes sense", "understandable"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "open_questions",
    label: "Open questions",
    description: "Exploratory open-ended inquiry",
    weight: 5,
    category: "communication",
    ace_competencies: ["diagnostic_interview", "professional_communication"],
    observable_markers: ["what/how questions", "tell me about"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "closed_questions",
    label: "Closed questions",
    description: "Judicious yes/no and factual checks",
    weight: 3,
    category: "communication",
    ace_competencies: ["diagnostic_interview"],
    observable_markers: ["did/are/is questions used sparingly"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "summarization",
    label: "Summarization",
    description: "Periodic accurate summaries",
    weight: 4,
    category: "structure",
    ace_competencies: ["professional_communication", "time_management"],
    observable_markers: ["to summarize", "so far we've"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "boundary_management",
    label: "Boundary management",
    description: "Professional role clarity and limits",
    weight: 4,
    category: "professional",
    ace_competencies: ["ethical_decision_making", "professional_communication"],
    observable_markers: ["role clarity", "session limits", "dual-relationship awareness"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "risk_assessment",
    label: "Risk assessment",
    description: "Suicide, violence, and safety inquiry",
    weight: 8,
    category: "safety",
    ace_competencies: ["risk_assessment", "suicide_assessment", "violence_assessment"],
    observable_markers: ["SI inquiry", "safety planning language"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "diagnostic_reasoning",
    label: "Diagnostic reasoning",
    description: "Evidence-linked differential thinking",
    weight: 6,
    category: "reasoning",
    ace_competencies: ["differential_diagnosis", "dsm5_reasoning", "icd11_reasoning"],
    observable_markers: ["symptom timeline", "differential exploration"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "case_formulation",
    label: "Case formulation",
    description: "Integrative clinical formulation",
    weight: 5,
    category: "reasoning",
    ace_competencies: ["psychodynamic_interviewing", "treatment_planning"],
    observable_markers: ["maintainers", "beliefs", "functional analysis"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "clinical_prioritization",
    label: "Clinical prioritization",
    description: "Safety and acuity before secondary goals",
    weight: 5,
    category: "safety",
    ace_competencies: ["risk_assessment", "emergency_psychiatry", "time_management"],
    observable_markers: ["risk before advice", "agenda negotiation"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "professional_language",
    label: "Professional language",
    description: "Clear, non-stigmatizing clinical speech",
    weight: 4,
    category: "professional",
    ace_competencies: ["professional_communication"],
    observable_markers: ["non-jargon with patient", "precise clinical terms"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "ethics",
    label: "Ethics",
    description: "Consent, autonomy, and non-maleficence",
    weight: 5,
    category: "professional",
    ace_competencies: ["ethical_decision_making"],
    observable_markers: ["consent language", "autonomy support", "no coercion"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Educational documentation quality cues",
    weight: 3,
    category: "professional",
    ace_competencies: ["documentation"],
    observable_markers: ["structured closing notes cues", "plan clarity"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "session_structure",
    label: "Session structure",
    description: "Agenda, pacing, and time use",
    weight: 5,
    category: "structure",
    ace_competencies: ["time_management"],
    observable_markers: ["opening agenda", "mid-session check", "closure"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "treatment_planning",
    label: "Treatment planning",
    description: "Collaborative next steps",
    weight: 5,
    category: "planning",
    ace_competencies: ["treatment_planning"],
    observable_markers: ["homework", "modality-congruent plan"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
  {
    id: "termination",
    label: "Termination",
    description: "Session closing and continuity",
    weight: 5,
    category: "structure",
    ace_competencies: ["time_management", "professional_communication"],
    observable_markers: ["before we finish", "next steps", "follow-up"],
    version: SUPERVISOR_FRAMEWORK_VERSION,
  },
];

export function skillDefinitionById(
  id: TherapistSkillId,
): TherapistSkillDefinition | undefined {
  return THERAPIST_SKILL_DEFINITIONS.find((d) => d.id === id);
}

export function criteriaForNextLevel(level: CompetencyLevel): string[] {
  const nxt = nextLevel(level);
  if (!nxt) return ["Maintain mastery with consistent evidence across sessions."];
  const map: Record<CompetencyLevel, string[]> = {
    novice: [
      "Demonstrate basic open questions and empathic reflections with cited turns.",
      "Ask at least one direct risk question when distress is present.",
    ],
    advanced_beginner: [
      "Balance open/closed questions; validate before intervening.",
      "Produce one accurate summary mid-session.",
    ],
    competent: [
      "Link symptoms to differentials without inventing diagnoses.",
      "Negotiate agenda and prioritize safety before advice.",
    ],
    proficient: [
      "Integrate formulation with modality-congruent interventions.",
      "Repair alliance ruptures and document next steps clearly.",
    ],
    expert: [
      "Flexibly shift modalities based on observed process.",
      "Model board-level risk, ethics, and prioritization under ambiguity.",
    ],
    master: [],
  };
  return map[level] ?? [`Advance toward ${nxt.replace(/_/g, " ")} with repeated evidence.`];
}

export function buildCompetencyProgression(
  skillScores: TherapistSkillScore[],
): CompetencyProgressionReport {
  const entries: CompetencyProgressionEntry[] = skillScores.map((s) => ({
    skill_id: s.id,
    level: s.level,
    score: s.score,
    evidence: s.evidence,
    next_level_criteria: criteriaForNextLevel(s.level),
  }));

  const weighted =
    skillScores.reduce((acc, s) => acc + s.score * s.weight, 0) /
    Math.max(
      1,
      skillScores.reduce((acc, s) => acc + s.weight, 0),
    );
  const overall_level = levelFromScore(weighted);

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    overall_level,
    entries,
    heatmap: skillScores.map((s) => ({
      id: s.id,
      score: s.score,
      level: s.level,
    })),
  };
}

export function emptyEvidence(
  excerpt: string,
  source: EvidenceCitation["source"] = "transcript",
  skill?: TherapistSkillId,
): EvidenceCitation {
  return { source, excerpt, skill };
}
