/**
 * Observable best-practice checklist for one session transcript.
 * Pure and deterministic; reads therapist turns only.
 */

import {
  PRACTICE_PATTERNS,
  type PracticeWindow,
} from "@/lib/session-practice/patterns";
import {
  SESSION_PRACTICE_VERSION,
  type PracticeCheck,
  type PracticeCheckId,
  type PracticeGroup,
  type PracticeGroupSummary,
  type SessionPracticeInput,
  type SessionPracticeReport,
} from "@/lib/session-practice/types";

const GROUP_ORDER: readonly PracticeGroup[] = [
  "intake",
  "consent",
  "structure",
  "safety_plan",
  "measures",
];

/** Checks that only make sense once there is a previous session to refer to. */
const FOLLOW_UP_ONLY: ReadonlySet<PracticeCheckId> = new Set([
  "bridge",
  "homework_review",
]);

export const SESSION_PRACTICE_LIMITATIONS = [
  "Phrase matching on therapist turns only; it records whether a practice was visibly attempted, not how well.",
  "Not a validated instrument. Use as a prompt for supervision, never as a grade on its own.",
] as const;

/** Opening/closing windows: about a third of therapist turns, at least 3. */
export function windowRange(
  window: PracticeWindow,
  turnCount: number,
): [number, number] {
  if (window === "any" || turnCount === 0) return [0, turnCount];
  const span = Math.min(turnCount, Math.max(3, Math.ceil(turnCount * 0.35)));
  return window === "opening" ? [0, span] : [turnCount - span, turnCount];
}

function isFirstContact(sessionNumber: number | null | undefined): boolean {
  return sessionNumber == null || sessionNumber <= 1;
}

function isApplicable(
  id: PracticeCheckId,
  group: PracticeGroup,
  input: SessionPracticeInput,
): boolean {
  switch (group) {
    case "intake":
    case "consent":
      return isFirstContact(input.sessionNumber);
    case "structure":
      return FOLLOW_UP_ONLY.has(id)
        ? (input.sessionNumber ?? 0) > 1
        : true;
    case "safety_plan":
      return input.riskPresent === true;
    case "measures":
      // Reported for supervision; not expected in every session.
      return false;
  }
}

export function evaluateSessionPractice(
  input: SessionPracticeInput,
): SessionPracticeReport {
  const therapistTurns = input.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content ?? "");

  const checks: PracticeCheck[] = PRACTICE_PATTERNS.map((p) => {
    const [from, to] = windowRange(p.window, therapistTurns.length);
    let turn_index: number | null = null;
    for (let i = from; i < to; i++) {
      if (p.pattern.test(therapistTurns[i]!)) {
        turn_index = i;
        break;
      }
    }
    return {
      id: p.id,
      group: p.group,
      detected: turn_index !== null,
      applicable: isApplicable(p.id, p.group, input),
      turn_index,
      excerpt:
        turn_index === null ? null : therapistTurns[turn_index]!.slice(0, 180),
    };
  });

  const groups: PracticeGroupSummary[] = GROUP_ORDER.map((group) => {
    const applicable = checks.filter((c) => c.group === group && c.applicable);
    const met = applicable.filter((c) => c.detected).length;
    return {
      group,
      applicable: applicable.length > 0,
      met,
      total: applicable.length,
      coverage: applicable.length > 0 ? met / applicable.length : null,
    };
  });

  return {
    version: SESSION_PRACTICE_VERSION,
    checks,
    groups,
    limitations: [...SESSION_PRACTICE_LIMITATIONS],
  };
}

/** True when the case profile carries suicidal ideation or self-harm. */
export function caseHasRisk(
  riskProfile:
    | { suicidal_ideation?: string | null; self_harm?: boolean | null }
    | null
    | undefined,
): boolean {
  if (!riskProfile) return false;
  const si = riskProfile.suicidal_ideation;
  return (si != null && si !== "none") || riskProfile.self_harm === true;
}
