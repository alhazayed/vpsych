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
    icd11_code: "6D10.0",
    category: "personality",
    min_age: 18,
    max_age: 65,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive", self_harm: true },
      session_goals: ["Assess identity disturbance", "Safety plan"],
      ideal_approach: "DBT-informed; validation before change.",
      symptom_profile: [
        {
          id: "affective_instability",
          description: "Marked affective instability",
          domain: "mood",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        { topic: "self-harm", condition: "on_safety_assessment" },
      ],
    },
  },
  {
    id: DISORDER_IDS.complexPtsd,
    slug: "complex-ptsd",
    name: "Complex PTSD",
    // ICD-11-only construct (6B41); no DSM-5 equivalent code.
    dsm5_code: null,
    icd10_code: null,
    icd11_code: "6B41",
    category: "trauma",
    min_age: 16,
    max_age: 90,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive", self_harm: true },
      differentials: ["PTSD", "BPD", "MDD"],
      session_goals: [
        "Map prolonged trauma impact",
        "Affect regulation",
        "Assess SI/self-harm",
      ],
      ideal_approach:
        "Trauma-informed; titrate; validate chronic interpersonal threat without flooding.",
      symptom_profile: [
        {
          id: "reexperiencing",
          description:
            "Intrusive memories or nightmares tied to prolonged trauma — not ordinary worry",
          domain: "trauma",
          salience: "elicited",
        },
        {
          id: "avoidance",
          description: "Avoids people/places that feel like the old danger",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "sense_of_threat",
          description: "Persistent sense of being unsafe or on guard with others",
          domain: "anxiety",
          salience: "presenting",
        },
        {
          id: "affect_dysregulation",
          description: "Emotions swing hard or go numb when reminded of the past",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "negative_self",
          description: "Deep belief of being damaged, worthless, or permanently different",
          domain: "cognition",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "trauma narrative details",
          condition: "on_empathic_rapport",
          notes: "Never flood; titrate. CPTSD is prolonged/repeated trauma.",
        },
        {
          topic: "self-harm",
          condition: "on_safety_assessment",
        },
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
      risk_defaults: {
        suicidal_ideation: "passive",
        harm_to_others: false,
      },
      differentials: ["Schizoaffective", "Bipolar with psychosis", "Substance-induced psychosis"],
      session_goals: [
        "Assess positive symptoms without confrontation",
        "Map negative symptoms and function",
        "Safety / insight",
      ],
      ideal_approach:
        "Supportive; curious reality-testing without arguing delusions; short clear questions.",
      // Patient-language Module 1 content (DSM-5 Criterion A domains). Variability
      // across sessions comes from salience + disclosure — not identical scripts.
      symptom_profile: [
        {
          id: "delusions",
          description:
            "Fixed unusual beliefs (e.g. being watched, messages meant for them) that feel real and hard to shake — not ordinary sadness or low mood",
          domain: "psychotic",
          salience: "presenting",
        },
        {
          id: "hallucinations",
          description:
            "Hearing voices or noises others do not hear; may deny or minimize until asked carefully",
          domain: "psychotic",
          salience: "elicited",
        },
        {
          id: "disorganization",
          description:
            "Speech can drift, answers go sideways, or thoughts feel jumbled mid-sentence",
          domain: "cognition",
          salience: "presenting",
        },
        {
          id: "negative_symptoms",
          description:
            "Flat or restricted affect, reduced drive, social withdrawal — negative symptoms of psychosis (not a classic depressive episode narrative)",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "functional_decline",
          description:
            "Work/school/self-care slipped because concentration and reality feel unreliable",
          domain: "behavioral",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "voices/content",
          condition: "on_direct_question",
          notes: "Progressive disclosure; do not dump textbook command hallucinations unprompted.",
        },
        {
          topic: "delusional conviction",
          condition: "on_empathic_rapport",
          notes: "Defend belief if challenged; do not suddenly accept therapist's reality-testing.",
        },
        {
          topic: "passive SI",
          condition: "on_safety_assessment",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.bipolarMania,
    slug: "bipolar-mania",
    name: "Bipolar I Disorder, current manic episode",
    dsm5_code: "296.44",
    icd10_code: "F31.2",
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
        substance_use: true,
      },
      differentials: ["Hypomania", "ADHD", "Substance intoxication", "Schizophrenia"],
      session_goals: [
        "Assess manic episode criteria",
        "Sleep need and energy",
        "Impulsivity / judgement / safety",
      ],
      ideal_approach:
        "Containment; brief questions; do not mirror pressured pace; safety and sleep first.",
      // DSM-5 manic episode Criterion A/B — patient language for Module 1.
      symptom_profile: [
        {
          id: "elevated_mood",
          description:
            "Mood is elevated, expansive, OR sharply irritable — feels wired/on fire, NOT grey, foggy, or heavy-depressed",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "increased_energy",
          description:
            "Markedly increased energy and goal-directed activity despite little sleep",
          domain: "behavioral",
          salience: "presenting",
        },
        {
          id: "decreased_sleep_need",
          description:
            "Sleeping only a few hours and waking energized — decreased need for sleep, not sleeping more",
          domain: "somatic",
          salience: "presenting",
        },
        {
          id: "pressured_speech",
          description:
            "Talks fast, hard to interrupt, jumps topics; speech feels pushed out",
          domain: "behavioral",
          salience: "presenting",
        },
        {
          id: "flight_of_ideas",
          description:
            "Thoughts race; ideas feel brilliant and urgent; distractible mid-sentence",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "grandiosity",
          description:
            "Inflated confidence or special plans that feel obvious — may resist challenge",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "impulsivity",
          description:
            "Risky spending, sudden trips, or impulsive decisions — judgement impaired",
          domain: "behavioral",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "spending/impulsivity",
          condition: "on_direct_question",
          notes: "May minimize consequences or justify as 'finally living'.",
        },
        {
          topic: "decreased sleep need",
          condition: "volunteered",
          notes: "Should endorse reduced sleep need when asked; never claim depressive hypersomnia.",
        },
        {
          topic: "substance use in episode",
          condition: "on_direct_question",
        },
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
