/**
 * Indicative CTS-R view — maps the existing assessment rubric and the session
 * practice checklist onto the 12 items of the Revised Cognitive Therapy Scale
 * (Blackburn et al., 2001), each 0–6.
 *
 * This is NOT a CTS-R rating by a trained rater and is not validated. It lets
 * supervisors read VPsych output in a vocabulary they already use.
 */

import type { ScoreEntry } from "@/lib/types";
import {
  SESSION_PRACTICE_VERSION,
  type CtsrItem,
  type CtsrItemId,
  type IndicativeCtsr,
  type PracticeCheckId,
  type SessionPracticeReport,
} from "@/lib/session-practice/types";

export const CTSR_ITEM_ORDER: readonly CtsrItemId[] = [
  "agenda_setting",
  "collaboration",
  "guided_discovery",
  "feedback",
  "conceptual_integration",
  "eliciting_cognitions",
  "eliciting_emotion",
  "eliciting_behaviours",
  "change_methods",
  "interpersonal_effectiveness",
  "pacing",
  "homework",
];

type Source =
  | { kind: "checklist"; checks: PracticeCheckId[] }
  | { kind: "rubric"; ids: string[] };

/** Default-rubric ids from lib/ai/assessment.ts; per-avatar rubrics may differ. */
const CTSR_SOURCES: Record<CtsrItemId, Source> = {
  agenda_setting: {
    kind: "checklist",
    checks: ["mood_check", "bridge", "agenda", "homework_review"],
  },
  collaboration: { kind: "rubric", ids: ["alliance"] },
  guided_discovery: { kind: "rubric", ids: ["assessment", "interventions"] },
  feedback: { kind: "checklist", checks: ["summary", "feedback_elicited"] },
  conceptual_integration: { kind: "rubric", ids: ["clinical_formulation"] },
  eliciting_cognitions: {
    kind: "rubric",
    ids: ["assessment", "clinical_formulation"],
  },
  eliciting_emotion: { kind: "rubric", ids: ["alliance", "assessment"] },
  eliciting_behaviours: { kind: "rubric", ids: ["interventions"] },
  change_methods: { kind: "rubric", ids: ["interventions"] },
  interpersonal_effectiveness: { kind: "rubric", ids: ["alliance"] },
  pacing: { kind: "rubric", ids: ["structure"] },
  homework: { kind: "checklist", checks: ["homework_review", "homework_set"] },
};

export const CTSR_LIMITATIONS = [
  "Indicative mapping from VPsych rubric scores and transcript checks; not a CTS-R rating by a trained rater.",
  "Not validated. Do not quote as a CTS-R score or compare with published CTS-R thresholds.",
] as const;

function toSix(fraction: number): number {
  return Math.max(0, Math.min(6, Math.round(fraction * 6)));
}

function fromRubric(items: ScoreEntry[], ids: string[]): number | null {
  const matched = items.filter((i) => ids.includes(i.id) && i.max > 0);
  if (matched.length === 0) return null;
  const avg =
    matched.reduce((a, i) => a + Math.max(0, Math.min(1, i.score / i.max)), 0) /
    matched.length;
  return toSix(avg);
}

function fromChecklist(
  practice: SessionPracticeReport,
  ids: PracticeCheckId[],
): number | null {
  const relevant = practice.checks.filter(
    (c) => ids.includes(c.id) && c.applicable,
  );
  if (relevant.length === 0) return null;
  const met = relevant.filter((c) => c.detected).length;
  return toSix(met / relevant.length);
}

export function buildIndicativeCtsr(input: {
  items: ScoreEntry[];
  practice: SessionPracticeReport;
}): IndicativeCtsr {
  const items: CtsrItem[] = CTSR_ITEM_ORDER.map((id) => {
    const source = CTSR_SOURCES[id];
    const score =
      source.kind === "rubric"
        ? fromRubric(input.items, source.ids)
        : fromChecklist(input.practice, source.checks);
    return {
      id,
      score,
      source: score === null ? "none" : source.kind,
    };
  });
  const rated = items.filter((i) => i.score !== null).length;
  const total =
    rated === items.length
      ? items.reduce((a, i) => a + (i.score ?? 0), 0)
      : null;
  return {
    version: SESSION_PRACTICE_VERSION,
    items,
    rated,
    total,
    limitations: [...CTSR_LIMITATIONS],
  };
}
