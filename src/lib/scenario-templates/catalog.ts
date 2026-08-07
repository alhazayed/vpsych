import { DISORDER_IDS } from "@/lib/case-engine/catalog";
import type { ClinicalScenarioTemplate } from "@/lib/scenario-templates/types";

/** Builtin templates used offline / when DB unavailable. */
export const BUILTIN_TEMPLATES: ClinicalScenarioTemplate[] = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    slug: "adult-mdd-initial-en",
    name: "Adult MDD — Initial Assessment (English)",
    description:
      "Standardized initial assessment for moderate recurrent MDD with optional GAD comorbidity.",
    specialty: "general_adult_psychiatry",
    target_learners: [
      "psychiatry_resident",
      "gp",
      "counsellor",
      "clinical_psychology",
    ],
    estimated_duration_minutes: 40,
    difficulty: "intermediate",
    language: "en-US",
    culture: "north_american_urban",
    therapy_modality: "cbt",
    primary_diagnosis_id: DISORDER_IDS.mdd,
    primary_diagnosis_slug: "mdd-recurrent-moderate",
    allowed_comorbidity_slugs: ["gad-with-panic", "alcohol-use-disorder"],
    excluded_diagnosis_slugs: ["bipolar-mania"],
    severity: "moderate",
    risk_level: "moderate",
    assessment_type: "initial_assessment",
    default_persona_slug: "maya-chen",
    randomization_level: "moderate",
    memory_mode: "case_isolated",
    grading_rubric: {
      pass_threshold: 60,
      outstanding_threshold: 85,
      critical_mistakes: [
        "ignoring passive SI",
        "prescribing without bipolar screen",
      ],
      automatic_deductions: { missed_safety_assessment: 15 },
    },
    report_template: {
      sections: ["summary", "risk", "formulation", "plan"],
    },
    learning_objectives: [
      {
        category: "skills",
        statement: "Conduct a structured mood and risk assessment",
      },
      {
        category: "risk",
        statement: "Elicit passive SI with calm specific questioning",
      },
      {
        category: "dsm_reasoning",
        statement: "Defend MDD severity and anxious distress specifier",
      },
      {
        category: "differential_diagnosis",
        statement: "Screen for bipolarity before antidepressant discussion",
      },
      {
        category: "therapeutic_alliance",
        statement: "Validate affect before behavioural activation",
      },
    ],
    clinical_competencies: [
      {
        competency_id: "alliance",
        label: "Therapeutic alliance",
        weight: 1.2,
        max_score: 5,
      },
      {
        competency_id: "safety",
        label: "Safety assessment",
        weight: 1.5,
        max_score: 5,
        critical: true,
        auto_deduction: 15,
        excellent_marker: "Specific SI questions without alarm",
      },
      {
        competency_id: "formulation",
        label: "Clinical formulation",
        weight: 1,
        max_score: 5,
      },
      {
        competency_id: "dsm",
        label: "DSM reasoning",
        weight: 1,
        max_score: 5,
      },
    ],
    enabled: true,
    version: 1,
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    slug: "adult-gad-osce-ar",
    name: "Adult GAD — OSCE (Arabic)",
    description:
      "OSCE-style GAD with panic features for Arabic Levantine simulation.",
    specialty: "general_adult_psychiatry",
    target_learners: ["psychiatry_resident", "medical_student"],
    estimated_duration_minutes: 20,
    difficulty: "advanced",
    language: "ar-JO",
    culture: "levantine_arabic",
    therapy_modality: "cbt",
    primary_diagnosis_id: DISORDER_IDS.gad,
    primary_diagnosis_slug: "gad-with-panic",
    allowed_comorbidity_slugs: ["mdd-recurrent-moderate", "adult-adhd"],
    excluded_diagnosis_slugs: ["bipolar-mania", "delirium"],
    severity: "moderate",
    risk_level: "low",
    assessment_type: "osce_examination",
    default_persona_slug: "jordan-hale",
    randomization_level: "low",
    memory_mode: "case_isolated",
    grading_rubric: {
      pass_threshold: 65,
      outstanding_threshold: 90,
      critical_mistakes: [
        "reassurance-seeking loop",
        "missing panic assessment",
      ],
    },
    report_template: {
      sections: ["osce_checklist", "risk", "communication"],
    },
    learning_objectives: [
      {
        category: "communication",
        statement: "Conduct OSCE interview in Arabic without locale leakage",
      },
      {
        category: "skills",
        statement: "Map worry domains and panic phenomenology",
      },
      {
        category: "icd_reasoning",
        statement: "Map GAD to ICD-11 6B00",
      },
    ],
    clinical_competencies: [
      {
        competency_id: "communication",
        label: "Communication",
        weight: 1.5,
        max_score: 5,
      },
      {
        competency_id: "anxiety_assessment",
        label: "Anxiety assessment",
        weight: 1.2,
        max_score: 5,
        critical: true,
      },
    ],
    enabled: true,
    version: 1,
  },
  {
    id: "e1000000-0000-4000-8000-000000000003",
    slug: "ptsd-risk-assessment-en",
    name: "PTSD — Risk Assessment (English)",
    description:
      "Trauma-informed risk assessment with MDD comorbidity allowed.",
    specialty: "emergency_psychiatry",
    target_learners: [
      "psychiatry_resident",
      "emergency_physician",
      "crisis_worker",
    ],
    estimated_duration_minutes: 30,
    difficulty: "advanced",
    language: "en-US",
    culture: "north_american_urban",
    therapy_modality: "crisis_intervention",
    primary_diagnosis_id: DISORDER_IDS.ptsd,
    primary_diagnosis_slug: "ptsd",
    allowed_comorbidity_slugs: [
      "mdd-recurrent-moderate",
      "alcohol-use-disorder",
    ],
    excluded_diagnosis_slugs: ["delirium"],
    severity: "severe",
    risk_level: "high",
    assessment_type: "risk_assessment",
    default_persona_slug: "elena-vasquez",
    randomization_level: "moderate",
    memory_mode: "case_isolated",
    grading_rubric: {
      pass_threshold: 70,
      outstanding_threshold: 90,
      critical_mistakes: ["forced trauma disclosure", "missed SI"],
    },
    report_template: {
      sections: ["risk", "safety_plan", "disposition"],
    },
    learning_objectives: [
      {
        category: "risk",
        statement: "Complete trauma-informed risk assessment",
      },
      {
        category: "skills",
        statement: "Titrate trauma content; avoid flooding",
      },
      {
        category: "documentation",
        statement: "Document disposition and safety plan",
      },
    ],
    clinical_competencies: [
      {
        competency_id: "safety",
        label: "Safety assessment",
        weight: 2,
        max_score: 5,
        critical: true,
        auto_deduction: 20,
      },
      {
        competency_id: "trauma_pacing",
        label: "Trauma pacing",
        weight: 1.5,
        max_score: 5,
      },
    ],
    enabled: true,
    version: 1,
  },
  {
    id: "e1000000-0000-4000-8000-000000000004",
    slug: "ocd-erp-assessment-en",
    name: "OCD — ERP-Informed Assessment (English)",
    description:
      "Map obsessions/compulsions and avoid reassurance loops; Wave-1 Marcus Okonkwo default.",
    specialty: "general_adult_psychiatry",
    target_learners: ["psychiatry_resident", "clinical_psychology", "counsellor"],
    estimated_duration_minutes: 40,
    difficulty: "intermediate",
    language: "en-US",
    culture: "north_american_urban",
    therapy_modality: "exposure_therapy",
    primary_diagnosis_id: DISORDER_IDS.ocd,
    primary_diagnosis_slug: "ocd",
    allowed_comorbidity_slugs: ["mdd-recurrent-moderate", "gad-with-panic"],
    excluded_diagnosis_slugs: ["schizophrenia"],
    severity: "moderate",
    risk_level: "low",
    assessment_type: "initial_assessment",
    default_persona_slug: "marcus-okonkwo",
    randomization_level: "moderate",
    memory_mode: "case_isolated",
    grading_rubric: {
      pass_threshold: 65,
      outstanding_threshold: 88,
      critical_mistakes: [
        "reassurance-seeking loop with clinician",
        "treating harm obsessions as intent",
      ],
    },
    report_template: { sections: ["summary", "obsession_map", "plan"] },
    learning_objectives: [
      {
        category: "skills",
        statement: "Map obsessions, compulsions, and time cost without reassuring content",
      },
      {
        category: "differential_diagnosis",
        statement: "Distinguish ego-dystonic harm obsessions from risk intent",
      },
      {
        category: "therapeutic_alliance",
        statement: "Normalise OCD shame while holding an ERP-ready stance",
      },
    ],
    clinical_competencies: [
      {
        competency_id: "alliance",
        label: "Therapeutic alliance",
        weight: 1.2,
        max_score: 5,
      },
      {
        competency_id: "ocd_assessment",
        label: "OCD assessment",
        weight: 1.5,
        max_score: 5,
        critical: true,
      },
    ],
    enabled: true,
    version: 1,
  },
  {
    id: "e1000000-0000-4000-8000-000000000005",
    slug: "perinatal-depression-en",
    name: "Perinatal Depression — Intrusions vs Psychosis (English)",
    description:
      "Postpartum MDD with ego-dystonic infant-harm intrusions; Wave-1 Sofia Morales.",
    specialty: "general_adult_psychiatry",
    target_learners: [
      "psychiatry_resident",
      "obgyn",
      "gp",
      "clinical_psychology",
    ],
    estimated_duration_minutes: 40,
    difficulty: "advanced",
    language: "en-US",
    culture: "north_american_urban",
    therapy_modality: "supportive",
    primary_diagnosis_id: DISORDER_IDS.mdd,
    primary_diagnosis_slug: "mdd-recurrent-moderate",
    allowed_comorbidity_slugs: ["gad-with-panic", "ocd"],
    excluded_diagnosis_slugs: ["schizophrenia", "bipolar-mania"],
    severity: "moderate",
    risk_level: "moderate",
    assessment_type: "initial_assessment",
    default_persona_slug: "sofia-morales",
    randomization_level: "low",
    memory_mode: "case_isolated",
    grading_rubric: {
      pass_threshold: 70,
      outstanding_threshold: 90,
      critical_mistakes: [
        "panicking at ego-dystonic intrusions",
        "missing passive SI",
        "assuming infant-harm intent without assessment",
      ],
    },
    report_template: {
      sections: ["summary", "risk", "bonding", "plan"],
    },
    learning_objectives: [
      {
        category: "risk",
        statement: "Differentiate ego-dystonic postpartum intrusions from psychosis",
      },
      {
        category: "skills",
        statement: "Assess bonding, sleep, and supports without shaming",
      },
      {
        category: "therapeutic_alliance",
        statement: "Reduce maternal shame to enable disclosure",
      },
    ],
    clinical_competencies: [
      {
        competency_id: "safety",
        label: "Safety assessment",
        weight: 1.8,
        max_score: 5,
        critical: true,
      },
      {
        competency_id: "perinatal",
        label: "Perinatal assessment",
        weight: 1.5,
        max_score: 5,
      },
    ],
    enabled: true,
    version: 1,
  },
  {
    id: "e1000000-0000-4000-8000-000000000006",
    slug: "adolescent-social-anxiety-en",
    name: "Adolescent Social Anxiety — Confidentiality (English)",
    description:
      "Teen social anxiety with parent-in-waiting-room dynamics; Wave-1 Tyler Bennett.",
    specialty: "child_psychiatry",
    target_learners: [
      "psychiatry_resident",
      "paediatrician",
      "school_counsellor",
      "clinical_psychology",
    ],
    estimated_duration_minutes: 40,
    difficulty: "intermediate",
    language: "en-US",
    culture: "north_american_urban",
    therapy_modality: "cbt",
    primary_diagnosis_id: DISORDER_IDS.socialAnxiety,
    primary_diagnosis_slug: "social-anxiety",
    allowed_comorbidity_slugs: ["mdd-recurrent-moderate", "adult-adhd"],
    excluded_diagnosis_slugs: ["schizophrenia", "bipolar-mania"],
    severity: "moderate",
    risk_level: "low",
    assessment_type: "initial_assessment",
    default_persona_slug: "tyler-bennett",
    randomization_level: "moderate",
    memory_mode: "case_isolated",
    grading_rubric: {
      pass_threshold: 65,
      outstanding_threshold: 88,
      critical_mistakes: [
        "breaking teen confidentiality without cause",
        "allying only with parents",
        "forcing immediate full exposure",
      ],
    },
    report_template: {
      sections: ["summary", "avoidance_map", "parent_feedback_plan"],
    },
    learning_objectives: [
      {
        category: "communication",
        statement: "Negotiate adolescent confidentiality while engaging parents wisely",
      },
      {
        category: "skills",
        statement: "Map social fears, avoidance, and safety behaviours",
      },
      {
        category: "differential_diagnosis",
        statement: "Differentiate social anxiety from shyness, ASD, and primary depression",
      },
    ],
    clinical_competencies: [
      {
        competency_id: "alliance",
        label: "Adolescent alliance",
        weight: 1.5,
        max_score: 5,
        critical: true,
      },
      {
        competency_id: "anxiety_assessment",
        label: "Anxiety assessment",
        weight: 1.2,
        max_score: 5,
      },
    ],
    enabled: true,
    version: 1,
  },
];

export function findTemplateBySlug(
  slug: string,
): ClinicalScenarioTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.slug === slug && t.enabled);
}

export function findTemplateById(
  id: string,
): ClinicalScenarioTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id && t.enabled);
}

export function listBuiltinTemplates(): ClinicalScenarioTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.enabled);
}
