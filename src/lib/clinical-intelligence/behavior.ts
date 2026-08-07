/**
 * BehaviorProfile DTO — computed from DecisionPlan + CBE (no parallel engine).
 */

import type { ConversationBehaviourPlan } from "@/lib/conversation-behaviour/types";
import type {
  BehaviorProfile,
  PatientDecisionPlan,
} from "@/lib/clinical-intelligence/types";

export function buildBehaviorProfile(input: {
  plan: PatientDecisionPlan;
  behaviour?: ConversationBehaviourPlan | null;
  patternTags?: string[];
  engagement?: number;
}): BehaviorProfile {
  return {
    pattern_tags: input.patternTags ?? [],
    disclosure: input.plan.disclosure,
    act: input.plan.act,
    stance: input.plan.stance,
    affect_mode: input.plan.affect_mode,
    engagement: input.engagement,
    secondary_acts: input.behaviour?.secondary,
  };
}
