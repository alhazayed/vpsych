/**
 * Disorder-specific MSE / insight / judgment / speech cues for CaseInstance snapshots.
 * Used by the Case Generator and Mission 17 scenario certification.
 */

export type ClinicalCueSet = {
  insight_expectation: string;
  judgment_expectation: string;
  speech_behavior_cue: string;
  mse_focus: string[];
  medication_history_cue: string;
  family_history_cue: string;
  social_history_cue: string;
  trauma_cue: string;
  culture_religion_cue: string;
};

const DEFAULT_CUES: ClinicalCueSet = {
  insight_expectation:
    "Insight variable; explore what the patient believes is wrong and what might help.",
  judgment_expectation:
    "Judgment largely preserved; sample concrete recent decisions and safety.",
  speech_behavior_cue:
    "Speech and behaviour consistent with the diagnosis; avoid caricature or stereotype.",
  mse_focus: ["mood", "affect", "thought_content", "insight", "judgment", "risk"],
  medication_history_cue:
    "Elicit prior psychotropics, adherence, side effects; do not invent impossible regimens.",
  family_history_cue:
    "Ask about mood/anxiety/psychosis/substance history in first-degree relatives when relevant.",
  social_history_cue:
    "Map occupation, housing, supports, finances without diagnostic invention.",
  trauma_cue:
    "Screen for trauma gently; do not force narrative disclosure.",
  culture_religion_cue:
    "Respect cultural/religious framing of distress; do not translate idioms into Western labels for the patient.",
};

