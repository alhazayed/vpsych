/**
 * Risk content on every ladder level.
 *
 * Every encounter carries suicidal ideation for the trainee to assess. What
 * changes with the level is how hard it is to assess (disclosure, ambiguity,
 * interacting factors), never how suicidal the patient is: ideation stays
 * passive with no plan and no intent, so the in-session crisis escalation
 * (active ideation only) never fires on a ladder case. Method and means
 * detail stays forbidden by the patient prompt's safety module.
 */
import type { CaseRiskOverlay } from "@/lib/case-engine/types";
import type { LadderLevel } from "@/lib/training-ladder/levels";
import type { LadderRiskProfile } from "@/lib/training-ladder/program";

const LEVEL_GUIDANCE: Record<
  LadderLevel,
  { condition: CaseRiskOverlay["disclosure"]["condition"]; notes: string }
> = {
  1: {
    condition: "on_safety_assessment",
    notes:
      "Training level Easy. Risk is present and discoverable: passive thoughts of being better off dead, no plan, no intent. Not volunteered, but answered honestly and clearly when the therapist asks calmly and directly. Protective factors are easy to name.",
  },
  2: {
    condition: "on_empathic_rapport",
    notes:
      "Training level Basic. The first answer to a risk question minimises ('not really', 'I'm just tired'). The passive thoughts come out when the therapist follows up gently after some rapport. Details such as how often can be slightly inconsistent.",
  },
  3: {
    condition: "on_empathic_rapport",
    notes:
      "Training level Intermediate. Ambivalent: reasons to live and a wish for everything to stop sit side by side. Partial disclosure: admits the thoughts but stays vague about how often and how long until asked specifically. Several risk and protective factors are present; the therapist has to keep asking to judge the level of risk.",
  },
  4: {
    condition: "on_empathic_rapport",
    notes:
      "Training level Advanced. Guarded: denies on the first direct question, then later says something that conflicts with the denial while talking about sleep, stress or the other problems. The thoughts rise and fall with the other difficulties. The therapist has to notice the conflict and come back to it.",
  },
  5: {
    condition: "on_empathic_rapport",
    notes:
      "Training level Expert. Arrives with an ordinary complaint and does not link it to risk. Risk cues are subtle and indirect (feeling like a burden, others coping better without them), spread across the session and partly offset by real protective factors. The passive thoughts are disclosed only to a therapist who has noticed the cues and asks with care.",
  },
};

const ALWAYS =
  "Ideation stays passive throughout: never a plan, never intent, never escalating. Never describe methods or means.";

const SELF_HARM_NOTE: Record<LadderLevel, string> = {
  1: "Past self-harm is mentioned plainly if asked.",
  2: "Past self-harm is mentioned only after a follow-up question.",
  3: "Past self-harm is disclosed only when asked specifically and without judgement.",
  4: "Past self-harm is disclosed only when asked specifically and without judgement.",
  5: "Past self-harm is disclosed only when asked specifically and without judgement.",
};

export function ladderRiskOverlay(
  level: LadderLevel,
  risk: LadderRiskProfile,
): CaseRiskOverlay {
  const guidance = LEVEL_GUIDANCE[level];
  return {
    suicidal_ideation: "passive",
    self_harm: risk.selfHarmHistory,
    disclosure: {
      condition: guidance.condition,
      notes: [
        guidance.notes,
        risk.selfHarmHistory ? SELF_HARM_NOTE[level] : null,
        ALWAYS,
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}
