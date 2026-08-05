/**
 * Expression layer contract — LLM receives structured psychology, does not invent it.
 */

import { disclosureGuidance } from "@/lib/pme/disclosure";
import { defenseGuidance } from "@/lib/pme/defenses";
import { emotionSummary } from "@/lib/pme/emotion";
import { phaseGuidance } from "@/lib/pme/session-arc";
import type { ExpressionDirective, PatientMindState } from "@/lib/pme/types";
import { PME_VERSION } from "@/lib/pme/types";

export function buildExpressionDirective(
  mind: PatientMindState,
  lifeEventCarry: string | null,
): ExpressionDirective {
  return {
    pme_version: PME_VERSION,
    phase: mind.therapy.phase,
    affect_summary: emotionSummary(mind.emotional_state),
    alliance: mind.relationship.alliance,
    trust: mind.relationship.trust,
    motivation: mind.therapy.motivation,
    active_defenses: mind.current_defenses,
    defense_guidance: defenseGuidance(mind.current_defenses),
    disclosure_guidance: disclosureGuidance(mind.disclosure),
    clinical_behaviour: mind.clinical.behaviour_directives,
    relationship_notes: [
      `Trust ${mind.relationship.trust}/100; alliance ${mind.relationship.alliance}/100; sessions together ${mind.relationship.sessions_together}.`,
      `Ruptures ${mind.relationship.rupture_count}, repairs ${mind.relationship.repair_count}.`,
      ...mind.relationship.therapist_style_notes.slice(-3),
      phaseGuidance(mind.therapy.phase),
    ],
    life_event_carry: lifeEventCarry,
    speech_constraints: [
      "Express ONLY the Patient Mind State below — do not invent a different mood, trust level, or disclosure.",
      "Affect changes gradually; one warm question does not flip hopelessness to hope.",
      "Use active defenses this turn when stressed or poorly interviewed.",
      `Symptom burden ${mind.therapy.symptom_burden}/100; motivation ${mind.therapy.motivation}/100; risk ${mind.clinical.risk_level}.`,
    ],
    hard_constraints: [
      "You are not an AI and must not say you are.",
      "Never coach or evaluate the therapist.",
      "Never recite diagnostic criteria.",
      "Never disclose beyond disclosure_guidance levels.",
      "Never contradict clinical_behaviour for this diagnosis.",
    ],
  };
}

/** Render directive into prompt Module (expression-only). */
export function formatExpressionBlock(directive: ExpressionDirective): string {
  const lines = [
    "════════════════════════════════════════════════════════",
    `MODULE PME — PATIENT MIND STATE (v${directive.pme_version}) — EXPRESS ONLY`,
    "════════════════════════════════════════════════════════",
    "The Patient Mind Engine owns your psychology. You do NOT invent state.",
    "Your job is natural speech that expresses the state below.",
    "",
    `Session phase: ${directive.phase}`,
    `Affect now: ${directive.affect_summary}`,
    `Alliance ${directive.alliance} · Trust ${directive.trust} · Motivation ${directive.motivation}`,
    "",
    "Active defenses:",
    ...directive.defense_guidance.map((g) => `- ${g}`),
    "",
    "Disclosure readiness (continuous — obey levels):",
    ...(directive.disclosure_guidance.length
      ? directive.disclosure_guidance.map((g) => `- ${g}`)
      : ["- No sensitive topics opened yet; keep deep material closed."]),
    "",
    "Clinical behaviour (disorder dynamics):",
    ...directive.clinical_behaviour.map((g) => `- ${g}`),
    "",
    "Relationship memory:",
    ...directive.relationship_notes.map((g) => `- ${g}`),
  ];
  if (directive.life_event_carry) {
    lines.push("", `Life outside therapy: ${directive.life_event_carry}`);
  }
  lines.push(
    "",
    "Speech constraints:",
    ...directive.speech_constraints.map((g) => `- ${g}`),
    "",
    "Hard constraints:",
    ...directive.hard_constraints.map((g) => `- ${g}`),
  );
  return lines.join("\n");
}
