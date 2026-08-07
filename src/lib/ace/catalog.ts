import type {
  AdaptiveRule,
  CertificationBadge,
  CompetencyDomain,
  CompetencyId,
} from "./types";

export const COMPETENCY_DOMAINS: CompetencyDomain[] = [
  {
    id: "diagnostic_interview",
    label: "Diagnostic Interview",
    description: "Structured psychiatric interview",
    category: "assessment",
    sort_order: 10,
  },
  {
    id: "mental_status_examination",
    label: "Mental Status Examination",
    description: "MSE completeness and accuracy",
    category: "assessment",
    sort_order: 20,
  },
  {
    id: "dsm5_reasoning",
    label: "DSM-5 Diagnostic Reasoning",
    description: "Apply DSM-5 criteria",
    category: "diagnosis",
    sort_order: 30,
  },
  {
    id: "icd11_reasoning",
    label: "ICD-11 Diagnostic Reasoning",
    description: "Apply ICD-11 criteria",
    category: "diagnosis",
    sort_order: 40,
  },
  {
    id: "differential_diagnosis",
    label: "Differential Diagnosis",
    description: "Generate and rule out differentials",
    category: "diagnosis",
    sort_order: 50,
  },
  {
    id: "risk_assessment",
    label: "Risk Assessment",
    description: "General risk formulation",
    category: "safety",
    sort_order: 60,
  },
  {
    id: "suicide_assessment",
    label: "Suicide Assessment",
    description: "SI inquiry and safety planning",
    category: "safety",
    sort_order: 70,
  },
  {
    id: "violence_assessment",
    label: "Violence Assessment",
    description: "Violence / harm-to-others assessment",
    category: "safety",
    sort_order: 80,
  },
  {
    id: "medication_management",
    label: "Medication Management",
    description: "Psychopharmacology decisions",
    category: "treatment",
    sort_order: 90,
  },
  {
    id: "cbt_skills",
    label: "CBT Skills",
    description: "Cognitive behavioural interventions",
    category: "therapy",
    sort_order: 100,
  },
  {
    id: "dbt_skills",
    label: "DBT Skills",
    description: "Dialectical behaviour skills",
    category: "therapy",
    sort_order: 110,
  },
  {
    id: "act_skills",
    label: "ACT Skills",
    description: "Acceptance and commitment therapy",
    category: "therapy",
    sort_order: 120,
  },
  {
    id: "motivational_interviewing",
    label: "Motivational Interviewing",
    description: "MI spirit and techniques",
    category: "therapy",
    sort_order: 130,
  },
  {
    id: "psychodynamic_interviewing",
    label: "Psychodynamic Interviewing",
    description: "Psychodynamic formulation skills",
    category: "therapy",
    sort_order: 140,
  },
  {
    id: "supportive_therapy",
    label: "Supportive Therapy",
    description: "Supportive psychotherapy skills",
    category: "therapy",
    sort_order: 150,
  },
  {
    id: "therapeutic_alliance",
    label: "Therapeutic Alliance",
    description: "Collaborative working alliance",
    category: "alliance",
    sort_order: 160,
  },
  {
    id: "empathy",
    label: "Empathy",
    description: "Empathic communication",
    category: "alliance",
    sort_order: 170,
  },
  {
    id: "psychoeducation",
    label: "Psychoeducation",
    description: "Patient education",
    category: "treatment",
    sort_order: 180,
  },
  {
    id: "treatment_planning",
    label: "Treatment Planning",
    description: "Collaborative treatment plans",
    category: "treatment",
    sort_order: 190,
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Clinical documentation quality",
    category: "professional",
    sort_order: 200,
  },
  {
    id: "professional_communication",
    label: "Professional Communication",
    description: "Clear professional communication",
    category: "professional",
    sort_order: 210,
  },
  {
    id: "time_management",
    label: "Time Management",
    description: "Station / session time use",
    category: "professional",
    sort_order: 220,
  },
  {
    id: "ethical_decision_making",
    label: "Ethical Decision Making",
    description: "Ethics and professionalism",
    category: "professional",
    sort_order: 230,
  },
  {
    id: "cultural_competence",
    label: "Cultural Competence",
    description: "Culturally responsive care",
    category: "professional",
    sort_order: 240,
  },
  {
    id: "family_interviewing",
    label: "Family Interviewing",
    description: "Family / systems assessment",
    category: "assessment",
    sort_order: 250,
  },
  {
    id: "emergency_psychiatry",
    label: "Emergency Psychiatry",
    description: "Acute / emergency psychiatry",
    category: "safety",
    sort_order: 260,
  },
];

