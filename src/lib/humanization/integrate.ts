/**
 * Integration helpers — prompt injection + message-route wiring.
 */

import type { PromptFidelityHints } from "@/lib/ai/prompt-engine";
import type { HumanizationTurnPlan } from "@/lib/humanization/types";

/**
 * Merge humanization Module-1 cue into fidelity hints without clobbering
 * speech/therapy-process cues already attached by resolveAvatar.
 */
export function mergeHumanizationFidelity(
  fidelity: PromptFidelityHints | undefined,
  plan: HumanizationTurnPlan | null,
): PromptFidelityHints | undefined {
  if (!plan) return fidelity;
  const base = fidelity ?? {};
  const existing = base.therapy_process_cue?.trim() ?? "";
  const therapy_process_cue = existing
    ? `${existing}\n\n${plan.prompt_cue}`
    : plan.prompt_cue;
  return {
    ...base,
    therapy_process_cue,
    humanization_cue: plan.prompt_cue,
  };
}

/**
 * Append per-turn humanization reinforcement to the patient-agent user turn.
 */
export function appendHumanizationReinforcement(
  userMessage: string,
  existingReinforcement: string | undefined,
  plan: HumanizationTurnPlan | null,
): { messageForModel: string; reinforcement: string | undefined } {
  if (!plan) {
    return {
      messageForModel: existingReinforcement
        ? `${userMessage}\n\n${existingReinforcement}`
        : userMessage,
      reinforcement: existingReinforcement,
    };
  }
  const parts = [existingReinforcement?.trim(), plan.per_turn_cue].filter(
    Boolean,
  ) as string[];
  const reinforcement = parts.join("\n");
  return {
    messageForModel: `${userMessage}\n\n${reinforcement}`,
    reinforcement,
  };
}
