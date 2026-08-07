/**
 * Expression layer — translate adaptation state into enactable prompt directives.
 * The LLM expresses this; it must not invent psychology beyond these cues.
 */

import type {
  AdaptationDirective,
  PatientAdaptationState,
} from "@/lib/adaptation/types";

export function buildAdaptationDirective(
  state: PatientAdaptationState,
): AdaptationDirective {
  const { stance, rapport, trust, effects } = state;
  const enact: string[] = [];

  enact.push(
    `Current stance: ${stance}. Rapport ${Math.round(rapport.level)}/100 (velocity ${rapport.velocity.toFixed(2)}). Trust ${Math.round(trust.level)}/100.`,
  );

  if (effects.withdrawal >= 55) {
    enact.push(
      "Withdraw: shorter answers, polite distance, topic shifts, less eye-contact-in-language. Do not punish; quietly close depth.",
    );
  } else if (effects.withdrawal >= 40) {
    enact.push(
      "Guarded: answer the question asked, soft-minimise feeling, leave one door ajar if the therapist earns it.",
    );
  }

  if (effects.anger >= 50) {
    enact.push(
      "Angry from interruption/pressure: clipped tone, mild irritation, or testing ('you didn't let me finish'). Do not rant or leave character.",
    );
  } else if (effects.anger >= 30) {
    enact.push("Low simmer: slightly sharper edges; recover if they repair.");
  }

  if (effects.disclosure_readiness >= 62 && trust.level >= 50) {
    enact.push(
      "Earlier disclosure unlocked by empathy/rapport: you may open ONE deeper layer if asked plainly — still no dump, no DSM lecture.",
    );
  } else if (effects.disclosure_readiness < 35) {
    enact.push(
      "Disclosure locked: surface only. Deep material stays closed this turn.",
    );
  }

  if (rapport.velocity >= 1.4 && signalsWarm(state)) {
    enact.push(
      "Rapport is accelerating under warmth — soften slightly faster than early session, still human and uneven.",
    );
  }

  if (stance === "reparable") {
    enact.push(
      "They are repairing a rupture — notice it, soften a notch, do not instantly flood with trust.",
    );
  }

  if (state.session_index > 1) {
    enact.push(
      `Treatment continuity (session ${state.session_index}): you remember this therapist's style from prior work. Trust/rapport carry forward; do not reset to stranger-cold unless ruptured.`,
    );
  }

  enact.push(
    "Never coach or evaluate the therapist. Never name 'rapport score' or 'trust level' aloud.",
  );

  return {
    stance,
    rapport: rapport.level,
    trust: trust.level,
    withdrawal: effects.withdrawal,
    anger: effects.anger,
    disclosure_readiness: effects.disclosure_readiness,
    engagement: effects.engagement,
    enact,
  };
}

function signalsWarm(state: PatientAdaptationState): boolean {
  const last = state.turn_traces[state.turn_traces.length - 1];
  return Boolean(last?.cues.includes("warmth"));
}

/**
 * Prompt Module ADAPTATION block injected into the patient system prompt.
 */
export function formatAdaptationBlock(directive: AdaptationDirective): string {
  const lines = [
    "MODULE ADAPTATION — Patient Adaptation Engine (Mission 8)",
    "Enact the patient's live reaction to THIS therapist turn. Do not narrate scores.",
    `- Stance: ${directive.stance}`,
    `- Rapport ${Math.round(directive.rapport)} · Trust ${Math.round(directive.trust)} · Withdrawal ${Math.round(directive.withdrawal)} · Anger ${Math.round(directive.anger)} · Disclosure readiness ${Math.round(directive.disclosure_readiness)} · Engagement ${Math.round(directive.engagement)}`,
    "Behavioural directives:",
    ...directive.enact.map((e) => `- ${e}`),
  ];
  return lines.join("\n");
}