export const COMPETENCY_IDS: CompetencyId[] = COMPETENCY_DOMAINS.map(
  (d) => d.id,
);

/** Map legacy session rubric item ids → ACE competencies. */
export const RUBRIC_TO_COMPETENCIES: Record<string, CompetencyId[]> = {
  // Mission 9 Clinical Educator dimensions
  rapport: ["therapeutic_alliance", "empathy", "professional_communication"],
  empathy: ["empathy"],
  risk_assessment: ["risk_assessment", "suicide_assessment"],
  history_taking: [
    "diagnostic_interview",
    "mental_status_examination",
    "differential_diagnosis",
  ],
  dsm_reasoning: ["dsm5_reasoning", "differential_diagnosis"],
  therapeutic_alliance: ["therapeutic_alliance", "empathy"],
  communication: ["professional_communication"],
  professionalism: ["ethical_decision_making", "professional_communication"],
  session_structure: ["time_management", "documentation", "professional_communication"],
  treatment_planning: ["treatment_planning", "cbt_skills", "psychoeducation"],
  // Legacy Wave-3 / avatar-authored ids
  alliance: ["therapeutic_alliance", "empathy"],
  // Interview/MSE only — coding systems scored via dedicated rubric items.
  assessment: [
    "diagnostic_interview",
    "mental_status_examination",
    "differential_diagnosis",
  ],
  interventions: ["cbt_skills", "treatment_planning", "psychoeducation"],
  safety: ["risk_assessment", "suicide_assessment"],
  structure: ["time_management", "documentation", "professional_communication"],
  // Dual-coding + formulation educational competencies (W3-H3)
  diagnostic_accuracy: ["dsm5_reasoning", "icd11_reasoning", "differential_diagnosis"],
  icd_reasoning: ["icd11_reasoning", "differential_diagnosis"],
  clinical_formulation: [
    "psychodynamic_interviewing",
    "treatment_planning",
    "diagnostic_interview",
  ],
  differential_diagnosis: ["differential_diagnosis", "dsm5_reasoning", "icd11_reasoning"],
  risk_formulation: ["risk_assessment", "suicide_assessment", "violence_assessment"],
  educational_competency: [
    "documentation",
    "professional_communication",
    "psychoeducation",
    "time_management",
  ],
  safety_planning: ["suicide_assessment", "risk_assessment"],
  documentation: ["documentation"],
  medication_decisions: ["medication_management"],
  time_management: ["time_management"],
};

