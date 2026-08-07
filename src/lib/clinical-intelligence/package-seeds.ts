/**
 * Disorder package seeds for formulation / protectives / MSE (Stage 6).
 * Educational only — never DSM criterion dumps into patient voice.
 */

import type {
  DefenseMechanism,
  InsightBand,
  PatientFormulation,
  ProtectiveFactor,
} from "@/lib/clinical-intelligence/types";
import { FORMULATION_VERSION } from "@/lib/clinical-intelligence/types";

export type FormulationSeed = {
  disorder_slugs: string[];
  formulation: Omit<PatientFormulation, "version"> & { version?: 1 };
  protective_factors: ProtectiveFactor[];
  insight_band: InsightBand;
  mse_defaults: {
    mood?: string;
    affect?: string;
    speech?: string;
    thought_process?: string;
    thought_content?: string;
    perception?: string;
    judgement?: string;
    cognition?: string;
    appearance?: string;
    behavior?: string;
    risk_summary?: string;
  };
  pattern_tags: string[];
  dissociation_bias?: "none" | "mild_detachment" | "marked";
};

function belief(
  id: string,
  statement: string,
  domain: "self" | "others" | "world" | "future",
  strength: number,
  salience: "presenting" | "elicited" | "hidden" = "presenting",
) {
  return {
    id,
    statement,
    domain,
    strength,
    salience,
    source: "package_seed" as const,
  };
}

function protective(
  id: string,
  label: string,
  category: ProtectiveFactor["category"],
  strength: number,
  narrative?: string,
): ProtectiveFactor {
  return { id, label, category, strength, narrative };
}

const MDD: FormulationSeed = {
  disorder_slugs: ["mdd-recurrent-moderate", "mdd", "major-depressive-disorder"],
  insight_band: "partial",
  pattern_tags: ["withdrawal", "minimization", "catastrophizing", "anhedonia"],
  protective_factors: [
    protective("pf-family", "Family contact", "family", 55, "At least one relative checks in"),
    protective("pf-employment", "Employment / role", "employment", 45),
    protective("pf-hope", "Residual hope", "hope", 35, "Faint hope that things could improve"),
    protective("pf-treatment", "Willingness to attend", "treatment", 50),
  ],
  mse_defaults: {
    appearance: "care may be reduced; posture slumped",
    behavior: "psychomotor slowing or agitation possible",
    speech: "soft, sparse, latency before answers",
    mood: "depressed, empty, or irritable",
    affect: "constricted; tearfulness when shame rises",
    thought_process: "generally linear; may be slowed",
    thought_content: "themes of worthlessness, guilt; no fixed delusions by default",
    perception: "no perceptual disturbance by default",
    judgement: "largely preserved for daily logistics; safety needs assessment",
    cognition: "concentration and memory complaints common",
    risk_summary: "screen passive SI; protective factors may attenuate acute risk",
  },
  formulation: {
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: [
        belief("b-worthless", "I am worthless / a burden", "self", 75),
        belief("b-hopeless", "Nothing will get better", "future", 70),
        belief("b-reject", "People will reject me if they see the real me", "others", 65, "elicited"),
      ],
    },
    values: [
      { id: "v-family", label: "Family connection", weight: 70 },
      { id: "v-competence", label: "Being useful / competent", weight: 60 },
    ],
    schemas: [
      {
        id: "sch-burden",
        if_condition: "If I ask for help",
        then_pattern: "then I am weak and burdensome",
        linked_belief_ids: ["b-worthless"],
        defence_bias: "minimization",
        coping_bias: "withdrawal",
      },
    ],
    distortions: [
      {
        id: "d-cat",
        distortion_kind: "catastrophizing",
        example_thought: "This will never end",
        activation_topics: ["future", "work", "mood"],
        salience: "presenting",
      },
      {
        id: "d-mind",
        distortion_kind: "mind_reading",
        example_thought: "They think I'm useless",
        activation_topics: ["relationship", "shame"],
        salience: "elicited",
      },
    ],
    automatic_thoughts_seed: [
      {
        id: "at-burden",
        content: "I'm just wasting their time",
        trigger_topics: ["therapy", "shame", "relationship"],
        linked_belief_id: "b-worthless",
        linked_distortion_ids: ["d-mind"],
        hotness: 70,
        disclosed: false,
      },
      {
        id: "at-never",
        content: "This will never get better",
        trigger_topics: ["future", "mood", "hope"],
        linked_belief_id: "b-hopeless",
        linked_distortion_ids: ["d-cat"],
        hotness: 75,
        disclosed: false,
      },
    ],
    self_esteem: { global: 28, narrative: "Global self-worth low; competence domain fragile" },
    patient_goals: ["Feel less heavy", "Sleep better", "Not disappoint family"],
    executive: {
      planning: "mild",
      inhibition: "intact",
      flexibility: "mild",
      working_memory: "mild",
      linked_symptom_ids: ["concentration"],
    },
    defense_mechanisms: [
      {
        id: "def-min",
        mechanism: "minimization",
        intensity: 60,
        topics: ["mood", "risk"],
        cbe_kind_bias: "minimization",
      },
      {
        id: "def-with",
        mechanism: "withdrawal",
        intensity: 55,
        topics: ["shame", "relationship"],
        cbe_kind_bias: "avoidance",
      },
    ],
    insight: { band: "partial", mutable: true },
  },
};

