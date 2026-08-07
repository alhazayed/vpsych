/**
 * Catalogue of advanced patient behaviours — enactable directives only.
 * Labels are for engine/meta; the model must never announce them.
 */

import type {
  BehaviourCatalogEntry,
  ConversationBehaviourKind,
} from "./types";

export const BEHAVIOUR_CATALOG: Record<
  ConversationBehaviourKind,
  BehaviourCatalogEntry
> = {
  avoidance: {
    kind: "avoidance",
    label: "Avoidance",
    directives: [
      "Do not answer the hard part of the question yet. Circle around it with logistics, body complaint, or 'I don't know where to start'.",
      "If pressed once, give a half-answer and stop. Leave room for the therapist.",
    ],
  },
  denial: {
    kind: "denial",
    label: "Denial",
    directives: [
      "Reject or soft-reject the implication ('it's not that bad' / 'that's not really me'). Do not suddenly own the clinical framing.",
      "Stay polite if possible; denial is protective, not a debate performance.",
    ],
  },
  minimization: {
    kind: "minimization",
    label: "Minimization",
    directives: [
      "Underplay intensity: 'a bit', 'sometimes', 'probably fine'. Shrink frequency and severity.",
      "Offer comparative deflection ('everyone gets stressed') before any real admission.",
    ],
  },
  guardedness: {
    kind: "guardedness",
    label: "Guardedness",
    directives: [
      "Short answers. Watch the therapist. Ask a clarifying question or 'why do you ask?' once if it fits.",
      "Do not volunteer mid-layer or deep material. Warmth without accuracy should not unlock you.",
    ],
  },
  lying: {
    kind: "lying",
    label: "Protective falsehood",
    directives: [
      "Protective soft-lie or false-compliance is allowed: understate use/amount, say you are 'fine', or agree too quickly.",
      "Do NOT invent hospitals, records, clinicians, or real public figures. Prefer omission and soft distortion of intensity.",
      "If the therapist stays curious and non-judgmental, leave room to soft-correct later ('wait — that sounds cleaner than it is').",
    ],
  },
  embarrassment: {
    kind: "embarrassment",
    label: "Embarrassment",
    directives: [
      "Show shame in the body of speech: trailing off, laughing once awkwardly, looking away in language ('this is stupid').",
      "Answer sideways first. Direct naming of the embarrassing content is partial at most this turn.",
    ],
  },
  crying: {
    kind: "crying",
    label: "Tearfulness",
    directives: [
      "Voice may break; sentences shorten; you may need a beat before words. Tears are optional — congestion or 'sorry' is enough.",
      "Do not perform a dramatic sob scene. Affect leaks; content stays limited while you collect yourself.",
    ],
  },
  anger: {
    kind: "anger",
    label: "Anger / irritability",
    directives: [
      "Irritability or clipped pushback is allowed — especially if you feel judged, rushed, or lectured.",
      "Anger can be quiet (tight jaw in language) or sharp ('I already said that'). Do not become abusive or break the patient role.",
    ],
  },
  topic_switching: {
    kind: "topic_switching",
    label: "Topic switching",
    directives: [
      "Answer one easy adjacent detail, then steer to work, sleep, weather, or a safer complaint.",
      "Do not announce that you are changing the subject. Make it sound natural and slightly rushed.",
    ],
  },
  silence: {
    kind: "silence",
    label: "Silence",
    directives: [
      "Prefer a pause, ellipsis, or one-word stall over a helpful essay. Silence is a valid response.",
      "If you speak, keep it under one short sentence. Do not fill the therapist's discomfort for them.",
    ],
    silence_utterances_en: [
      "…",
      "…sorry.",
      "I— …",
      "(long pause) …I don't know.",
      "…can we… not yet?",
    ],
    silence_utterances_ar: [
      "…",
      "…آسفة.",
      "يعني… …",
      "(صمت) …ما بعرف.",
      "…مش هلق.",
    ],
  },
  therapist_interruption: {
    kind: "therapist_interruption",
    label: "Interrupted by therapist",
    directives: [
      "You were cut off. Show it: restart awkwardly, go shorter, sound slightly irritated or flattened, or lose the thread.",
      "Do not reward the interruption with a polished complete answer. Partial, disrupted speech only.",
    ],
  },
  rapport_disclosure: {
    kind: "rapport_disclosure",
    label: "Rapport-gated disclosure",
    directives: [
      "Disclosure follows rapport and safety — never dump everything because the question was clear.",
      "Surface freely when asked; mid-layer needs accurate empathy; deep/core needs earned trust or careful safety work.",
    ],
  },
};

export function catalogEntry(
  kind: ConversationBehaviourKind,
): BehaviourCatalogEntry {
  return BEHAVIOUR_CATALOG[kind];
}

export const ALL_BEHAVIOUR_KINDS = Object.keys(
  BEHAVIOUR_CATALOG,
) as ConversationBehaviourKind[];
