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
  pdd: "d1000000-0000-4000-8000-000000000006",
  panic: "d1000000-0000-4000-8000-000000000007",
  socialAnxiety: "d1000000-0000-4000-8000-000000000008",
  ocd: "d1000000-0000-4000-8000-000000000009",
  complexPtsd: "d1000000-0000-4000-8000-00000000000a",
  bpd: "d1000000-0000-4000-8000-00000000000b",
  asd: "d1000000-0000-4000-8000-00000000000c",
  schizophrenia: "d1000000-0000-4000-8000-00000000000d",
  schizoaffective: "d1000000-0000-4000-8000-00000000000e",
  bipolarMania: "d1000000-0000-4000-8000-00000000000f",
  eating: "d1000000-0000-4000-8000-000000000010",
  delirium: "d1000000-0000-4000-8000-000000000011",
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
  {
    id: DISORDER_IDS.panic,
    slug: "panic-disorder",
    name: "Panic Disorder",
    dsm5_code: "300.01",
    icd10_code: "F41.0",
    icd11_code: "6B01",
    category: "anxiety",
    min_age: 16,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      session_goals: ["Map panic phenomenology", "Identify avoidance"],
      ideal_approach: "CBT with interoceptive exposure readiness.",
      symptom_profile: [
        {
          id: "panic_attacks",
          description: "Recurrent unexpected panic attacks",
          domain: "anxiety",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        { topic: "panic attack details", condition: "on_direct_question" },
      ],
    },
  },
  {
    id: DISORDER_IDS.bpd,
    slug: "bpd",
    name: "Borderline Personality Disorder",
    dsm5_code: "301.83",
    icd10_code: "F60.3",
    // ICD-11: severity (6D10.1 moderate) + borderline pattern qualifier (6D11.5).
    icd11_code: "6D10.1/6D11.5",
    category: "personality",
    min_age: 18,
    max_age: 65,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive", self_harm: true },
      session_goals: [
        "Assess identity disturbance",
        "Safety plan",
        "Validate then structure",
      ],
      ideal_approach: "DBT-informed; validation before change.",
      symptom_profile: [
        {
          id: "affective_instability",
          description: "Marked affective instability",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "fear_abandonment",
          description: "Frantic efforts to avoid abandonment",
          domain: "social",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        { topic: "self-harm", condition: "on_safety_assessment" },
      ],
      teaching_points: [
        "ICD-11 requires severity (6D10.x) plus borderline pattern 6D11.5 when teaching BPD",
      ],
    },
  },
  {
    id: DISORDER_IDS.schizophrenia,
    slug: "schizophrenia",
    name: "Schizophrenia",
    dsm5_code: "295.90",
    icd10_code: "F20.9",
    icd11_code: "6A20",
    category: "psychotic",
    min_age: 16,
    max_age: 65,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive" },
      session_goals: ["Assess psychosis", "Risk", "Function"],
      ideal_approach: "Supportive; reality-testing without confrontation.",
      symptom_profile: [
        {
          id: "delusions",
          description: "Delusional beliefs",
          domain: "psychotic",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "voices/content", condition: "on_direct_question" },
      ],
    },
  },
  {
    id: DISORDER_IDS.bipolarMania,
    slug: "bipolar-mania",
    name: "Bipolar I Disorder, current manic episode",
    dsm5_code: "296.44",
    icd10_code: "F31.2",
    // Align ICD-11 with DSM-5/ICD-10 psychotic features (6A60.1 = without psychosis).
    icd11_code: "6A60.2",
    category: "mood",
    min_age: 16,
    max_age: 70,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "severe",
      risk_defaults: {
        suicidal_ideation: "none",
        harm_to_others: false,
      },
      session_goals: ["Assess mania", "Risk to self/others", "Sleep"],
      ideal_approach: "Containment; brief questions; safety first.",
      symptom_profile: [
        {
          id: "elevated_mood",
          description: "Elevated/irritable mood with increased energy",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "decreased_sleep_need",
          description: "Decreased need for sleep",
          domain: "sleep",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "spending/impulsivity", condition: "on_direct_question" },
      ],
      teaching_points: [
        "296.44 / F31.2 / 6A60.2 = manic episode with psychotic features",
      ],
    },
  },
  {
    id: DISORDER_IDS.pdd,
    slug: "pdd",
    name: "Persistent Depressive Disorder (Dysthymia)",
    dsm5_code: "300.4",
    icd10_code: "F34.1",
    icd11_code: "6A72",
    category: "mood",
    min_age: 14,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "mild",
      risk_defaults: { suicidal_ideation: "none" },
      differentials: ["MDD", "Cyclothymia", "Personality-related chronic dysphoria"],
      session_goals: ["Map chronic course", "Differentiate from MDD episode"],
      ideal_approach: "Supportive CBT; validate chronicity.",
      symptom_profile: [
        {
          id: "chronic_low_mood",
          description: "Depressed mood for most of the day for ≥2 years",
          domain: "mood",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        { topic: "chronic low mood", condition: "volunteered" },
      ],
      teaching_points: [
        "ICD-11 dysthymic disorder is 6A72 (not 6A71.x single-episode MDD)",
      ],
    },
  },
  {
    id: DISORDER_IDS.socialAnxiety,
    slug: "social-anxiety",
    name: "Social Anxiety Disorder",
    dsm5_code: "300.23",
    icd10_code: "F40.10",
    icd11_code: "6B04",
    category: "anxiety",
    min_age: 12,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      session_goals: ["Map feared situations", "Assess avoidance"],
      ideal_approach: "Collaborative CBT; graded exposure framing.",
      symptom_profile: [
        {
          id: "social_fear",
          description: "Fear of negative evaluation in social situations",
          domain: "anxiety",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        { topic: "social avoidance", condition: "on_empathic_rapport" },
      ],
    },
  },
  {
    id: DISORDER_IDS.ocd,
    slug: "ocd",
    name: "Obsessive-Compulsive Disorder",
    dsm5_code: "300.3",
    icd10_code: "F42",
    icd11_code: "6B20",
    category: "obsessive-compulsive",
    min_age: 10,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      differentials: ["GAD", "OCPD", "Body dysmorphic disorder"],
      session_goals: ["Map obsessions/compulsions", "Assess insight"],
      ideal_approach: "ERP-informed assessment; avoid reassurance loops.",
      symptom_profile: [
        {
          id: "obsessions",
          description: "Intrusive unwanted thoughts",
          domain: "cognition",
          salience: "hidden",
        },
        {
          id: "compulsions",
          description: "Repetitive behaviours to reduce distress",
          domain: "behavioral",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "content of obsessions",
          condition: "on_empathic_rapport",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.complexPtsd,
    slug: "complex-ptsd",
    name: "Complex PTSD",
    // CPTSD is an ICD-11 construct (6B41); DSM-5-TR has no equivalent code.
    dsm5_code: null,
    icd10_code: null,
    icd11_code: "6B41",
    category: "trauma",
    min_age: 16,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "severe",
      dsm5_optional: true,
      risk_defaults: { suicidal_ideation: "passive" },
      differentials: ["PTSD", "BPD", "MDD"],
      rule_outs: ["Do not code as DSM-5 PTSD 309.81 alone for CPTSD teaching cases"],
      session_goals: ["Safety first", "Map affect dysregulation"],
      ideal_approach: "Trauma-informed; phase-based; no flooding.",
      symptom_profile: [
        {
          id: "affect_dysregulation",
          description: "Persistent affect dysregulation",
          domain: "mood",
          salience: "elicited",
        },
        {
          id: "negative_self",
          description: "Persistent negative self-concept",
          domain: "cognition",
          salience: "hidden",
        },
        {
          id: "relationship_disturbance",
          description: "Persistent difficulties in sustaining relationships",
          domain: "social",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "trauma narrative", condition: "on_empathic_rapport" },
      ],
      teaching_points: [
        "ICD-11 6B41 requires PTSD core + DSO (affect, self, relationships)",
        "No DSM-5 code — do not substitute 309.81 without noting limitation",
      ],
    },
  },
  {
    id: DISORDER_IDS.asd,
    slug: "asd",
    name: "Autism Spectrum Disorder",
    dsm5_code: "299.00",
    icd10_code: "F84.0",
    icd11_code: "6A02",
    category: "neurodevelopmental",
    min_age: 5,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      differentials: ["Social anxiety", "ADHD", "Intellectual disability"],
      session_goals: ["Developmental history", "Sensory/social profile"],
      ideal_approach: "Concrete language; reduce figurative overload.",
      symptom_profile: [
        {
          id: "social_communication",
          description: "Social communication differences",
          domain: "social",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        { topic: "sensory overload", condition: "on_direct_question" },
      ],
    },
  },
  {
    id: DISORDER_IDS.schizoaffective,
    slug: "schizoaffective",
    name: "Schizoaffective Disorder",
    dsm5_code: "295.70",
    icd10_code: "F25.9",
    icd11_code: "6A21",
    category: "psychotic",
    min_age: 16,
    max_age: 65,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive" },
      session_goals: ["Map mood vs psychosis timeline", "Risk"],
      ideal_approach: "Supportive structured assessment.",
      symptom_profile: [
        {
          id: "mood_episode_with_psychosis",
          description: "Major mood episode concurrent with psychotic symptoms",
          domain: "mood",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        { topic: "mood episode timing", condition: "on_direct_question" },
      ],
    },
  },
  {
    id: DISORDER_IDS.eating,
    slug: "eating-disorders",
    name: "Anorexia Nervosa",
    dsm5_code: "307.1",
    icd10_code: "F50.0",
    icd11_code: "6B80",
    category: "eating",
    min_age: 12,
    max_age: 60,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      differentials: ["Bulimia nervosa", "ARFID", "Medical hyperthyroidism"],
      session_goals: ["Medical safety screen", "Map eating behaviours"],
      ideal_approach: "Non-collusive; collaborative; medical risk aware.",
      symptom_profile: [
        {
          id: "restriction",
          description: "Energy intake restriction with body image disturbance",
          domain: "somatic",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        {
          topic: "weight/shape concerns",
          condition: "on_empathic_rapport",
        },
      ],
      teaching_points: [
        "Codes are AN-specific (307.1 / F50.0 / 6B80); not a full ED spectrum",
      ],
    },
  },
  {
    id: DISORDER_IDS.delirium,
    slug: "delirium",
    name: "Delirium",
    dsm5_code: "293.0",
    icd10_code: "F05",
    icd11_code: "6D70",
    category: "medical",
    min_age: 18,
    max_age: 120,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "severe",
      risk_defaults: { suicidal_ideation: "none" },
      session_goals: ["Medical workup framing", "Fluctuating cognition"],
      ideal_approach: "Medical simulation only when template allows.",
      symptom_profile: [
        {
          id: "fluctuating_attention",
          description: "Acute fluctuating disturbance of attention",
          domain: "cognition",
          salience: "presenting",
        },
      ],
      disclosure_rules: [{ topic: "orientation", condition: "volunteered" }],
    },
  },
];