const GAD: FormulationSeed = {
  disorder_slugs: ["gad", "generalized-anxiety-disorder"],
  insight_band: "partial",
  pattern_tags: ["catastrophizing", "reassurance_seeking", "avoidance", "rumination"],
  protective_factors: [
    protective("pf-partner", "Supportive partner/friend", "social_support", 60),
    protective("pf-job", "Stable employment", "employment", 55),
    protective("pf-purpose", "Sense of responsibility", "purpose", 50),
    protective("pf-treatment", "Help-seeking", "treatment", 55),
  ],
  mse_defaults: {
    appearance: "tense; may fidget",
    behavior: "restless; seeks reassurance",
    speech: "pressured at times; detailed worry chains",
    mood: "anxious, keyed up",
    affect: "anxious, congruent",
    thought_process: "linear but worry-laden; may jump between worries",
    thought_content: "apprehensive expectation; no psychosis by default",
    perception: "no perceptual disturbance by default",
    judgement: "preserved; overestimates threat probability",
    cognition: "concentration impaired by worry",
    risk_summary: "low acute SI by default; monitor secondary demoralization",
  },
  formulation: {
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: [
        belief("b-danger", "The world is dangerous and I must stay alert", "world", 72),
        belief("b-cope", "I cannot cope if something goes wrong", "self", 68),
        belief("b-control", "If I worry enough I can prevent disaster", "future", 60, "elicited"),
      ],
    },
    values: [
      { id: "v-safety", label: "Safety for self/family", weight: 80 },
      { id: "v-responsibility", label: "Being responsible", weight: 70 },
    ],
    schemas: [
      {
        id: "sch-worry-helps",
        if_condition: "If I stop worrying",
        then_pattern: "then something bad will happen",
        linked_belief_ids: ["b-control", "b-danger"],
        coping_bias: "reassurance_seeking",
      },
    ],
    distortions: [
      {
        id: "d-cat-gad",
        distortion_kind: "catastrophizing",
        activation_topics: ["health", "work", "family"],
        salience: "presenting",
      },
      {
        id: "d-prob",
        distortion_kind: "probability_overestimation",
        activation_topics: ["future", "health"],
        salience: "presenting",
      },
    ],
    automatic_thoughts_seed: [
      {
        id: "at-what-if",
        content: "What if something terrible happens and I miss it?",
        trigger_topics: ["future", "health", "family"],
        linked_belief_id: "b-danger",
        hotness: 72,
        disclosed: false,
      },
    ],
    self_esteem: { global: 45 },
    patient_goals: ["Feel less on edge", "Sleep without racing thoughts"],
    executive: {
      planning: "intact",
      inhibition: "mild",
      flexibility: "mild",
      working_memory: "mild",
    },
    defense_mechanisms: [
      {
        id: "def-intel",
        mechanism: "intellectualization",
        intensity: 50,
        topics: ["anxiety"],
        cbe_kind_bias: "guardedness",
      },
    ],
    insight: { band: "partial", mutable: true },
  },
};

