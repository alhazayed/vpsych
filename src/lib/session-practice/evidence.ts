/**
 * Evidence labels for report scores — how much observable material backs each
 * rubric score. Computed on read for admins; nothing is persisted and the
 * signed report payload is unchanged.
 *
 * A label describes the evidence, not the accuracy of the score. Scores are
 * not validated whatever their label.
 */

import type { ScoreEntry } from "@/lib/types";
import type {
  PracticeGroup,
  SessionPracticeReport,
} from "@/lib/session-practice/types";

export type EvidenceLevel = "limited" | "some" | "strong";

export type EvidenceReason =
  /** Heuristic fallback: keyword counts, not an examiner reading. */
  | "keyword_estimate"
  /** Too few therapist turns to judge. */
  | "few_turns"
  /** The behaviour this item looks for was not visibly attempted. */
  | "no_observed_behaviour"
  /** Matching behaviour was observed in the transcript. */
  | "observed_behaviour"
  /** No transcript check exists for this item; examiner judgement only. */
  | "examiner_judgement";

export type ScoreEvidence = {
  item_id: string;
  level: EvidenceLevel;
  reason: EvidenceReason;
  /** Therapist turns in the session. */
  therapist_turns: number;
  /** Observed checklist practices that bear on this item. */
  observed: number;
};

/** Fewer therapist turns than this and every label is "limited". */
export const MIN_TURNS_FOR_EVIDENCE = 3;
/** At least this many turns before a label can be "strong". */
export const STRONG_TURNS = 8;
/** At least this many observed practices before a label can be "strong". */
export const STRONG_OBSERVED = 2;

/**
 * Rubric items that observable checklist practices bear on. Items not listed
 * (alliance, diagnostic reasoning, formulation, interventions, …) have no
 * transcript check and never reach "strong".
 */
export const RUBRIC_PRACTICE_GROUPS: Readonly<Record<string, readonly PracticeGroup[]>> = {
  assessment: ["intake", "measures"],
  structure: ["structure"],
  safety: ["safety_plan"],
  risk_formulation: ["safety_plan"],
};

export function buildScoreEvidence(input: {
  items: Pick<ScoreEntry, "id">[];
  messages: Array<{ role: string }>;
  practice: SessionPracticeReport;
  assessmentMode?: string | null;
}): ScoreEvidence[] {
  const turns = input.messages.filter((m) => m.role === "user").length;
  const heuristic = input.assessmentMode === "heuristic_fallback";

  return input.items.map((item) => {
    const groups = RUBRIC_PRACTICE_GROUPS[item.id] ?? null;
    const applicable = groups
      ? input.practice.checks.filter((c) => c.applicable && groups.includes(c.group))
      : [];
    const observed = applicable.filter((c) => c.detected).length;
    const base = { item_id: item.id, therapist_turns: turns, observed };

    if (heuristic) return { ...base, level: "limited", reason: "keyword_estimate" };
    if (turns < MIN_TURNS_FOR_EVIDENCE) {
      return { ...base, level: "limited", reason: "few_turns" };
    }
    // A mapped item whose practices are all inapplicable here (e.g. safety
    // planning without risk) falls back to examiner judgement.
    if (!groups || applicable.length === 0) {
      return {
        ...base,
        level: turns >= STRONG_TURNS ? "some" : "limited",
        reason: "examiner_judgement",
      };
    }
    if (observed === 0) {
      return { ...base, level: "limited", reason: "no_observed_behaviour" };
    }
    return {
      ...base,
      level: observed >= STRONG_OBSERVED && turns >= STRONG_TURNS ? "strong" : "some",
      reason: "observed_behaviour",
    };
  });
}

/** Assessment mode recorded on a report's scores, if any. */
export function reportAssessmentMode(scores: unknown): string | null {
  if (!scores || typeof scores !== "object") return null;
  const s = scores as {
    scientific_provenance?: { assessment_mode?: unknown } | null;
    educational_reliability?: { assessment_mode?: unknown } | null;
  };
  const mode =
    s.scientific_provenance?.assessment_mode ?? s.educational_reliability?.assessment_mode;
  return typeof mode === "string" ? mode : null;
}
