/**
 * Disorder-linked speech behaviour for Wave 3 Human Conversation Fidelity.
 * Shapes HOW the patient speaks in Module 1 — not a separate scoring engine.
 */

export type SpeechBehaviorProfile = {
  slug: string;
  category: string;
  pace: "slow" | "measured" | "fast" | "variable" | "pressured";
  energy: "low" | "moderate" | "high" | "labile";
  behaviour_lines: string[];
};

const DEFAULT_PROFILE: SpeechBehaviorProfile = {
  slug: "generic",
  category: "general",
  pace: "measured",
  energy: "moderate",
  behaviour_lines: [
    "Speak like a real person in a first psychiatric interview — uneven, concrete, not polished.",
    "Hesitate, trail off, or ask what the therapist means when a question is vague or clinical.",
    "Do not lecture about your diagnosis; show it in pace, affect, and what you avoid.",
  ],
};

const BY_SLUG: Record<string, SpeechBehaviorProfile> = {
  "mdd-recurrent-moderate": {
    slug: "mdd-recurrent-moderate",
    category: "mood",
    pace: "slow",
    energy: "low",
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
    behaviour_lines: [
      "Thought disorder and negative symptoms — not depression with optional hallucinations.",
      "Answers may be concrete, tangential, or oddly flat; conviction about unusual beliefs is quiet, not theatrical.",
      "Guardedness and suspiciousness with strangers; do not suddenly become insightful teachers.",
      "Disorganization shows in unfinished sentences and odd associations, not clinical jargon.",
    ],
  },
  ptsd: {
    slug: "ptsd",
    category: "trauma",
    pace: "measured",
    energy: "moderate",
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
    behaviour_lines: [
      "Longer relational distrust; shame and identity confusion colour answers.",
      "Avoidance is chronic; may minimize or intellectualize before feeling.",
      "Fragmented timeline of harm; do not present a clean DSM checklist.",
    ],
  },
  bpd: {
    slug: "bpd",
    category: "personality",
    pace: "variable",
    energy: "labile",
    behaviour_lines: [
      "Relationship patterns, splitting, identity wobble, abandonment fear — not a symptom shopping list.",
      "Warm quickly then cool if therapist feels distant; test and correct yourself mid-thought.",
      "Affective storms can arrive fast; language gets absolute ('always', 'never') then softens.",
      "Validation before challenge opens you; lectures shut you down or provoke.",
    ],
  },
  "alcohol-use-disorder": {
    slug: "alcohol-use-disorder",
    category: "substance",
    pace: "measured",
    energy: "moderate",
    behaviour_lines: [
      "Minimize use; bargain; get defensive if pressed early; open more with non-judgmental curiosity.",
      "Concrete stories about evenings and consequences beat clinical labels.",
      "Inconsistency about amounts is human — correct yourself awkwardly.",
    ],
  },
  "adult-adhd": {
    slug: "adult-adhd",
    category: "neurodevelopmental",
    pace: "fast",
    energy: "high",
    behaviour_lines: [
      "Distractible, lose train of thought, jump topics, interrupt yourself.",
      "Underplay impairment with humour or 'everyone's like that'; then contradict with examples.",
      "Answers arrive in fragments; ask the therapist to repeat when you drift.",
    ],
  },
  "panic-disorder": {
    slug: "panic-disorder",
    category: "anxiety",
    pace: "measured",
    energy: "high",
    behaviour_lines: [
      "Fear of the next attack colours ordinary talk; body sensations come first, labels later.",
      "Avoidance of places/situations surfaces as excuses before frank fear admission.",
      "When describing an attack, stay sensory and scared — not a textbook symptom checklist.",
    ],
  },
  delirium: {
    slug: "delirium",
    category: "medical",
    pace: "variable",
    energy: "labile",
    behaviour_lines: [
      "Attention waxes and wanes within the interview — lucid then confused.",
      "Misidentify place/time/people; answers may reverse minutes later.",
      "This is acute medical confusion, not a chronic mood or anxiety story.",
    ],
  },
};

export function speechBehaviorForDisorder(
  slug?: string | null,
  category?: string | null,
): SpeechBehaviorProfile {
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug]!;
  if (slug) {
    if (/mdd|depress/i.test(slug)) return BY_SLUG["mdd-recurrent-moderate"]!;
    if (/mania|bipolar/i.test(slug)) return BY_SLUG["bipolar-mania"]!;
    if (/schizo/i.test(slug)) return BY_SLUG.schizophrenia!;
    if (/complex.?ptsd/i.test(slug)) return BY_SLUG["complex-ptsd"]!;
    if (/ptsd|trauma/i.test(slug)) return BY_SLUG.ptsd!;
    if (/bpd|borderline/i.test(slug)) return BY_SLUG.bpd!;
    if (/alcohol|substance/i.test(slug)) return BY_SLUG["alcohol-use-disorder"]!;
    if (/adhd|attention/i.test(slug)) return BY_SLUG["adult-adhd"]!;
    if (/panic/i.test(slug)) return BY_SLUG["panic-disorder"]!;
    if (/delirium/i.test(slug)) return BY_SLUG.delirium!;
  }
  if (category === "mood") return BY_SLUG["mdd-recurrent-moderate"]!;
  if (category === "anxiety") return BY_SLUG["gad-with-panic"]!;
  if (category === "psychosis") return BY_SLUG.schizophrenia!;
  if (category === "trauma") return BY_SLUG.ptsd!;
  if (category === "personality") return BY_SLUG.bpd!;
  if (category === "substance") return BY_SLUG["alcohol-use-disorder"]!;
  if (category === "medical") return BY_SLUG.delirium!;
  return DEFAULT_PROFILE;
}

export function formatSpeechBehaviorForPrompt(
  profile: SpeechBehaviorProfile,
): string {
  return [
    `Clinical speech profile (${profile.slug}): pace=${profile.pace}; energy=${profile.energy}.`,
    ...profile.behaviour_lines.map((l) => `- ${l}`),
  ].join("\n");
}

/** @deprecated Prefer importing from therapy-process — kept as re-export. */
export { formatDifficultyBehaviorForPrompt } from "@/lib/case-engine/therapy-process";
