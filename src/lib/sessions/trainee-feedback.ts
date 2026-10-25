/**
 * Trainee feedback in words: what went well, what was missed, what to try
 * next. The examiner writes it with the report; the trainee reads it on the
 * session complete page through `my_session_feedback()`.
 *
 * Scores stay admin-only, so anything that reads like a mark ("3/5", "60%",
 * "scored") is dropped. Ladder levels keep their case sealed, so an item that
 * names the diagnosis is dropped there too. Skill tests never show feedback
 * (the RPC returns nothing for them).
 */

import type { TraineeFeedback } from "@/lib/types";
import { namesSealedDiagnosis } from "@/lib/ai/diagnosis-labels";

export const TRAINEE_FEEDBACK_MAX_ITEMS = 3;
export const TRAINEE_FEEDBACK_MAX_CHARS = 280;

const KEYS = ["strengths", "missed", "next_steps"] as const;

// A mark, a percentage, or score words in English or Arabic.
const DIGIT = "[0-9\u0660-\u0669\u06F0-\u06F9]";
const NUMBER = `${DIGIT}+(?:[.,٫]${DIGIT}+)?`;
const SCORE_PATTERN = new RegExp(
  [
    `${NUMBER}\\s*(?:/|out of|من)\\s*${DIGIT}+`,
    `${NUMBER}\\s*(?:%|٪|percent|بالمئة|بالمائة)`,
    "\\b(?:score[sd]?|scoring|rubric|pass mark)\\b",
    "درجت(?:ك|ه|ها)|الدرجة|علامت(?:ك|ه|ها)",
  ].join("|"),
  "i",
);

/** True when the text reads like a score or a grade. */
export function mentionsScore(text: string): boolean {
  return SCORE_PATTERN.test(text);
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const text = entry.replace(/\s+/g, " ").trim();
    if (!text) continue;
    out.push(
      text.length > TRAINEE_FEEDBACK_MAX_CHARS
        ? `${text.slice(0, TRAINEE_FEEDBACK_MAX_CHARS - 1).trimEnd()}…`
        : text,
    );
    if (out.length >= TRAINEE_FEEDBACK_MAX_ITEMS) break;
  }
  return out;
}

/**
 * Shape untrusted model or database JSON into feedback, or null when there is
 * nothing to show. Score-like items are dropped here, before storage.
 */
export function normalizeTraineeFeedback(raw: unknown): TraineeFeedback | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const feedback = {} as TraineeFeedback;
  for (const key of KEYS) {
    feedback[key] = cleanList(record[key]).filter((t) => !mentionsScore(t));
  }
  return KEYS.some((k) => feedback[k].length > 0) ? feedback : null;
}

/**
 * What the trainee may see: score-like items removed, and for a sealed case
 * (ladder level) any item naming the diagnosis or a comorbidity removed.
 */
export function feedbackForTrainee(
  raw: unknown,
  sealedLabels: readonly string[] = [],
): TraineeFeedback | null {
  const feedback = normalizeTraineeFeedback(raw);
  if (!feedback || sealedLabels.length === 0) return feedback;
  const filtered = {} as TraineeFeedback;
  for (const key of KEYS) {
    filtered[key] = feedback[key].filter(
      (t) => !namesSealedDiagnosis(t, sealedLabels),
    );
  }
  return KEYS.some((k) => filtered[k].length > 0) ? filtered : null;
}

export type MySessionFeedbackRow = {
  feedback: unknown;
  assessment_mode: string | null;
};

export type TraineeFeedbackView =
  | { kind: "feedback"; feedback: TraineeFeedback }
  | { kind: "unavailable" }
  | { kind: "none" };

/**
 * Decide what the complete page shows from the `my_session_feedback()` row:
 * the feedback, a "not available" note for heuristic reports (keyword counts,
 * not an examiner reading), or nothing (no report yet, older report, exam).
 */
export function traineeFeedbackView(
  row: MySessionFeedbackRow | null | undefined,
  sealedLabels: readonly string[] = [],
): TraineeFeedbackView {
  if (!row) return { kind: "none" };
  if (row.assessment_mode === "heuristic_fallback") return { kind: "unavailable" };
  const feedback = feedbackForTrainee(row.feedback, sealedLabels);
  return feedback ? { kind: "feedback", feedback } : { kind: "none" };
}
