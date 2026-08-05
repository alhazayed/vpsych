/**
 * Disorder-linked speech behaviour profiles for patient dialogue (Mission 20).
 * These shape HOW the patient speaks — not diagnostic laundry lists.
 */

export type SpeechProfile = {
  slug: string;
  category: string;
  pace: "slow" | "measured" | "fast" | "variable" | "pressured";
  energy: "low" | "moderate" | "high" | "labile";
  /** Short coach lines injected into Module 1. */
  behaviour_lines: string[];
  /** TTS hint keys consumed by voice fidelity resolver. */
  voice_hint:
    | "depressed"
    | "anxious"
    | "manic"
    | "psychotic"
    | "trauma"
    | "ocd"
    | "personality"
    | "neutral";
};

const DEFAULT_PROFILE: SpeechProfile = {
  slug: "generic",
  category: "general",
  pace: "measured",
  energy: "moderate",
  behaviour_lines: [
    "Speak like a real person in a first psychiatric interview — uneven, concrete, not polished.",
    "Hesitate, trail off, or ask what the therapist means when a question is vague or clinical.",
    "Do not lecture about your diagnosis; show it in pace, affect, and what you avoid.",
  ],
  voice_hint: "neutral",
};

const BY_SLUG: Record<string, SpeechProfile> = {
  "mdd-recurrent-moderate": {
    slug: "mdd-recurrent-moderate",
    category: "mood",
    pace: "slow",
    energy: "low",
    voice_hint: "depressed",
    behaviour_lines: [
      "Speech is slow, quiet, low energy — reduced spontaneity. Hopelessness, not theatrical sadness.",
      "Long pauses before answering. Short answers. Effort shows in every sentence.",
      "Minimize or underplay: 'it's fine… just tired.' Soften positive affect; do not suddenly brighten.",
      "Forget small details; lose your train of thought mid-sentence when effort runs out.",
    ],
  },
  "gad-with-panic": {
    slug: "gad-with-panic",
    category: "anxiety",
    pace: "measured",
    energy: "high",
    voice_hint: "anxious",
    behaviour_lines: [
      "Worry spills sideways — body sensations, what-ifs, checking if you're making sense.",
      "Interrupt yourself to seek reassurance; then doubt the reassurance.",
      "Panic content stays guarded until trust builds; when anxious, speech speeds and fragments.",
      "Catastrophize mildly in everyday language — not textbook 'panic attack criteria'.",
    ],
  },
  "bipolar-mania": {
    slug: "bipolar-mania",
    category: "mood",
    pace: "pressured",
    energy: "high",
    voice_hint: "manic",
    behaviour_lines: [
      "Pressured speech, topic jumping, grandiosity or irritable confidence — not mere happiness.",
      "Interrupt, over-talk, connect ideas loosely. Reduced need for sleep comes up naturally.",
      "Hard to interrupt; may laugh at your own tangents. Do not sound depressed or slowed.",
      "If challenged, become defensive or escalate ideas rather than reflect calmly.",
    ],
  },
  schizophrenia: {
    slug: "schizophrenia",
    category: "psychosis",
    pace: "variable",
    energy: "low",
    voice_hint: "psychotic",
    behaviour_lines: [
      "Thought disorder and negative symptoms — not depression with optional hallucinations.",
      "Answers may be concrete, tangential, or oddly flat; conviction about unusual beliefs is quiet, not theatrical.",
      "Guardedness and suspiciousness with strangers; do not suddenly become insightful teachers.",
      "Disorganization shows in unfinished sentences and odd associations, not clinical jargon.",
    ],
  },
  schizoaffective: {
    slug: "schizoaffective",
    category: "psychosis",
    pace: "variable",
    energy: "labile",
    voice_hint: "psychotic",
    behaviour_lines: [
      "Mix of mood energy shifts with psychotic conviction — keep both threads without merging into MDD.",
      "Affect may swing; thought form can loosen when stressed.",
      "Suspiciousness and mood symptoms can coexist; do not resolve neatly in one turn.",
    ],
  },
  ptsd: {
    slug: "ptsd",
    category: "trauma",
    pace: "measured",
    energy: "moderate",
    voice_hint: "trauma",
    behaviour_lines: [
      "Avoidance, hypervigilance, guilt, startle — fragmented memory when trauma is near.",
      "Change topic or go vague when questions get too close; body tension in language.",
      "Do not deliver a neat trauma narrative; pieces come when alliance feels safe.",
      "Irritability or numbness can replace tears; either is valid.",
    ],
  },
  "complex-ptsd": {
    slug: "complex-ptsd",
    category: "trauma",
    pace: "measured",
    energy: "moderate",
    voice_hint: "trauma",
    behaviour_lines: [
      "Longer relational distrust; shame and identity confusion colour answers.",
      "Avoidance is chronic; may minimize or intellectualize before feeling.",
      "Fragmented timeline of harm; do not present a clean DSM checklist.",
    ],
  },
  ocd: {
    slug: "ocd",
    category: "anxiety",
    pace: "measured",
    energy: "high",
    voice_hint: "ocd",
    behaviour_lines: [
      "Uncertainty, mental rituals, reassurance-seeking, compulsive language ('just to be sure').",
      "Ask the therapist to repeat or clarify; circle back to the same doubt.",
      "Describe urges and neutralizing in everyday words — not 'I have obsessions and compulsions'.",
    ],
  },
  bpd: {
    slug: "bpd",
    category: "personality",
    pace: "variable",
    energy: "labile",
    voice_hint: "personality",
    behaviour_lines: [
      "Relationship patterns, splitting, identity wobble, abandonment fear — not a symptom shopping list.",
      "Warm quickly then cool if therapist feels distant; test and correct yourself mid-thought.",
      "Affective storms can arrive fast; language gets absolute ('always', 'never') then softens.",
    ],
  },
  "alcohol-use-disorder": {
    slug: "alcohol-use-disorder",
    category: "substance",
    pace: "measured",
    energy: "moderate",
    voice_hint: "neutral",
    behaviour_lines: [
      "Minimize use; bargain; get defensive if pressed early; open more with non-judgmental curiosity.",
      "Concrete stories about evenings and consequences beat clinical labels.",
      "Inconsistency about amounts is human — correct yourself awkwardly.",
    ],
  },
  adhd: {
    slug: "adhd",
    category: "neurodevelopmental",
    pace: "fast",
    energy: "high",
    voice_hint: "neutral",
    behaviour_lines: [
      "Distractible, lose train of thought, jump topics, interrupt yourself.",
      "Underplay impairment with humour or 'everyone's like that'; then contradict with examples.",
    ],
  },
};

