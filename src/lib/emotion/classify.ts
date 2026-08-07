/**
 * Lightweight heuristic classifier: therapist utterance → intervention.
 * Deterministic keyword rules — no LLM. HCE/TRE may replace later.
 */

import type { TherapistIntervention } from "@/lib/emotion/types";

type Rule = {
  intervention: TherapistIntervention;
  patterns: RegExp[];
  weight: number;
};

const RULES: Rule[] = [
  {
    intervention: "hostility",
    patterns: [
      /\byou('re| are) (just )?(being )?(dramatic|overreacting|ridiculous|pathetic)\b/i,
      /\b(shut up|get over it|stop crying|man up)\b/i,
      /\b(waste of time|nonsense|stupid)\b/i,
    ],
    weight: 100,
  },
  {
    intervention: "invalidation",
    patterns: [
      /\bit('s| is) not (that )?bad\b/i,
      /\byou('re| are) (over)?sensitive\b/i,
      /\b(others have it worse|cheer up|just think positive)\b/i,
      /\byou shouldn'?t feel\b/i,
    ],
    weight: 90,
  },
  {
    intervention: "rupture_repair",
    patterns: [
      /\b(i('m| am) sorry|apologize|that (was|felt) invalidating)\b/i,
      /\b(let me try again|i interrupted you|i got that wrong)\b/i,
      /\b(thank you for telling me i (missed|hurt))\b/i,
    ],
    weight: 85,
  },
  {
    intervention: "safety_check",
    patterns: [
      /\b(suicid|kill yourself|end (your|it)|harm yourself|safety plan)\b/i,
      /\b(are you safe|thoughts of (death|dying|hurting))\b/i,
      /\b(intent|plan|means).{0,40}(hurt|harm|die|kill)\b/i,
    ],
    weight: 95,
  },
  {
    intervention: "homework_review",
    patterns: [
      /\b(homework|between.?session|thought record|worksheet|practice (this|that|the))\b/i,
      /\b(did you (try|practice|complete)|how did the (practice|homework))\b/i,
    ],
    weight: 80,
  },
  {
    intervention: "validation",
    patterns: [
      /\b(that makes sense|understandable|of course you('d| would)|valid)\b/i,
      /\b(anyone (would|might) feel|no wonder|right to feel)\b/i,
      /\b(i hear how hard|that sounds (really |so )?(hard|painful|heavy))\b/i,
    ],
    weight: 70,
  },
  {
    intervention: "empathy",
    patterns: [
      /\b(i can (see|hear|imagine)|must (be|feel)|sounds like you('re| are))\b/i,
      /\b(with you|beside you|here with you)\b/i,
      /\b(how (painful|scary|lonely|overwhelming))\b/i,
    ],
    weight: 65,
  },
  {
    intervention: "reflection",
    patterns: [
      /\b(what i('m| am) hearing|it sounds like|you('re| are) saying)\b/i,
      /\b(so (you|it) (feel|felt|seem)|on the one hand)\b/i,
    ],
    weight: 55,
  },
  {
    intervention: "confrontation",
    patterns: [
      /\b(i notice (you|a)|help me understand why|earlier you said)\b/i,
      /\b(there('s| is) a (tension|contradiction|discrepancy))\b/i,
    ],
    weight: 50,
  },
  {
    intervention: "advice",
    patterns: [
      /\b(you should|you need to|just (try|do)|why don'?t you)\b/i,
      /\b(my advice|if i were you|the best thing)\b/i,
    ],
    weight: 45,
  },
  {
    intervention: "psychoeducation",
    patterns: [
      /\b(depression (often|can)|anxiety (often|can)|research shows|common for)\b/i,
      /\b(symptom|cbt|dbt|cognitive|nervous system)\b/i,
    ],
    weight: 40,
  },
  {
    intervention: "support",
    patterns: [
      /\b(i('m| am) here|we (can|will) (work|figure)|you('re| are) not alone)\b/i,
      /\b(we('ll| will) take (this|it) (slow|one step))\b/i,
    ],
    weight: 40,
  },
  {
    intervention: "open_question",
    patterns: [
      /^(what|how|tell me|can you (say|tell)|when you).{0,80}\?$/i,
      /\b(what (was|is) that like|how did (that|it) feel)\b/i,
    ],
    weight: 30,
  },
  {
    intervention: "closed_question",
    patterns: [
      /^(did|do|are|is|have|has|was|were|can|could|would)\b.+\?$/i,
    ],
    weight: 25,
  },
];

export type ClassificationResult = {
  primary: TherapistIntervention;
  secondary: TherapistIntervention[];
  scores: Partial<Record<TherapistIntervention, number>>;
};

/**
 * Classify a therapist message into primary (+ optional secondary) interventions.
 * Empty / whitespace → silence.
 */
export function classifyTherapistIntervention(
  message: string | null | undefined,
): ClassificationResult {
  const text = (message ?? "").trim();
  if (!text) {
    return { primary: "silence", secondary: [], scores: { silence: 1 } };
  }

  const scores: Partial<Record<TherapistIntervention, number>> = {};
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      if (re.test(text)) {
        scores[rule.intervention] =
          (scores[rule.intervention] ?? 0) + rule.weight;
        break;
      }
    }
  }

  const ranked = (
    Object.entries(scores) as [TherapistIntervention, number][]
  ).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    // Heuristic fallback by punctuation / length
    if (text.endsWith("?")) {
      const primary: TherapistIntervention =
        /^(what|how|tell)\b/i.test(text) ? "open_question" : "closed_question";
      return { primary, secondary: [], scores: { [primary]: 10 } };
    }
    return { primary: "other", secondary: [], scores: { other: 1 } };
  }

  const primary = ranked[0]![0];
  const secondary = ranked
    .slice(1)
    .filter(([, w]) => w >= 40)
    .slice(0, 2)
    .map(([i]) => i);

  return { primary, secondary, scores };
}
