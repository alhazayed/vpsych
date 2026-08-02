/**
 * In-memory Case Engine catalog (mirrors migration seeds).
 * Used for offline generation, tests, and fallback when DB rows are unavailable.
 */

import type {
  CaseDifficulty,
  CaseEngineCatalog,
  ComorbidityRule,
  DifficultyProfile,
  DisorderRow,
  TherapyModality,
  TherapyProfile,
} from "@/lib/case-engine/types";

export const DISORDER_IDS = {
  mdd: "d1000000-0000-4000-8000-000000000001",
  gad: "d1000000-0000-4000-8000-000000000002",
  ptsd: "d1000000-0000-4000-8000-000000000003",
  adhd: "d1000000-0000-4000-8000-000000000004",
  aud: "d1000000-0000-4000-8000-000000000005",
} as const;

const ALL_GENDERS = ["female", "male", "non-binary", "unspecified"];

export const BUILTIN_DISORDERS: DisorderRow[] = [
  {
    id: DISORDER_IDS.mdd,
    slug: "mdd-recurrent-moderate",
    name: "Major Depressive Disorder, recurrent episode, moderate",
    dsm5_code: "296.32",
    icd10_code: "F33.1",
    icd11_code: "6A71.1",
    category: "mood",
    min_age: 14,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      symptom_domains: ["mood", "sleep", "appetite", "cognition", "somatic", "social"],
      risk_defaults: {
        suicidal_ideation: "passive",
        self_harm: false,
        harm_to_others: false,
      },
      differentials: [
        "Bipolar disorder",
        "Adjustment disorder with depressed mood",
        "Prolonged grief",
      ],
      rule_outs: ["Active mania/hypomania"],
      teaching_points: [
        "Screen bipolarity before antidepressant discussion",
        "Grief may be subthreshold but clinically central",
      ],
      common_therapist_mistakes: [
        "Premature behavioural activation before grief is heard",
      ],
      session_goals: [
        "Build alliance",
        "Assess mood/sleep/appetite/anhedonia",
        "Explore passive SI safely",
        "Identify 1–2 treatment targets",
      ],
      ideal_approach:
        "Warm, collaborative CBT/IPT-informed interview. Validate affect; check safety without interrogation.",
      symptom_profile: [
        {
          id: "low_mood",
          description: "Depressed mood most of the day, nearly every day",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "anhedonia",
          description: "Marked loss of interest and pleasure",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "sleep_disturbance",
          description: "Insomnia or hypersomnia",
          domain: "sleep",
          salience: "elicited",
        },
        {
          id: "concentration",
          description: "Impaired concentration and indecisiveness",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "passive_si",
          description: "Passive death wishes without plan or intent",
          domain: "mood",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        {
          topic: "low mood and fatigue",
          condition: "volunteered",
        },
        {
          topic: "passive suicidal ideation",
          condition: "on_safety_assessment",
          notes: "Discloses to calm, specific questioning; never volunteers.",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.gad,
    slug: "gad-with-panic",
    name: "Generalized Anxiety Disorder, with panic attacks",
    dsm5_code: "300.02",
    icd10_code: "F41.1",
    icd11_code: "6B00",
    category: "anxiety",
    min_age: 16,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      symptom_domains: ["anxiety", "sleep", "cognition", "somatic", "behavioral"],
      risk_defaults: {
        suicidal_ideation: "none",
        self_harm: false,
        harm_to_others: false,
      },
      differentials: ["Panic disorder", "Social anxiety", "OCD", "ADHD"],
      rule_outs: ["Medical causes of autonomic arousal"],
      teaching_points: [
        "Worry is multi-domain and hard to control",
        "Panic attacks may be situational or unexpected",
      ],
      common_therapist_mistakes: ["Reassurance-seeking loops"],
      session_goals: [
        "Map worry domains",
        "Assess panic phenomenology",
        "Identify safety behaviours",
      ],
      ideal_approach:
        "Collaborative CBT for GAD; gentle pacing; avoid premature exposure without alliance.",
      symptom_profile: [
        {
          id: "excessive_worry",
          description: "Excessive anxiety and worry about multiple domains",
          domain: "anxiety",
          salience: "presenting",
        },
        {
          id: "restlessness",
          description: "Feeling keyed up, on edge, or restless",
          domain: "anxiety",
          salience: "elicited",
        },
        {
          id: "sleep_onset",
          description: "Difficulty falling or staying asleep due to worry",
          domain: "sleep",
          salience: "elicited",
        },
        {
          id: "panic_spikes",
          description: "Sudden spikes of fear with autonomic arousal",
          domain: "anxiety",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        { topic: "work and money worry", condition: "volunteered" },
        {
          topic: "panic attack phenomenology",
          condition: "on_direct_question",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.ptsd,
    slug: "ptsd",
    name: "Posttraumatic Stress Disorder",
    dsm5_code: "309.81",
    icd10_code: "F43.10",
    icd11_code: "6B40",
    category: "trauma",
    min_age: 16,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive" },
      differentials: ["Acute stress disorder", "MDD", "Panic disorder"],
      session_goals: ["Establish safety", "Gently map trauma impact", "Assess SI"],
      ideal_approach:
        "Trauma-informed supportive/CBT hybrid; titration; no flooding.",
      symptom_profile: [
        {
          id: "intrusions",
          description: "Intrusive memories or nightmares related to trauma",
          domain: "trauma",
          salience: "hidden",
        },
        {
          id: "avoidance",
          description: "Avoidance of trauma reminders",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "hyperarousal",
          description: "Hypervigilance and exaggerated startle",
          domain: "anxiety",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "trauma narrative details",
          condition: "on_empathic_rapport",
          notes: "Never flood; titrate.",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.adhd,
    slug: "adult-adhd",
    name: "Attention-Deficit/Hyperactivity Disorder, predominantly inattentive, adult",
    dsm5_code: "314.00",
    icd10_code: "F90.0",
    icd11_code: "6A05.0",
    category: "neurodevelopmental",
    min_age: 17,
    max_age: 65,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      differentials: ["GAD", "MDD with concentration loss"],
      session_goals: [
        "Developmental history",
        "Map impairment domains",
        "Screen comorbidity",
      ],
      ideal_approach:
        "Structured, collaborative assessment; concrete examples; avoid moralising.",
      symptom_profile: [
        {
          id: "inattention",
          description: "Sustained attention and organisation impairment",
          domain: "cognition",
          salience: "presenting",
        },
        {
          id: "forgetfulness",
          description: "Forgetfulness in daily activities",
          domain: "cognition",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "childhood school difficulties", condition: "on_direct_question" },
      ],
    },
  },
  {
    id: DISORDER_IDS.aud,
    slug: "alcohol-use-disorder",
    name: "Alcohol Use Disorder",
    dsm5_code: "305.00",
    icd10_code: "F10.10",
    icd11_code: "6C40.1",
    category: "substance",
    min_age: 18,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "mild",
      risk_defaults: { suicidal_ideation: "none", substance_use: true },
      session_goals: ["Assess use pattern", "Explore ambivalence"],
      ideal_approach: "Motivational interviewing; curiosity over confrontation.",
      symptom_profile: [
        {
          id: "alcohol_use",
          description: "Problematic alcohol use with impaired control",
          domain: "behavioral",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        {
          topic: "quantity/frequency of alcohol",
          condition: "on_direct_question",
          notes: "Non-judgemental stance required.",
        },
      ],
    },
  },
];

export const BUILTIN_COMORBIDITY_RULES: ComorbidityRule[] = [
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.gad,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.gad,
    comorbid_disorder_id: DISORDER_IDS.mdd,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.ptsd,
    comorbid_disorder_id: DISORDER_IDS.mdd,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.ptsd,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.adhd,
    comorbid_disorder_id: DISORDER_IDS.gad,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.gad,
    comorbid_disorder_id: DISORDER_IDS.adhd,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.ptsd,
    comorbid_disorder_id: DISORDER_IDS.aud,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.aud,
    compatible: true,
  },
  {
    primary_disorder_id: DISORDER_IDS.adhd,
    comorbid_disorder_id: DISORDER_IDS.ptsd,
    compatible: false,
    notes: "Blocked as primary/comorbid pair for v1 generator",
  },
];

export const BUILTIN_DIFFICULTY_PROFILES: DifficultyProfile[] = [
  {
    id: "b1000000-0000-4000-8000-000000000001",
    slug: "beginner",
    level: "beginner",
    label: "Beginner",
    is_active: true,
    modifiers: {
      insight: "high",
      resistance: "low",
      disclosure: "high",
      diagnostic_ambiguity: "low",
      alliance: "warm",
      masking: "low",
      comorbidity_weight: 0,
    },
  },
  {
    id: "b1000000-0000-4000-8000-000000000002",
    slug: "intermediate",
    level: "intermediate",
    label: "Intermediate",
    is_active: true,
    modifiers: {
      insight: "moderate",
      resistance: "moderate",
      disclosure: "mixed",
      diagnostic_ambiguity: "moderate",
      alliance: "neutral",
      masking: "moderate",
      comorbidity_weight: 1,
    },
  },
  {
    id: "b1000000-0000-4000-8000-000000000003",
    slug: "advanced",
    level: "advanced",
    label: "Advanced",
    is_active: true,
    modifiers: {
      insight: "low",
      resistance: "high",
      disclosure: "guarded",
      diagnostic_ambiguity: "high",
      alliance: "fragile",
      masking: "high",
      comorbidity_weight: 1,
    },
  },
  {
    id: "b1000000-0000-4000-8000-000000000004",
    slug: "expert",
    level: "expert",
    label: "Expert",
    is_active: true,
    modifiers: {
      insight: "very_low",
      resistance: "very_high",
      disclosure: "minimal",
      diagnostic_ambiguity: "very_high",
      alliance: "testing",
      masking: "very_high",
      comorbidity_weight: 2,
    },
  },
];

const THERAPY_ENTRIES: Array<[TherapyModality, string]> = [
  ["cbt", "CBT"],
  ["dbt", "DBT"],
  ["act", "ACT"],
  ["psychodynamic", "Psychodynamic"],
  ["supportive", "Supportive"],
  ["motivational_interviewing", "Motivational Interviewing"],
  ["family_therapy", "Family Therapy"],
  ["crisis_intervention", "Crisis Intervention"],
];

export const BUILTIN_THERAPY_PROFILES: TherapyProfile[] = THERAPY_ENTRIES.map(
  ([modality, label], i) => ({
    id: `c1000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    slug: modality,
    modality,
    label,
    is_active: true,
    patient_reaction_rules: {
      engages_with:
        modality === "cbt"
          ? ["structured questions", "thought records"]
          : modality === "crisis_intervention"
            ? ["safety focus", "grounding"]
            : ["empathy", "collaboration"],
      resists:
        modality === "motivational_interviewing"
          ? ["advice-giving"]
          : ["premature confrontation"],
      alliance_cue: `${label}: patient reacts to modality-congruent stance.`,
    },
  }),
);

export function getBuiltinCatalog(): CaseEngineCatalog {
  return {
    disorders: BUILTIN_DISORDERS,
    comorbidityRules: BUILTIN_COMORBIDITY_RULES,
    difficultyProfiles: BUILTIN_DIFFICULTY_PROFILES,
    therapyProfiles: BUILTIN_THERAPY_PROFILES,
  };
}

export function findDisorderBySlug(
  slug: string,
  catalog: CaseEngineCatalog = getBuiltinCatalog(),
): DisorderRow | undefined {
  return catalog.disorders.find((d) => d.slug === slug && d.is_active);
}

export function findDifficulty(
  level: CaseDifficulty,
  catalog: CaseEngineCatalog = getBuiltinCatalog(),
): DifficultyProfile | undefined {
  return catalog.difficultyProfiles.find((d) => d.level === level && d.is_active);
}

export function findTherapy(
  modality: TherapyModality,
  catalog: CaseEngineCatalog = getBuiltinCatalog(),
): TherapyProfile | undefined {
  return catalog.therapyProfiles.find(
    (t) => t.modality === modality && t.is_active,
  );
}