export const BUILTIN_ADAPTIVE_RULES: AdaptiveRule[] = [
  {
    slug: "remediate-suicide-assessment",
    name: "Remediate suicide assessment",
    description:
      "When suicide assessment is weak, generate subtle SI / risk-focused cases",
    trigger_competency_id: "suicide_assessment",
    trigger_operator: "lt",
    trigger_threshold: 70,
    adaptation: {
      focus: ["suicide_assessment", "risk_assessment"],
      diagnosis_pool: [
        "mdd-recurrent-moderate",
        "bpd",
        "ptsd",
        "alcohol-use-disorder",
      ],
      si_styles: [
        "passive",
        "indirect_hopelessness",
        "hidden_protective",
        "variable_risk",
      ],
      difficulty_delta: 0,
      reduce_unrelated_complexity: true,
      preset_slugs: ["suicide-risk-resident-en"],
    },
    priority: 100,
    enabled: true,
  },
  {
    slug: "remediate-differential",
    name: "Remediate differential diagnosis",
    description:
      "When differential is weak but CBT strong, increase diagnostic ambiguity only",
    trigger_competency_id: "differential_diagnosis",
    trigger_operator: "lt",
    trigger_threshold: 60,
    adaptation: {
      focus: ["differential_diagnosis", "dsm5_reasoning"],
      require_high: [{ competency: "cbt_skills", min: 90 }],
      diagnosis_pool: [
        "mdd-recurrent-moderate",
        "gad-with-panic",
        "bipolar-mania",
        "adult-adhd",
      ],
      adaptations: [
        "diagnostic_ambiguity",
        "mixed_presentation",
        "comorbidity",
        "medical_mimic",
      ],
      hold_therapy_complexity: true,
      difficulty_delta: 0,
    },
    priority: 90,
    enabled: true,
  },
  {
    slug: "scaffold-on-failure",
    name: "Scaffold on repeated failure",
    description:
      "Reduce complexity and increase educational feedback when failing",
    trigger_competency_id: "diagnostic_interview",
    trigger_operator: "lt",
    trigger_threshold: 50,
    adaptation: {
      focus: ["diagnostic_interview"],
      reduce: ["complexity", "comorbidity", "resistance", "time_pressure"],
      feedback_mode: "realtime_coaching",
      difficulty_delta: -1,
      allow_hints: true,
    },
    priority: 80,
    enabled: true,
  },
  {
    slug: "accelerate-on-improvement",
    name: "Accelerate on sustained improvement",
    description:
      "Raise resistance, uncertainty, comorbidity, masking, time pressure when improving",
    trigger_competency_id: "diagnostic_interview",
    trigger_operator: "gte",
    trigger_threshold: 75,
    adaptation: {
      focus: ["diagnostic_interview"],
      require_velocity_min: 0.5,
      increase: [
        "resistance",
        "diagnostic_uncertainty",
        "comorbidity",
        "masking",
        "time_pressure",
        "limited_disclosure",
      ],
      difficulty_delta: 1,
    },
    priority: 40,
    enabled: true,
  },
];

export const CERTIFICATION_BADGES: CertificationBadge[] = [
  {
    badge_slug: "suicide-assessment-certified",
    title: "Suicide Assessment Certified",
    competency_id: "suicide_assessment",
    threshold: 80,
    min_samples: 5,
  },
  {
    badge_slug: "cbt-level-1",
    title: "CBT Level 1",
    competency_id: "cbt_skills",
    threshold: 75,
    min_samples: 4,
  },
  {
    badge_slug: "risk-assessment-expert",
    title: "Risk Assessment Expert",
    competency_id: "risk_assessment",
    threshold: 85,
    min_samples: 5,
  },
  {
    badge_slug: "differential-diagnosis-master",
    title: "Differential Diagnosis Master",
    competency_id: "differential_diagnosis",
    threshold: 85,
    min_samples: 6,
  },
  {
    badge_slug: "trauma-specialist",
    title: "Trauma Specialist",
    competency_id: "risk_assessment",
    threshold: 80,
    min_samples: 4,
  },
  {
    badge_slug: "medication-management-certified",
    title: "Medication Management Certified",
    competency_id: "medication_management",
    threshold: 80,
    min_samples: 4,
  },
];

export const SUICIDE_CURRICULUM_STEPS = [
  { title: "Passive SI", si_style: "passive", diagnosis: "mdd-recurrent-moderate", difficulty: "beginner" as const },
  { title: "Hidden SI", si_style: "hidden_protective", diagnosis: "mdd-recurrent-moderate", difficulty: "intermediate" as const },
  { title: "BPD with chronic SI", si_style: "variable_risk", diagnosis: "bpd", difficulty: "intermediate" as const },
  { title: "Psychotic depression risk", si_style: "indirect_hopelessness", diagnosis: "mdd-recurrent-moderate", difficulty: "advanced" as const },
  { title: "High-risk crisis", si_style: "variable_risk", diagnosis: "ptsd", difficulty: "advanced" as const },
];

export function scoreOf(
  competencies: Array<{ competency_id: string; score: number }>,
  id: CompetencyId,
  fallback = 50,
): number {
  return competencies.find((c) => c.competency_id === id)?.score ?? fallback;
}