export const BUILTIN_COMORBIDITY_RULES: ComorbidityRule[] = [
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.gad,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.gad,
    comorbid_disorder_id: DISORDER_IDS.mdd,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.ptsd,
    comorbid_disorder_id: DISORDER_IDS.mdd,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.ptsd,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.adhd,
    comorbid_disorder_id: DISORDER_IDS.gad,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.gad,
    comorbid_disorder_id: DISORDER_IDS.adhd,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.ptsd,
    comorbid_disorder_id: DISORDER_IDS.aud,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.aud,
    compatible: true,
    tier: "possible",
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.panic,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.bpd,
    compatible: true,
    tier: "possible",
  },
  {
    primary_disorder_id: DISORDER_IDS.mdd,
    comorbid_disorder_id: DISORDER_IDS.bipolarMania,
    compatible: false,
    tier: "impossible",
    notes: "MDD × Bipolar mania — reject unless bipolar primary",
  },
  {
    primary_disorder_id: DISORDER_IDS.schizophrenia,
    comorbid_disorder_id: DISORDER_IDS.gad,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.schizophrenia,
    comorbid_disorder_id: DISORDER_IDS.delirium,
    compatible: false,
    tier: "impossible",
    notes: "Schizophrenia × Delirium — medical simulation templates only",
  },
  {
    primary_disorder_id: DISORDER_IDS.bpd,
    comorbid_disorder_id: DISORDER_IDS.mdd,
    compatible: true,
    tier: "compatible",
  },
  {
    primary_disorder_id: DISORDER_IDS.adhd,
    comorbid_disorder_id: DISORDER_IDS.ptsd,
    compatible: false,
    tier: "impossible",
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
  ["exposure_therapy", "Exposure Therapy"],
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
