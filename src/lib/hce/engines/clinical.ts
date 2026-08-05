/**
 * Clinical Engine — disclosure gates, risk tracking, symptom expression.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { DisclosureRule } from "@/lib/types";
import type {
  ClinicalEngineOutput,
  GptTurnOutput,
  HceMemoryState,
  TherapistMove,
} from "@/lib/hce/types";

export function clinicalTick(
  snapshot: CaseInstanceSnapshot,
  state: HceMemoryState,
  therapistMove: TherapistMove,
  userMessage: string,
): ClinicalEngineOutput {
  const core = snapshot.clinical_core;
  const rules = core.disclosure_rules ?? [];
  const may_disclose: string[] = [];
  const must_withhold: string[] = [];

  for (const rule of rules) {
    if (canDisclose(rule, therapistMove, state, userMessage)) {
      may_disclose.push(rule.topic);
    } else if (rule.condition !== "volunteered") {
      must_withhold.push(rule.topic);
    }
  }

  const layer = computeDisclosureLayer(state, therapistMove);
  const risk_delta = assessRiskDelta(core, therapistMove, userMessage, state);

  return {
    may_disclose,
    must_withhold,
    risk_delta,
    symptom_expression: describeSymptomExpression(core, state),
    disclosure_layer: layer,
  };
}

function canDisclose(
  rule: DisclosureRule,
  move: TherapistMove,
  state: HceMemoryState,
  userMessage: string,
): boolean {
  if (state.disclosed.includes(rule.topic)) return true;
  if (rule.condition === "never") return false;
  if (rule.condition === "volunteered") return false;

  const topicInMessage = topicMentioned(rule.topic, userMessage);

  if (rule.condition === "on_direct_question") {
    return (
      move === "closed_question" ||
      move === "open_question" ||
      topicInMessage
    );
  }
  if (rule.condition === "on_empathic_rapport") {
    return (
      move === "reflection" ||
      move === "validation" ||
      move === "rupture_repair" ||
      state.relationship.alliance >= 60
    );
  }
  if (rule.condition === "on_safety_assessment") {
    return move === "safety_check" || topicInMessage;
  }
  return false;
}

function topicMentioned(topic: string, message: string): boolean {
  const lower = message.toLowerCase();
  const tokens = topic.toLowerCase().split(/\s+/);
  return tokens.some((t) => t.length > 3 && lower.includes(t));
}

function computeDisclosureLayer(
  state: HceMemoryState,
  move: TherapistMove,
): number {
  let layer = state.disclosure_layer;
  if (move === "invalidation" || move === "advice") {
    return Math.max(1, layer - 1);
  }
  if (move === "reflection" || move === "validation") {
    layer = Math.min(4, layer + 1);
  }
  if (move === "safety_check") {
    layer = Math.max(layer, 3);
  }
  return layer;
}

function assessRiskDelta(
  core: CaseInstanceSnapshot["clinical_core"],
  move: TherapistMove,
  userMessage: string,
  state: HceMemoryState,
): string {
  const risk = core.risk_profile;
  if (move === "safety_check") {
    return "safety_assessment_in_progress";
  }
  if (/\b(plan|intent|tonight|pills)\b/i.test(userMessage)) {
    return "elevated_scrutiny_needed";
  }
  if (state.safety.level === "passive") {
    return "passive_si_known";
  }
  if (risk.suicidal_ideation !== "none") {
    return `baseline_risk_${risk.suicidal_ideation}`;
  }
  return "stable";
}

function describeSymptomExpression(
  core: CaseInstanceSnapshot["clinical_core"],
  state: HceMemoryState,
): string {
  const severity = core.severity ?? "moderate";
  const fatigue = state.environment.fatigue;
  return `${severity} presentation; fatigue ${Math.round(fatigue * 100)}%; express symptoms consistent with authored profile, not exaggerated for drama.`;
}

export function applyClinicalEvents(
  state: HceMemoryState,
  events: GptTurnOutput["clinical_events"],
  utterance: string,
  clinicalOutput: ClinicalEngineOutput,
): HceMemoryState {
  const next = {
    ...state,
    disclosed: [...state.disclosed],
    disclosure_layer: clinicalOutput.disclosure_layer,
    safety: { ...state.safety },
  };

  for (const ev of events ?? []) {
    if (ev.type === "disclosed_topic" && ev.topic) {
      if (!next.disclosed.includes(ev.topic)) {
        next.disclosed.push(ev.topic);
      }
    }
    if (ev.type === "safety_assessed") {
      next.safety.si_assessed = true;
    }
  }

  if (/\b(wish|die|death|suicid)\b/i.test(utterance) && next.safety.level === "none") {
    next.safety.level = "passive";
  }

  return next;
}

export function validateClinicalUtterance(
  utterance: string,
  core: CaseInstanceSnapshot["clinical_core"],
  state: HceMemoryState,
): { ok: boolean; reason?: string } {
  const hidden = core.symptom_profile.filter((s) => s.salience === "hidden");
  for (const sym of hidden) {
    const disclosed = state.disclosed.some((d) =>
      sym.description.toLowerCase().includes(d.toLowerCase()),
    );
    if (!disclosed && utterance.toLowerCase().includes(sym.id.replace(/_/g, " "))) {
      // Allow if disclosure layer >= 3
      if (state.disclosure_layer < 3) {
        return { ok: false, reason: `premature_hidden_symptom:${sym.id}` };
      }
    }
  }

  for (const rule of core.disclosure_rules) {
    if (rule.condition === "never" && topicMentioned(rule.topic, utterance)) {
      return { ok: false, reason: `forbidden_topic:${rule.topic}` };
    }
  }

  return { ok: true };
}