const PTSD: FormulationSeed = {
  disorder_slugs: ["ptsd", "ptsd-adult", "cptsd"],
  insight_band: "partial",
  pattern_tags: ["avoidance", "hypervigilance", "numbing", "dissociation"],
  dissociation_bias: "mild_detachment",
  protective_factors: [
    protective("pf-ally", "One trusted person", "social_support", 50),
    protective("pf-faith", "Faith / meaning", "religion", 45),
    protective("pf-children", "Children / dependents", "children", 60),
    protective("pf-alliance", "Therapeutic alliance potential", "therapeutic_alliance", 40),
  ],
  mse_defaults: {
    appearance: "hypervigilant posture possible",
    behavior: "startle; avoidance of trauma cues",
    speech: "may go quiet near trauma material",
    mood: "anxious, irritable, or numb",
    affect: "restricted or labile when triggered",
    thought_process: "generally linear; may fragment near trauma narrative",
    thought_content: "intrusions / re-experiencing themes when elicited",
    perception: "no psychosis by default; trauma-related misperceptions possible when activated",
    judgement: "safety-focused; may overgeneralize threat",
    cognition: "concentration and memory gaps around trauma",
    risk_summary: "assess SI/self-harm; protectives and alliance matter",
  },
  formulation: {
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: [
        belief("b-unsafe", "I am not safe", "world", 80),
        belief("b-self-blame", "It was my fault / I should have stopped it", "self", 70, "hidden"),
        belief("b-trust", "People cannot be trusted", "others", 75),
      ],
    },
    values: [
      { id: "v-protect", label: "Protecting loved ones", weight: 85 },
      { id: "v-dignity", label: "Dignity / not being controlled", weight: 70 },
    ],
    schemas: [
      {
        id: "sch-close",
        if_condition: "If I get close to someone",
        then_pattern: "then I will be hurt or betrayed",
        linked_belief_ids: ["b-trust"],
        defence_bias: "avoidance",
        coping_bias: "avoidant",
      },
    ],
    distortions: [
      {
        id: "d-blame",
        distortion_kind: "personalization",
        activation_topics: ["trauma", "shame"],
        salience: "hidden",
      },
    ],
    automatic_thoughts_seed: [
      {
        id: "at-unsafe",
        content: "It's happening again — I need to get out",
        trigger_topics: ["trauma", "risk", "relationship"],
        linked_belief_id: "b-unsafe",
        hotness: 85,
        disclosed: false,
      },
    ],
    self_esteem: { global: 35 },
    patient_goals: ["Feel safer", "Sleep without nightmares", "Not lose my temper at home"],
    executive: {
      planning: "mild",
      inhibition: "mild",
      flexibility: "moderate",
      working_memory: "mild",
    },
    defense_mechanisms: [
      {
        id: "def-avoid",
        mechanism: "avoidance",
        intensity: 75,
        topics: ["trauma"],
        cbe_kind_bias: "avoidance",
      },
      {
        id: "def-numb",
        mechanism: "emotional_numbing",
        intensity: 60,
        topics: ["trauma", "relationship"],
        cbe_kind_bias: "silence",
      },
    ] as DefenseMechanism[],
    insight: { band: "partial", mutable: true },
  },
};