const BY_CATEGORY: Record<string, SpeechProfile> = {
  mood: BY_SLUG["mdd-recurrent-moderate"]!,
  anxiety: BY_SLUG["gad-with-panic"]!,
  psychosis: BY_SLUG.schizophrenia!,
  trauma: BY_SLUG.ptsd!,
  personality: BY_SLUG.bpd!,
  substance: BY_SLUG["alcohol-use-disorder"]!,
};

export function speechProfileForDisorder(
  slug?: string | null,
  category?: string | null,
): SpeechProfile {
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug]!;
  // fuzzy: mdd*, bipolar*, etc.
  if (slug) {
    if (/mdd|depress/i.test(slug)) return BY_SLUG["mdd-recurrent-moderate"]!;
    if (/mania|bipolar/i.test(slug)) return BY_SLUG["bipolar-mania"]!;
    if (/schizo/i.test(slug)) return BY_SLUG.schizophrenia!;
    if (/ptsd|trauma/i.test(slug)) return BY_SLUG.ptsd!;
    if (/ocd/i.test(slug)) return BY_SLUG.ocd!;
    if (/bpd|borderline/i.test(slug)) return BY_SLUG.bpd!;
    if (/alcohol|substance/i.test(slug))
      return BY_SLUG["alcohol-use-disorder"]!;
    if (/adhd|attention/i.test(slug)) return BY_SLUG.adhd!;
  }
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category]!;
  return DEFAULT_PROFILE;
}

export function formatSpeechProfileForPrompt(profile: SpeechProfile): string {
  return [
    `Clinical speech profile (${profile.slug} / ${profile.category}):`,
    `Pace=${profile.pace}; energy=${profile.energy}.`,
    ...profile.behaviour_lines.map((l) => `- ${l}`),
  ].join("\n");
}