const BY_SLUG: Partial<Record<string, Partial<ClinicalCueSet>>> = {
  "mdd-recurrent-moderate": {
    insight_expectation:
      "Often fair insight into low mood; may minimise SI until asked directly.",
    judgment_expectation:
      "Judgment may be slowed by pessimism; assess capacity for self-care and safety planning.",
    speech_behavior_cue:
      "Speech soft/slow; psychomotor retardation possible; tearfulness without melodrama.",
    mse_focus: [
      "mood",
      "affect",
      "anhedonia",
      "sleep",
      "concentration",
      "SI",
      "insight",
    ],
    medication_history_cue:
      "Prior antidepressants possible; screen bipolarity before AD discussion; no MAOI+SSRI fantasy stacks.",
    trauma_cue: "Trauma screen optional; depression may coexist with trauma without forcing narrative.",
  },
  "gad-with-panic": {
    insight_expectation: "Usually good insight that worry is excessive; may still seek reassurance.",
    judgment_expectation: "Judgment intact; avoidance may look like poor judgment—clarify function.",
    speech_behavior_cue:
      "Speech may be pressured when anxious; fidgeting; panic language is somatic and catastrophic.",
    mse_focus: ["anxiety", "worry_domains", "panic", "sleep", "concentration", "insight"],
  },
  ptsd: {
    insight_expectation:
      "Insight often good into link to trauma once safety established; avoidance of detail is expected.",
    judgment_expectation:
      "Hypervigilance can skew risk appraisal; assess safety without flooding.",
    speech_behavior_cue:
      "Startle, guarded posture, topic avoidance; do not force trauma narrative.",
    mse_focus: ["intrusions", "avoidance", "hyperarousal", "mood", "SI", "dissociation"],
    trauma_cue:
      "Trauma-informed pacing mandatory; titrate content; never force disclosure for OSCE completeness.",
  },
  "complex-ptsd": {
    insight_expectation:
      "Insight into trauma effects may be partial; shame and negative self-concept common.",
    judgment_expectation:
      "Affect dysregulation can impair moment-to-moment judgment; prioritize safety and grounding.",
    speech_behavior_cue:
      "Affect shifts; relational testing possible; avoid BPD caricature while noting DSO features.",
    mse_focus: [
      "PTSD_core",
      "affect_dysregulation",
      "self_concept",
      "relationships",
      "SI",
      "self_harm",
    ],
    trauma_cue: "Prolonged/repeated trauma history; phase-based; no flooding.",
  },
  pdd: {
    insight_expectation: "Often frames dysphoria as personality ('I've always been this way').",
    judgment_expectation: "Judgment generally intact; chronicity ≠ acute MDD episode.",
    speech_behavior_cue: "Low-energy, wry or flat affect; not acute melancholic retardation unless comorbid MDD.",
    mse_focus: ["chronic_mood", "course_≥2y", "MDD_superimposed", "function", "SI"],
  },
  "panic-disorder": {
    insight_expectation: "Knows attacks are not heart attacks intellectually; fear of recurrence remains.",
    speech_behavior_cue: "Somatic focus, catastrophic misinterpretation; restless but not manic.",
    mse_focus: ["panic_phenomenology", "agoraphobia", "avoidance", "medical_rule_out"],
  },
  "social-anxiety": {
    insight_expectation: "Recognizes fear as excessive yet anticipatory dread persists.",
    speech_behavior_cue: "Soft voice, gaze aversion, rehearsal of performance fears—not autism stereotype.",
    mse_focus: ["feared_situations", "avoidance", "blush_tremor", "substance_to_cope"],
  },
  ocd: {
    insight_expectation: "Insight usually good that obsessions are unwanted; may hide content from shame.",
    judgment_expectation: "Compulsions can consume time; assess risk of harm obsessions without reassurance loops.",
    speech_behavior_cue: "May seek reassurance; speech otherwise normal; avoid mocking rituals.",
    mse_focus: ["obsessions", "compulsions", "insight", "time_consumed", "avoidance"],
  },
  "adult-adhd": {
    insight_expectation: "Often good; may under-report childhood history until prompted.",
    speech_behavior_cue: "Tangential, restless, lost train of thought—not manic flight of ideas.",
    mse_focus: ["inattention", "hyperactivity", "impulsivity", "childhood_onset", "function"],
    medication_history_cue:
      "Stimulant/non-stimulant history possible; screen diversion and cardiac contraindications verbally.",
  },
  "alcohol-use-disorder": {
    insight_expectation: "Insight often partial (minimisation); MI stance preferred.",
    judgment_expectation: "Impaired when intoxicated; assess withdrawal risk and driving.",
    speech_behavior_cue: "Defensive or charming minimisation; do not moralise.",
    mse_focus: ["use_pattern", "tolerance", "withdrawal", "consequences", "SI", "dual_diagnosis"],
  },
  bpd: {
    insight_expectation: "Insight fluctuates with affect state; may intellectualise between crises.",
    judgment_expectation:
      "Impulsivity and abandonment fears can impair judgment; assess self-harm and interpersonal crises.",
    speech_behavior_cue:
      "Affectively intense, rapid shifts; not psychotic disorganisation unless comorbid.",
    mse_focus: [
      "affective_instability",
      "abandonment",
      "identity",
      "self_harm",
      "SI",
      "relationships",
    ],
  },
  asd: {
    insight_expectation: "May describe difference without pathologising; alexithymia possible.",
    judgment_expectation: "Concrete reasoning; social judgment differences ≠ incapacity.",
    speech_behavior_cue:
      "Literal language, atypical eye contact/prosody possible; never caricature or infantilise.",
    mse_focus: ["social_communication", "restricted_interests", "sensory", "developmental_history"],
  },
  schizophrenia: {
    insight_expectation: "Insight often impaired into delusions/hallucinations; do not argue reality.",
    judgment_expectation: "Judgment may be impaired by psychosis; assess risk to self/others calmly.",
    speech_behavior_cue:
      "Thought disorder possible (derailment, poverty); hallucinations reported, not performed as theatre.",
    mse_focus: [
      "delusions",
      "hallucinations",
      "thought_form",
      "negative_symptoms",
      "insight",
      "risk",
    ],
    medication_history_cue:
      "Antipsychotic trials/adherence/EPS/metabolic effects; no invented polypharmacy miracles.",
  },
  schizoaffective: {
    insight_expectation: "Insight may vary across mood vs psychotic phases.",
    judgment_expectation: "Assess risk across mood elevation/depression and psychosis.",
    speech_behavior_cue:
      "Mood-congruent or incongruent psychotic content; map timeline carefully.",
    mse_focus: ["mood_episode", "psychosis_independent_period", "timeline", "risk"],
  },
  "bipolar-mania": {
    insight_expectation: "Insight often poor in mania; irritability if challenged.",
    judgment_expectation:
      "Judgment frequently impaired (spending, sex, driving); assess harm to self/others and sleep.",
    speech_behavior_cue:
      "Pressured speech, flight of ideas, increased goal-directed activity; psychotic features if coded.",
    mse_focus: [
      "elevated_irritable_mood",
      "sleep_need",
      "speech",
      "impulsivity",
      "psychosis",
      "risk",
    ],
    medication_history_cue:
      "Mood stabilisers/antipsychotics; never invent antidepressant-only mania treatment as ideal.",
  },
  "eating-disorders": {
    insight_expectation: "Insight into medical risk often poor; body-image conviction strong.",
    judgment_expectation: "Food/exercise decisions may be rigid; medical safety overrides negotiation.",
    speech_behavior_cue: "May minimise intake; intellectualise nutrition; avoid appearance comments.",
    mse_focus: ["restriction", "body_image", "purging_screen", "medical_red_flags", "SI"],
  },
  delirium: {
    insight_expectation: "Fluctuating; often impaired orientation/attention—not primary psychiatric.",
    judgment_expectation: "Impaired; medical workup framing; not a psychotherapy OSCE primary.",
    speech_behavior_cue:
      "Inattention, fluctuating alertness, incoherent periods; do not play chronic schizophrenia.",
    mse_focus: ["attention", "orientation", "fluctuation", "medical_context", "hallucinations_visual"],
  },
};

export function clinicalCuesForDisorder(slug: string): ClinicalCueSet {
  const overlay = BY_SLUG[slug] ?? {};
  return { ...DEFAULT_CUES, ...overlay };
}