const BPD: FormulationSeed = {
  disorder_slugs: ["bpd", "borderline-personality-disorder"],
  insight_band: "intellectual_only",
  pattern_tags: ["idealization_devaluation", "testing", "hostility", "crying", "identity_shift"],
  protective_factors: [
    protective("pf-alliance", "Connection with therapist", "therapeutic_alliance", 45),
    protective("pf-friend", "At least one friend", "social_support", 40),
    protective("pf-hope", "Hope for being understood", "hope", 40),
    protective("pf-goals", "Future self goals", "future_goals", 35),
  ],
  mse_defaults: {
    appearance: "variable; may be carefully presented or neglected",
    behavior: "interpersonal testing; affect shifts",
    speech: "can be articulate; may become rapid when activated",
    mood: "dysphoric, empty, or angry",
    affect: "labile; intense",
    thought_process: "generally linear; may become black-and-white under stress",
    thought_content: "abandonment themes; identity concerns",
    perception: "no psychosis by default; transient stress-related ideas possible",
    judgement: "impulsivity under affect",
    cognition: "intact; may drop under emotional flooding",
    risk_summary: "self-harm / SI screening essential; validation before change",
  },
  formulation: {
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: [
        belief("b-abandon", "I will be abandoned", "others", 85),
        belief("b-bad", "I am bad / unlovable", "self", 80),
        belief("b-empty", "There is nothing solid inside me", "self", 70, "elicited"),
      ],
    },
    values: [
      { id: "v-belong", label: "Belonging / not being left", weight: 90 },
      { id: "v-authenticity", label: "Being seen as real", weight: 75 },
    ],
    schemas: [
      {
        id: "sch-leave",
        if_condition: "If someone cares then pulls back",
        then_pattern: "then they never cared and I am worthless",
        linked_belief_ids: ["b-abandon", "b-bad"],
        defence_bias: "splitting",
        coping_bias: "reassurance_seeking",
      },
    ],
    distortions: [
      {
        id: "d-split",
        distortion_kind: "all_or_nothing",
        activation_topics: ["relationship", "therapy"],
        salience: "presenting",
      },
    ],
    automatic_thoughts_seed: [
      {
        id: "at-leave",
        content: "They're going to leave like everyone else",
        trigger_topics: ["relationship", "therapy", "shame"],
        linked_belief_id: "b-abandon",
        hotness: 80,
        disclosed: false,
      },
    ],
    self_esteem: { global: 25, narrative: "Highly contingent on perceived acceptance" },
    patient_goals: ["Stop feeling so empty", "Keep relationships", "Not hate myself after fights"],
    executive: {
      planning: "mild",
      inhibition: "moderate",
      flexibility: "moderate",
    },
    defense_mechanisms: [
      {
        id: "def-split",
        mechanism: "splitting",
        intensity: 70,
        topics: ["relationship", "therapy"],
        cbe_kind_bias: "anger",
      },
      {
        id: "def-proj",
        mechanism: "projective_identification",
        intensity: 55,
        topics: ["relationship"],
        cbe_kind_bias: "anger",
      },
    ],
    insight: { band: "intellectual_only", mutable: true },
  },
};

const AUD: FormulationSeed = {
  disorder_slugs: ["aud", "alcohol-use-disorder"],
  insight_band: "poor",
  pattern_tags: ["minimization", "denial", "ambivalence", "humor"],
  protective_factors: [
    protective("pf-family", "Family wanting change", "family", 50),
    protective("pf-job", "Job at risk / motivation", "employment", 45),
    protective("pf-children", "Children", "children", 55),
    protective("pf-treatment", "Prior help-seeking", "treatment", 35),
  ],
  mse_defaults: {
    appearance: "may minimize cues of use",
    behavior: "defensive humour; ambivalence",
    speech: "normal; may become glib when confronted",
    mood: "irritable or euthymic with denial",
    affect: "incongruent humour possible when shame rises",
    thought_process: "linear",
    thought_content: "minimization of consequences",
    perception: "no perceptual disturbance by default",
    judgement: "impaired regarding substance consequences",
    cognition: "generally intact",
    risk_summary: "assess withdrawal risk, SI, harm to others when intoxicated",
  },
  formulation: {
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: [
        belief("b-control-aud", "I can stop whenever I want", "self", 65, "presenting"),
        belief("b-need", "I need this to cope / be myself", "self", 70, "hidden"),
        belief("b-judge", "People will judge me if they know", "others", 60),
      ],
    },
    values: [
      { id: "v-autonomy", label: "Autonomy", weight: 75 },
      { id: "v-family-aud", label: "Family", weight: 70 },
    ],
    schemas: [
      {
        id: "sch-cope",
        if_condition: "If I feel stressed or empty",
        then_pattern: "then drinking is the only thing that works",
        linked_belief_ids: ["b-need"],
        coping_bias: "avoidant",
      },
    ],
    distortions: [
      {
        id: "d-min-aud",
        distortion_kind: "minimization",
        activation_topics: ["substance", "risk"],
        salience: "presenting",
      },
    ],
    automatic_thoughts_seed: [
      {
        id: "at-not-that-bad",
        content: "It's not that bad — other people drink more",
        trigger_topics: ["substance", "confrontation"],
        linked_belief_id: "b-control-aud",
        hotness: 60,
        disclosed: true,
      },
    ],
    self_esteem: { global: 40 },
    patient_goals: ["Keep my job", "Argue less at home", "Cut down somehow"],
    executive: {
      planning: "mild",
      inhibition: "moderate",
      flexibility: "mild",
    },
    defense_mechanisms: [
      {
        id: "def-denial",
        mechanism: "denial",
        intensity: 70,
        topics: ["substance"],
        cbe_kind_bias: "denial",
      },
      {
        id: "def-humor",
        mechanism: "humor",
        intensity: 50,
        topics: ["substance", "shame"],
        cbe_kind_bias: "embarrassment",
      },
    ],
    insight: { band: "poor", mutable: true },
  },
};

