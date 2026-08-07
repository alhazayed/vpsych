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
    min_age: 10,
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
          description:
            "Unwanted memories, flashes, or nightmares that pull you back — not ordinary worry loops",
          domain: "trauma",
          salience: "hidden",
        },
        {
          id: "avoidance",
          description:
            "Steers clear of places, people, or talk that might open the memory",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "hyperarousal",
          description:
            "Jumpy, on edge, startles easily; sleep light; scans for threat",
          domain: "anxiety",
          salience: "elicited",
        },
        {
          id: "negative_mood_cognition",
          description:
            "Guilt, shame, or 'I should have stopped it' — mood darker near reminders",
          domain: "mood",
          salience: "elicited",
        },
        {
          id: "numbing",
          description:
            "Feels cut off or flat with people sometimes — not only tearful sadness",
          domain: "mood",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        {
          topic: "trauma narrative details",
          condition: "on_empathic_rapport",
          notes:
            "Never flood; titrate. First answers stay vague ('something bad happened'); specifics only after alliance feels safe.",
        },
        {
          topic: "nightmares/intrusions",
          condition: "on_direct_question",
          notes: "May minimize at first ('just bad dreams') then add sensory fragments.",
        },
        {
          topic: "passive SI",
          condition: "on_safety_assessment",
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
          description:
            "Mind drifts mid-task and mid-conversation; hard to hold a thread without effort",
          domain: "cognition",
          salience: "presenting",
        },
        {
          id: "forgetfulness",
          description:
            "Loses keys, deadlines, half-finished chores — not 'don't care', just slips",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "disorganization",
          description:
            "Plans collapse into piles; starts strong then scatters",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "restlessness_inner",
          description:
            "Inner restlessness or fidget even when sitting still; boredom hits fast",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "working_memory",
          description:
            "Asks people to repeat; loses the question halfway through answering",
          domain: "cognition",
          salience: "presenting",
        },
      ],
      disclosure_rules: [
        {
          topic: "childhood school difficulties",
          condition: "on_direct_question",
          notes: "May joke first ('I was the class clown / daydreamer') then give concrete failures.",
        },
        {
          topic: "work/academic impairment",
          condition: "volunteered",
          notes: "Often leads with recent mess-ups before developmental history.",
        },
        {
          topic: "stimulant/medication history",
          condition: "on_direct_question",
        },
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
          description:
            "Drinks more or longer than intended; control feels slippery some nights",
          domain: "behavioral",
          salience: "hidden",
        },
        {
          id: "craving_or_preoccupation",
          description:
            "Thinks about the next drink or plans evenings around alcohol",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "role_interference",
          description:
            "Work, family, or mornings suffer after drinking — may minimize at first",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "tolerance_withdrawal_hints",
          description:
            "Needs more to get the same effect; shaky/irritable if cut back abruptly",
          domain: "somatic",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        {
          topic: "quantity/frequency of alcohol",
          condition: "on_direct_question",
          notes:
            "Non-judgemental stance required. First answer often undercounts; may correct awkwardly later.",
        },
        {
          topic: "consequences of drinking",
          condition: "on_empathic_rapport",
          notes: "Ambivalence: defend use then admit a cost in the same breath.",
        },
        {
          topic: "attempts to cut down",
          condition: "on_direct_question",
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
          description:
            "Sudden surges of terror with pounding heart, breathlessness, dizziness — peaks fast",
          domain: "anxiety",
          salience: "presenting",
        },
        {
          id: "fear_of_recurrence",
          description:
            "Afraid of the next attack; monitors body for early warning signs",
          domain: "anxiety",
          salience: "presenting",
        },
        {
          id: "avoidance",
          description:
            "Avoids places/situations where escape or help felt hard (transit, crowds, alone)",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "catastrophic_misinterpretation",
          description:
            "In the moment fears dying, losing control, or 'going crazy' — not calm insight",
          domain: "cognition",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "panic attack details",
          condition: "on_direct_question",
          notes: "Stay sensory and scared; do not recite a symptom checklist.",
        },
        {
          topic: "avoidance pattern",
          condition: "on_empathic_rapport",
          notes: "May first offer practical excuses before naming fear.",
        },
        {
          topic: "reassurance seeking",
          condition: "volunteered",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.bpd,
    slug: "bpd",
    name: "Borderline Personality Disorder",
    dsm5_code: "301.83",
    icd10_code: "F60.3",
    // ICD-11 personality disorder severity + borderline pattern (dual code)
    icd11_code: "6D10.1/6D11.5",
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
          description:
            "Mood swings hard and fast — warm then raw within minutes, not a steady low mood",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "abandonment_sensitivity",
          description:
            "Terrified of being left or ignored; reads distance into small delays",
          domain: "social",
          salience: "elicited",
        },
        {
          id: "identity_disturbance",
          description:
            "Unsure who they are across roles; values/self-image shift with relationships",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "unstable_relationships",
          description:
            "Idealizes then devalues people close to them; 'all good / all bad' language",
          domain: "social",
          salience: "elicited",
        },
        {
          id: "impulsivity_self_harm_risk",
          description:
            "Impulsive acts when flooded; self-harm thoughts or history may exist",
          domain: "behavioral",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        {
          topic: "self-harm",
          condition: "on_safety_assessment",
          notes: "Do not dump graphic detail unprompted; respond honestly to careful safety asks.",
        },
        {
          topic: "relationship ruptures",
          condition: "on_empathic_rapport",
          notes: "May swing between blaming other and blaming self in one story.",
        },
        {
          topic: "identity confusion",
          condition: "on_direct_question",
        },
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
    id: DISORDER_IDS.ocd,
    slug: "ocd",
    name: "Obsessive-Compulsive Disorder",
    dsm5_code: "300.3",
    icd10_code: "F42.2",
    icd11_code: "6B20",
    category: "ocd",
    min_age: 12,
    max_age: 80,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      symptom_domains: ["anxiety", "cognition", "behavioral", "social"],
      risk_defaults: {
        suicidal_ideation: "none",
        self_harm: false,
        harm_to_others: false,
      },
      differentials: ["GAD", "Psychosis (harm obsessions vs delusions)", "OCPD"],
      rule_outs: ["Active intent to harm (obsessions are ego-dystonic)"],
      teaching_points: [
        "Do not become a reassurance ritual",
        "Harm obsessions ≠ dangerousness when ego-dystonic",
        "Map time cost of rituals concretely",
      ],
      common_therapist_mistakes: [
        "Reassuring obsession content",
        "Alarm reaction to harm obsessions",
      ],
      session_goals: [
        "Map obsessions and compulsions",
        "Assess insight and family accommodation",
        "Orient to ERP without flooding",
      ],
      ideal_approach:
        "CBT/ERP-informed assessment. Empathise with suffering; do not reassure content.",
      symptom_profile: [
        {
          id: "obsessions",
          description: "Intrusive ego-dystonic thoughts, images, or urges",
          domain: "cognition",
          salience: "presenting",
        },
        {
          id: "compulsions",
          description: "Repetitive behaviours or mental acts aimed at reducing distress",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "avoidance",
          description: "Avoidance of triggers that provoke obsessions",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "reassurance",
          description: "Repeated reassurance seeking from others",
          domain: "social",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "contamination or checking", condition: "volunteered" },
        {
          topic: "harm or taboo obsessions",
          condition: "on_empathic_rapport",
          notes: "Highest shame; needs calm non-alarmed framing.",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.eating,
    slug: "eating-disorders",
    name: "Anorexia Nervosa / Eating Disorder spectrum",
    dsm5_code: "307.1",
    icd10_code: "F50.01",
    icd11_code: "6B80",
    category: "eating",
    min_age: 13,
    max_age: 65,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      symptom_domains: ["appetite", "cognition", "somatic", "behavioral", "mood"],
      risk_defaults: {
        suicidal_ideation: "passive",
        self_harm: false,
        harm_to_others: false,
      },
      differentials: ["MDD with appetite loss", "Medical illness", "OCD"],
      teaching_points: [
        "Never compliment thinness or discipline",
        "Medical risk screening is care, not punishment",
        "High function can mask severity",
      ],
      common_therapist_mistakes: [
        "Praising willpower/weight loss",
        "Only talking food numbers without fear/control themes",
      ],
      session_goals: [
        "Screen restriction/purge/exercise",
        "Assess medical red flags",
        "Map body image and control cognitions",
      ],
      ideal_approach:
        "Warm, clear, non-colluding. Curious about control and fear. Never praise thinness.",
      symptom_profile: [
        {
          id: "restriction",
          description: "Marked dietary restriction with rules around food",
          domain: "appetite",
          salience: "hidden",
        },
        {
          id: "weight_fear",
          description: "Intense fear of weight gain",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "body_image",
          description: "Distorted or harshly negative body evaluation",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "compulsive_exercise",
          description: "Driven exercise despite injury or exhaustion",
          domain: "behavioral",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        { topic: "anxiety and perfectionism", condition: "volunteered" },
        {
          topic: "calorie rules and weighing",
          condition: "on_empathic_rapport",
        },
      ],
    },
  },
  {
    id: DISORDER_IDS.socialAnxiety,
    slug: "social-anxiety",
    name: "Social Anxiety Disorder (Social Phobia)",
    dsm5_code: "300.23",
    icd10_code: "F40.10",
    icd11_code: "6B04",
    category: "anxiety",
    min_age: 12,
    max_age: 70,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      symptom_domains: ["anxiety", "somatic", "behavioral", "social", "cognition"],
      risk_defaults: {
        suicidal_ideation: "none",
        self_harm: false,
        harm_to_others: false,
      },
      differentials: ["Shyness", "ASD", "Panic disorder", "MDD"],
      teaching_points: [
        "Adolescent confidentiality framing matters",
        "Map safety behaviours and avoided situations",
        "Graded exposure — do not force full performance day one",
      ],
      common_therapist_mistakes: [
        "Allying only with parents against the teen",
        "Pushing immediate full exposure",
      ],
      session_goals: [
        "Map feared social situations",
        "Identify safety behaviours",
        "Screen depression comorbidity",
      ],
      ideal_approach:
        "Collaborative CBT for social anxiety; validate fear; graded hierarchy.",
      symptom_profile: [
        {
          id: "fear_scrutiny",
          description: "Intense fear of negative evaluation in social/performance situations",
          domain: "anxiety",
          salience: "presenting",
        },
        {
          id: "avoidance",
          description: "Avoidance of presentations, groups, or eating in public",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "somatic_anxiety",
          description: "Blushing, trembling, sweating in feared situations",
          domain: "somatic",
          salience: "elicited",
        },
        {
          id: "safety_behaviours",
          description: "Rehearsal, camouflage, or over-preparation to prevent embarrassment",
          domain: "behavioral",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "fear of presentations or being watched", condition: "volunteered" },
        {
          topic: "somatic symptoms and safety behaviours",
          condition: "on_direct_question",
        },
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
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive" },
      differentials: ["MDD", "Cyclothymia", "Personality-related chronic dysphoria"],
      teaching_points: [
        "Chronicity ≥2 years is the key teaching point",
        "Double depression may overlay acute MDD episodes",
      ],
      session_goals: [
        "Establish chronicity vs discrete episodes",
        "Assess functioning and identity fusion with low mood",
        "Screen SI carefully",
      ],
      ideal_approach:
        "Collaborative; validate chronic suffering without fatalism; map maintenance cycles.",
      symptom_profile: [
        {
          id: "chronic_low_mood",
          description: "Low mood more days than not for years",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "low_energy",
          description: "Persistent fatigue and reduced drive",
          domain: "somatic",
          salience: "elicited",
        },
        {
          id: "self_criticism",
          description: "Longstanding negative self-view",
          domain: "cognition",
          salience: "elicited",
        },
        {
          id: "anhedonia_partial",
          description: "Pleasure blunted more than absent",
          domain: "mood",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        { topic: "I've always been this way", condition: "volunteered" },
        { topic: "passive SI", condition: "on_safety_assessment" },
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
    min_age: 12,
    max_age: 70,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "none" },
      differentials: ["Social anxiety", "ADHD", "Schizoid personality"],
      teaching_points: [
        "Sensory and social communication differences are lifelong",
        "Do not pathologize stimming or special interests",
        "Alexithymia may look like flat affect",
      ],
      session_goals: [
        "Map social communication differences",
        "Assess sensory load and masking fatigue",
        "Screen mood/anxiety comorbidity",
      ],
      ideal_approach:
        "Concrete, predictable, low sensory overwhelm; collaborative and respectful of neurodiversity.",
      symptom_profile: [
        {
          id: "social_communication",
          description: "Lifelong differences in social reciprocity and nonverbal communication",
          domain: "social",
          salience: "elicited",
        },
        {
          id: "restricted_interests",
          description: "Intense focused interests and preference for sameness",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "sensory",
          description: "Sensory hyper- or hypo-reactivity",
          domain: "somatic",
          salience: "hidden",
        },
        {
          id: "masking_fatigue",
          description: "Exhaustion from camouflaging in social settings",
          domain: "mood",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        { topic: "feeling different since childhood", condition: "volunteered" },
        { topic: "sensory overwhelm and masking", condition: "on_empathic_rapport" },
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
    max_age: 70,
    allowed_genders: ALL_GENDERS,
    is_active: true,
    package: {
      severity_default: "moderate",
      risk_defaults: { suicidal_ideation: "passive" },
      differentials: ["Schizophrenia", "Bipolar with psychotic features", "MDD with psychotic features"],
      teaching_points: [
        "Require mood episode concurrent with psychosis PLUS psychosis without major mood for ≥2 weeks",
        "Do not collapse into 'just bipolar' or 'just schizophrenia' without timeline",
      ],
      session_goals: [
        "Map psychosis and mood timelines carefully",
        "Assess adherence and risk",
        "Engage without debating delusions",
      ],
      ideal_approach:
        "Curious, slow, dignified; timeline reconstruction; collaborative adherence talk.",
      symptom_profile: [
        {
          id: "psychosis",
          description: "Delusions or hallucinations during and outside mood episodes",
          domain: "psychotic",
          salience: "elicited",
        },
        {
          id: "mood_episodes",
          description: "Major mood episodes (depressive and/or manic) concurrent with psychosis",
          domain: "mood",
          salience: "presenting",
        },
        {
          id: "negative_symptoms",
          description: "Reduced motivation or affective expression between episodes",
          domain: "behavioral",
          salience: "elicited",
        },
        {
          id: "adherence",
          description: "Variable medication adherence when mood lifts",
          domain: "behavioral",
          salience: "hidden",
        },
      ],
      disclosure_rules: [
        { topic: "mood swings and hospital history", condition: "volunteered" },
        { topic: "voices or unusual beliefs", condition: "on_empathic_rapport" },
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
          description:
            "Attention comes and goes within minutes — lucid then lost mid-sentence",
          domain: "cognition",
          salience: "presenting",
        },
        {
          id: "disorientation",
          description:
            "Confused about time, place, or who is in the room; may reverse answers later",
          domain: "cognition",
          salience: "presenting",
        },
        {
          id: "perceptual_disturbance",
          description:
            "Misperceives shadows, voices, or people — acute confusion, not chronic psychosis story",
          domain: "psychotic",
          salience: "elicited",
        },
        {
          id: "sleep_wake_disruption",
          description:
            "Day-night flipped or drifting; drowsy then suddenly agitated",
          domain: "somatic",
          salience: "elicited",
        },
      ],
      disclosure_rules: [
        {
          topic: "orientation",
          condition: "volunteered",
          notes: "May volunteer wrong place/date confidently; correct inconsistently.",
        },
        {
          topic: "onset acuity",
          condition: "on_direct_question",
          notes: "Hours-to-days change — not months of depression.",
        },
        {
          topic: "hallucinatory misperceptions",
          condition: "on_empathic_rapport",
          notes: "Fragmented, fluctuating — not a fixed delusional system.",
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
    primary_disorder_id: DISORDER_IDS.gad,
    comorbid_disorder_id: DISORDER_IDS.aud,
    compatible: true,
    tier: "possible",
  },
  {
    primary_disorder_id: DISORDER_IDS.aud,
    comorbid_disorder_id: DISORDER_IDS.gad,
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
  ([modality, label], i) => {
    const base =
      modality === "cbt"
        ? {
            engages_with: ["structured questions", "thought records"],
            resists: ["premature confrontation"],
            response_biases: {
              trust_gate: true,
              homework_sensitivity: "medium" as const,
              advice_sensitivity: "medium" as const,
              exposure_readiness: "low" as const,
            },
          }
        : modality === "dbt"
          ? {
              engages_with: ["validation", "collaboration"],
              resists: ["change without validation", "premature confrontation"],
              response_biases: {
                validation_required: true,
                trust_gate: true,
                advice_sensitivity: "medium" as const,
              },
            }
          : modality === "motivational_interviewing"
            ? {
                engages_with: ["empathy", "collaboration", "evocation"],
                resists: ["advice-giving"],
                response_biases: {
                  advice_sensitivity: "high" as const,
                  trust_gate: true,
                },
              }
            : modality === "act"
              ? {
                  engages_with: ["values exploration", "defusion", "collaboration"],
                  resists: ["premature confrontation"],
                  response_biases: {
                    trust_gate: true,
                    advice_sensitivity: "low" as const,
                  },
                }
              : modality === "psychodynamic"
                ? {
                    engages_with: ["empathy", "exploration"],
                    resists: ["premature confrontation"],
                    response_biases: {
                      defence_on_interpretation: true,
                      advice_sensitivity: "medium" as const,
                    },
                  }
                : modality === "crisis_intervention"
                  ? {
                      engages_with: ["safety focus", "grounding"],
                      resists: ["premature confrontation"],
                      response_biases: {
                        trust_gate: false,
                        advice_sensitivity: "low" as const,
                        exposure_readiness: "none" as const,
                      },
                    }
                  : modality === "exposure_therapy"
                    ? {
                        engages_with: ["graded exposure", "collaboration"],
                        resists: ["forced flooding", "premature confrontation"],
                        response_biases: {
                          exposure_readiness: "moderate" as const,
                          trust_gate: true,
                          homework_sensitivity: "high" as const,
                        },
                      }
                    : {
                        engages_with: ["empathy", "collaboration"],
                        resists: ["premature confrontation"],
                        response_biases: {
                          trust_gate: true,
                          advice_sensitivity: "medium" as const,
                        },
                      };
    return {
      id: `c1000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      slug: modality,
      modality,
      label,
      is_active: true,
      patient_reaction_rules: {
        version: 1,
        modality,
        engages_with: base.engages_with,
        resists: base.resists,
        alliance_cue: `${label}: patient reacts to modality-congruent stance.`,
        response_biases: base.response_biases,
      },
    };
  },
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
