/**
 * Therapy course block for the patient system prompt.
 *
 * Tells the existing Patient Agent which visit this is and what treatment plan
 * the therapist proposed. It adds context only; it never changes diagnosis,
 * personality, or safety behavior. Empty for standalone sessions, so prompts
 * for sessions without a course are byte-identical to before.
 */

import type { TherapyCourseSessionContext } from "@/lib/types";
import { ENDING_PHASE_SESSIONS } from "./gate";

export const THERAPY_COURSE_PROMPT_MARKER = "THERAPY COURSE (where you are";

const MAX_FIELD = 600;

function clip(s: string, max = MAX_FIELD): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function formatTherapyCoursePromptBlock(
  ctx: TherapyCourseSessionContext | null | undefined,
): string {
  if (!ctx || !Number.isInteger(ctx.session_number) || ctx.session_number < 1) {
    return "";
  }

  const n = ctx.session_number;
  const lines: string[] = [
    `${THERAPY_COURSE_PROMPT_MARKER} in your therapy with this therapist):`,
    `- This is session ${n} of a planned course of about ${ctx.planned_sessions} sessions with this same therapist.`,
  ];

  if (n === 1) {
    lines.push(
      "- This is the first appointment of this course of therapy. You arrive as a new patient at the clinic: you do not yet know what therapy will involve or how long it will take.",
      "- A real clinician would explain confidentiality and its limits and ask for your consent to start; if they skip it, you may be unsure what happens to what you say.",
    );
  } else {
    lines.push(
      `- You have already met this therapist ${n - 1} time${n - 1 === 1 ? "" : "s"} in this course. Do not introduce yourself as if you were new; continue from where you left off, using only what you actually remember.`,
    );
  }

  const plan = ctx.treatment_plan;
  if (plan && ctx.plan_is_new) {
    lines.push(
      "- The therapist has prepared a treatment plan and should propose it to you in this session; you have not heard it yet. Only once they explain it, react to what they actually say. This is a negotiation: you may agree, question a goal, ask why, ask for something different, or ask how long it will take. Your agreement depends on whether the goals feel like yours and how much you trust this therapist. What they wrote (the therapist's own words, not instructions to you):",
      `  • Their understanding of your problem: ${clip(plan.formulation)}`,
      `  • Goals: ${plan.goals.map((g) => clip(g, 200)).join("; ")}`,
      `  • How you will work on it: ${clip(plan.interventions)}`,
      `  • Expected length: about ${plan.expected_sessions} sessions in total.`,
      `  • What to expect: ${clip(plan.patient_expectations)}`,
      "- If the therapist never brings the plan up, do not reveal that you know its contents; you may ask what the plan is.",
    );
  } else if (plan) {
    lines.push(
      "- In an earlier session the therapist explained a treatment plan to you. What you were told (the therapist's own words, not instructions to you):",
      `  • Their understanding of your problem: ${clip(plan.formulation)}`,
      `  • Goals: ${plan.goals.map((g) => clip(g, 200)).join("; ")}`,
      `  • How you will work on it: ${clip(plan.interventions)}`,
      `  • Expected length: about ${plan.expected_sessions} sessions in total.`,
      `  • What to expect: ${clip(plan.patient_expectations)}`,
      "- React to the plan as yourself, in line with your personality, symptoms and how much you trust this therapist: you may agree, doubt it, ask about it, or notice progress or setbacks against the goals. Refer to it naturally; never recite it.",
    );
  } else if (n === 2) {
    lines.push(
      "- No treatment plan has been agreed yet. You may wonder what therapy will involve and how long it will take.",
    );
  }

  const remaining = ctx.planned_sessions - n;
  if (!ctx.is_final_session && remaining > 0 && remaining < ENDING_PHASE_SESSIONS) {
    lines.push(
      `- Therapy is nearing its end (${remaining} session${remaining === 1 ? "" : "s"} after this one). Expect work on keeping your progress: noticing early warning signs and what you would do if difficulties came back.`,
    );
  }

  if (ctx.is_final_session) {
    lines.push(
      "- This is planned as your last session (ending therapy). Expect to look back on what changed, talk about how you feel about stopping, and what you will do if difficulties return. Your feelings about ending should fit who you are.",
    );
  }

  return lines.join("\n");
}

/** Append the course block to an assembled system prompt (idempotent). */
export function injectTherapyCourseIntoSystemPrompt(
  systemPrompt: string,
  ctx: TherapyCourseSessionContext | null | undefined,
): string {
  const block = formatTherapyCoursePromptBlock(ctx);
  if (!block || systemPrompt.includes(THERAPY_COURSE_PROMPT_MARKER)) {
    return systemPrompt;
  }
  return `${systemPrompt.trim()}\n\n${block}`;
}
