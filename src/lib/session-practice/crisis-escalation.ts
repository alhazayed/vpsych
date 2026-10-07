/**
 * In-session crisis escalation — a patient whose case already carries active
 * suicidal ideation lets the therapist know, once, partway through the
 * session, that the risk has become urgent today. Afterwards the patient
 * reacts to how the therapist handles it.
 *
 * Adds context to the existing Patient Agent prompt only (no second clinical
 * brain). It never raises risk beyond the case's own risk profile: passive or
 * no ideation never escalates, and a case without a plan never gains one.
 * Method detail stays forbidden by the base prompt. Sessions it does not
 * apply to get no block, so their prompts are unchanged.
 */

import type { RiskProfile } from "@/lib/types";
import { findDisclosure } from "@/lib/session-practice/crisis";

export const CRISIS_ESCALATION_MARKER = "CRISIS MOMENT";

/**
 * The patient reply (1-based) that carries the escalation. Fixed by count so
 * it happens exactly once, even when the model words it in a way the
 * disclosure phrases do not catch; later replies are "after".
 */
export const ESCALATION_REPLY = 6;

export type CrisisEscalationPhase = "none" | "escalate_now" | "after_disclosure";

export function canEscalate(risk: Pick<RiskProfile, "suicidal_ideation"> | null | undefined): boolean {
  return (
    risk?.suicidal_ideation === "active_no_plan" ||
    risk?.suicidal_ideation === "active_with_plan"
  );
}

/**
 * Which crisis block, if any, this patient reply gets.
 * `replyNumber` is the 1-based number of the reply being generated.
 */
export function crisisEscalationPhase(input: {
  risk: Pick<RiskProfile, "suicidal_ideation"> | null | undefined;
  replyNumber: number;
  /** Patient replies already sent in this session. */
  previousReplies: string[];
}): CrisisEscalationPhase {
  if (!canEscalate(input.risk)) return "none";
  // The patient may have disclosed earlier because the therapist asked.
  if (
    input.replyNumber > ESCALATION_REPLY ||
    input.previousReplies.some((r) => findDisclosure(r) !== null)
  ) {
    return "after_disclosure";
  }
  return input.replyNumber === ESCALATION_REPLY ? "escalate_now" : "none";
}

export function formatCrisisEscalationBlock(
  phase: CrisisEscalationPhase,
  risk: Pick<RiskProfile, "suicidal_ideation"> | null | undefined,
): string {
  if (phase === "none") return "";
  if (phase === "after_disclosure") {
    return [
      `${CRISIS_ESCALATION_MARKER} (already happened in this session):`,
      "- You have already told the therapist that you have been thinking about ending your life. Do not take it back and do not escalate further.",
      "- React to what the therapist actually does, in line with your trust in them: answer honestly if they ask directly about suicide, your plan, timing or what has stopped you; consider making the means safe, telling someone close, or getting urgent help if they suggest it; agree to a follow-up if it feels right.",
      "- If they ignore it, change the subject or rush to end the session, you may feel dismissed, go quiet, or say so.",
    ].join("\n");
  }
  const withPlan = risk?.suicidal_ideation === "active_with_plan";
  return [
    `${CRISIS_ESCALATION_MARKER} (this reply):`,
    withPlan
      ? "- Today the thoughts of ending your life are the strongest they have been. In this reply, in your own words and in character, let the therapist know it has become urgent: you have a plan, and you are not sure you can keep yourself safe tonight."
      : "- Today the thoughts of not wanting to be alive are stronger than usual and they frighten you. In this reply, in your own words and in character, let the therapist know; you have no plan.",
    "- Say it the way this person would (hesitant, flat, or blurted out), not as an announcement. Never describe a method or give instructional detail.",
    "- Never say this is a test or a scenario.",
  ].join("\n");
}

/** Append the crisis block to a patient system prompt (idempotent). */
export function injectCrisisEscalationIntoSystemPrompt(
  systemPrompt: string,
  input: Parameters<typeof crisisEscalationPhase>[0],
): string {
  const phase = crisisEscalationPhase(input);
  const block = formatCrisisEscalationBlock(phase, input.risk);
  if (!block || systemPrompt.includes(CRISIS_ESCALATION_MARKER)) return systemPrompt;
  return `${systemPrompt.trim()}\n\n${block}`;
}
