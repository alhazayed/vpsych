/**
 * Module 2 — Disclosure engine. Continuous thresholds, never binary.
 */

import type {
  DisclosureTopicId,
  DisclosureTopicState,
  EmotionalState,
  RelationshipMemory,
} from "@/lib/pme/types";
import { clamp01to100 } from "@/lib/pme/emotion";
import type { TherapistTurnSignals } from "@/lib/pme/relationship";

const DEFAULT_TOPICS: DisclosureTopicId[] = [
  "trauma",
  "sexual_abuse",
  "psychosis",
  "suicidal_thoughts",
  "self_harm",
  "substance_use",
  "family_conflict",
  "shame",
  "medication_nonadherence",
];

/** Higher = harder to disclose initially. */
const BASE_THRESHOLD: Record<DisclosureTopicId, number> = {
  trauma: 70,
  sexual_abuse: 85,
  psychosis: 75,
  suicidal_thoughts: 65,
  self_harm: 70,
  substance_use: 55,
  family_conflict: 45,
  shame: 60,
  medication_nonadherence: 50,
};

export function createDisclosureState(
  riskHints?: {
    suicidal?: boolean;
    self_harm?: boolean;
    substance?: boolean;
  },
): DisclosureTopicState[] {
  return DEFAULT_TOPICS.map((topic) => {
    let readiness = 100 - BASE_THRESHOLD[topic];
    // Risk topics start slightly more available if profile has them (still guarded)
    if (topic === "suicidal_thoughts" && riskHints?.suicidal) readiness += 8;
    if (topic === "self_harm" && riskHints?.self_harm) readiness += 6;
    if (topic === "substance_use" && riskHints?.substance) readiness += 10;
    return {
      topic,
      readiness: clamp01to100(readiness),
      times_approached: 0,
      times_partially_disclosed: 0,
      last_level: "closed",
    };
  });
}

const TOPIC_PROBE: Partial<Record<DisclosureTopicId, RegExp>> = {
  trauma: /\b(trauma|abuse|assault|flashback|nightmare|incident)\b|صدمه|اعتداء|كابوس/i,
  sexual_abuse: /\b(sexual|assault|rape|molested)\b|تحرش|اغتصاب/i,
  psychosis: /\b(voice|voices|hearing|paranoid|watching you|delusion)\b|أصوات|يراقبو/i,
  suicidal_thoughts:
    /\b(suicid|kill yourself|end your life|better off dead|hurt yourself)\b|انتحار|أذى نفسك/i,
  self_harm: /\b(cut|cutting|self-harm|burn yourself)\b|جرح|أذيّة/i,
  substance_use: /\b(drink|alcohol|drug|substance|high|using)\b|كحول|مخدر|بشرب/i,
  family_conflict: /\b(family|mother|father|partner|wife|husband|parents)\b|أهل|أمي|أبوي|زوج/i,
  shame: /\b(ashamed|embarrassed|humiliated|weak)\b|خجل|ذل/i,
  medication_nonadherence:
    /\b(medication|meds|pills|stopped taking|side effect)\b|دوا|حبوب|بطلت/i,
};

export function updateDisclosure(
  topics: DisclosureTopicState[],
  opts: {
    therapistText: string;
    relationship: RelationshipMemory;
    emotion: EmotionalState;
    signals: TherapistTurnSignals;
    sessionTurn: number;
  },
): DisclosureTopicState[] {
  const allianceBoost = (opts.relationship.alliance - 50) * 0.15;
  const trustBoost = (opts.relationship.trust - 50) * 0.12;
  const timeBoost = Math.min(8, opts.sessionTurn * 0.35);
  const skillBoost =
    opts.signals.empathy * 0.2 +
    opts.signals.validation * 0.25 -
    opts.signals.confrontation * 0.35 -
    opts.signals.poor_empathy * 0.3;
  const fearPenalty = opts.emotion.fear >= 70 ? -4 : 0;
  const shamePenalty = opts.emotion.shame >= 70 ? -3 : 0;

  return topics.map((t) => {
    const probe = TOPIC_PROBE[t.topic];
    const approached = probe ? probe.test(opts.therapistText) : false;
    let readiness = t.readiness;
    let times_approached = t.times_approached;
    let times_partially_disclosed = t.times_partially_disclosed;
    let last_level = t.last_level;

    // Background drift from alliance/trust/time
    readiness = clamp01to100(
      readiness +
        (allianceBoost + trustBoost + timeBoost + fearPenalty + shamePenalty) *
          0.15,
    );

    if (approached) {
      times_approached += 1;
      const delta = skillBoost + allianceBoost * 0.5;
      readiness = clamp01to100(readiness + Math.max(-8, Math.min(10, delta)));
    }

    // Map readiness → disclosure level (continuous bands)
    if (readiness >= 75) last_level = "open";
    else if (readiness >= 55) last_level = "partial";
    else if (readiness >= 35) last_level = "hinted";
    else last_level = "closed";

    if (approached && (last_level === "partial" || last_level === "open")) {
      times_partially_disclosed += 1;
    }

    return {
      topic: t.topic,
      readiness,
      times_approached,
      times_partially_disclosed,
      last_level,
    };
  });
}

export function disclosureGuidance(topics: DisclosureTopicState[]): string[] {
  return topics
    .filter((t) => t.times_approached > 0 || t.readiness >= 40)
    .slice(0, 6)
    .map((t) => {
      if (t.last_level === "closed") {
        return `${t.topic}: CLOSED (readiness ${t.readiness}) — deflect, minimize, or shift topic. Do not dump content.`;
      }
      if (t.last_level === "hinted") {
        return `${t.topic}: HINTED (readiness ${t.readiness}) — allow a vague allusion only if asked carefully.`;
      }
      if (t.last_level === "partial") {
        return `${t.topic}: PARTIAL (readiness ${t.readiness}) — share a fragment; stay emotionally protected.`;
      }
      return `${t.topic}: OPEN (readiness ${t.readiness}) — can discuss more fully, still in character, no clinical labels.`;
    });
}
