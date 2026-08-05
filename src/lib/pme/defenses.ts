/**
 * Module 3 — Defense mechanism engine.
 */

import type {
  DefenseId,
  EmotionalState,
  RelationshipMemory,
  SessionPhase,
} from "@/lib/pme/types";
import type { TherapistTurnSignals } from "@/lib/pme/relationship";

const GUIDANCE: Record<DefenseId, string> = {
  denial: "Deny or dismiss the concern lightly; do not argue clinically.",
  avoidance: "Steer away; answer beside the point; keep it vague.",
  projection: "Attribute the difficulty to others or the therapist's tone.",
  rationalization: "Offer a tidy everyday excuse that underplays the problem.",
  intellectualization: "Talk about the issue abstractly, without feeling.",
  minimization: "Shrink the problem: 'it's not that bad', 'everyone deals with it'.",
  splitting: "Speak in absolutes about people (all-good / all-bad) briefly.",
  humor: "Use dry or deflecting humor; then go quiet if pressed.",
  passive_aggression: "Agree thinly with an edge; short, cool replies.",
  silence: "Give a very short reply or trail off; long pause energy.",
  topic_shifting: "Change the subject to something safer mid-answer.",
};

export function selectDefenses(opts: {
  disorderSlug: string;
  emotion: EmotionalState;
  relationship: RelationshipMemory;
  phase: SessionPhase;
  signals: TherapistTurnSignals;
}): DefenseId[] {
  const out: DefenseId[] = [];
  const stress =
    opts.emotion.fear * 0.3 +
    opts.emotion.shame * 0.25 +
    opts.emotion.anger * 0.2 +
    (100 - opts.relationship.alliance) * 0.25;

  if (opts.signals.confrontation >= 8 || opts.signals.poor_empathy >= 6) {
    out.push("avoidance", "topic_shifting");
    if (opts.emotion.anger >= 50) out.push("passive_aggression");
  }

  if (/mdd|depress/i.test(opts.disorderSlug)) {
    out.push("minimization");
    if (stress > 55) out.push("silence");
  }
  if (/mania|bipolar/i.test(opts.disorderSlug)) {
    out.push("humor", "rationalization");
  }
  if (/schizo/i.test(opts.disorderSlug)) {
    out.push("avoidance", "projection");
  }
  if (/ptsd|trauma/i.test(opts.disorderSlug)) {
    out.push("avoidance", "topic_shifting");
    if (opts.emotion.shame >= 55) out.push("minimization");
  }
  if (/ocd/i.test(opts.disorderSlug)) {
    out.push("intellectualization", "rationalization");
  }
  if (/bpd|borderline/i.test(opts.disorderSlug)) {
    out.push("splitting");
    if (opts.relationship.trust < 40) out.push("projection");
  }
  if (/alcohol|substance/i.test(opts.disorderSlug)) {
    out.push("denial", "minimization");
  }

  if (opts.phase === "resistance") out.push("topic_shifting");
  if (opts.phase === "opening" || opts.phase === "rapport") {
    // Soft defenses early
    if (!out.includes("minimization")) out.push("minimization");
  }
  if (opts.relationship.alliance >= 70 && opts.signals.empathy >= 8) {
    // Drop harshest defenses when safe
    return unique(out.filter((d) => d !== "passive_aggression" && d !== "denial")).slice(
      0,
      3,
    );
  }

  return unique(out).slice(0, 3);
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function defenseGuidance(ids: DefenseId[]): string[] {
  return ids.map((id) => `${id}: ${GUIDANCE[id]}`);
}