const DEFAULT_SEED: FormulationSeed = {
  disorder_slugs: ["*"],
  insight_band: "partial",
  pattern_tags: ["guardedness", "hesitation"],
  protective_factors: [
    protective("pf-support", "Social support", "social_support", 45),
    protective("pf-hope-def", "Hope", "hope", 40),
    protective("pf-treatment-def", "Treatment engagement", "treatment", 40),
    protective("pf-goals-def", "Future goals", "future_goals", 40),
  ],
  mse_defaults: {
    appearance: "generally appropriate",
    behavior: "cooperative with moments of guardedness",
    speech: "normal rate and volume",
    mood: "variable with presentation",
    affect: "reactive, largely congruent",
    thought_process: "linear and goal-directed",
    thought_content: "no delusions by default",
    perception: "no perceptual disturbance by default",
    judgement: "largely preserved",
    cognition: "grossly intact",
    risk_summary: "assess per RiskProfile; explore protectives",
  },
  formulation: {
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: [
        belief("b-generic-self", "I should handle this on my own", "self", 55),
      ],
    },
    values: [{ id: "v-health", label: "Getting better", weight: 60 }],
    schemas: [
      {
        id: "sch-generic",
        if_condition: "If I open up fully",
        then_pattern: "then I may be judged",
        linked_belief_ids: ["b-generic-self"],
        coping_bias: "avoidant",
      },
    ],
    distortions: [],
    automatic_thoughts_seed: [],
    self_esteem: { global: 50 },
    patient_goals: ["Feel better", "Understand what's going on"],
    executive: {
      planning: "intact",
      inhibition: "intact",
      flexibility: "intact",
    },
    defense_mechanisms: [],
    insight: { band: "partial", mutable: true },
  },
};

const SEEDS: FormulationSeed[] = [MDD, GAD, PTSD, BPD, AUD, DEFAULT_SEED];

export function findFormulationSeed(disorderSlug: string | null | undefined): FormulationSeed {
  const slug = (disorderSlug ?? "").toLowerCase();
  if (!slug) return DEFAULT_SEED;
  for (const seed of SEEDS) {
    if (seed.disorder_slugs.includes("*")) continue;
    if (seed.disorder_slugs.some((s) => slug === s || slug.includes(s) || s.includes(slug))) {
      return seed;
    }
  }
  // category-ish fallbacks
  if (/depress|mdd|dysthym/.test(slug)) return MDD;
  if (/anx|gad|panic/.test(slug)) return GAD;
  if (/ptsd|trauma|cptsd/.test(slug)) return PTSD;
  if (/borderline|bpd/.test(slug)) return BPD;
  if (/alcohol|aud|substance/.test(slug)) return AUD;
  return DEFAULT_SEED;
}

export function buildFormulationFromSeed(seed: FormulationSeed): PatientFormulation {
  return {
    version: FORMULATION_VERSION,
    ...seed.formulation,
    belief_system: {
      version: FORMULATION_VERSION,
      core_beliefs: seed.formulation.belief_system.core_beliefs.map((b) => ({ ...b })),
    },
  };
}
