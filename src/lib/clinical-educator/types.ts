/**
 * Clinical Educator (Mission 9) — multi-dimension OSCE-style scoring types.
 * Formative educational signals only — not validated high-stakes credentials.
 */

export const CLINICAL_EDUCATOR_DIMENSION_IDS = [
  "rapport",
  "empathy",
  "risk_assessment",
  "history_taking",
  "dsm_reasoning",
  "therapeutic_alliance",
  "communication",
  "professionalism",
  "session_structure",
  "treatment_planning",
] as const;

export type ClinicalEducatorDimensionId =
  (typeof CLINICAL_EDUCATOR_DIMENSION_IDS)[number];

export type RubricAnchor = {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label_en: string;
  label_ar: string;
  description_en: string;
  description_ar: string;
};

export type ClinicalEducatorRubricItem = {
  id: ClinicalEducatorDimensionId;
  label_en: string;
  label_ar: string;
  weight: number;
  max: 5;
  /** What good looks like for educators / examiners. */
  guidance_en: string;
  guidance_ar: string;
  anchors: RubricAnchor[];
  /** Keywords used to mine transcript examples (EN + AR). */
  example_cues: string[];
};

export type ClinicalEducatorDimensionScore = {
  id: ClinicalEducatorDimensionId;
  label: string;
  score: number;
  max: number;
  weight: number;
  /** 0–100 normalized for dashboard charts. */
  percent: number;
  /** Detailed educational feedback for the learner (admin-facing). */
  feedback: string;
  /** Strengths observed in this dimension. */
  strengths: string[];
  /** Concrete growth areas. */
  growth_areas: string[];
  /** Suggested next practice drill. */
  next_practice: string;
  /** Verbatim transcript excerpts supporting the score. */
  examples: string[];
};

export type ClinicalEducatorReport = {
  version: string;
  rubric_version: string;
  language: "en" | "ar";
  /** Retained for ACE/ERI compatibility; UI should not lead with this alone. */
  composite: number;
  dimensions: ClinicalEducatorDimensionScore[];
  /** Holistic educational narrative (distinct from exam narrative). */
  educational_summary: string;
  /** Top transcript moments for coaching. */
  coaching_excerpts: string[];
  assessment_mode: "llm_examiner" | "heuristic_fallback";
  /** Explicit disclosure — scores are formative, not validated. */
  disclaimer: string;
};

export type ClinicalEducatorDashboard = {
  version: string;
  n_reports: number;
  dimension_averages: Array<{
    id: ClinicalEducatorDimensionId;
    label: string;
    average_percent: number;
    n: number;
  }>;
  weakest_dimensions: ClinicalEducatorDimensionId[];
  strongest_dimensions: ClinicalEducatorDimensionId[];
  recent: Array<{
    session_id: string;
    therapist_name: string | null;
    patient_name: string | null;
    language: string | null;
    created_at: string;
    composite: number | null;
    dimensions: Array<{ id: string; percent: number }>;
  }>;
  disclaimer: string;
};
