/**
 * Module 1 fidelity formatters for Clinical Intelligence objects.
 * Patient-language paraphrases only — never dump DSM criteria or announce labels.
 */

import type {
  MentalStatusExam,
  PatientDecisionPlan,
  PatientFormulation,
  ProtectiveFactor,
  TherapyResponseProfile,
} from "@/lib/clinical-intelligence/types";

export function formatProtectivesForPrompt(
  factors: ProtectiveFactor[] | null | undefined,
): string {
  if (!factors?.length) return "";
  const lines = factors.slice(0, 6).map((f) => {
    const strength =
      f.strength !== undefined ? ` (felt strength ~${f.strength})` : "";
    return `- ${f.label}${strength}${f.narrative ? `: ${f.narrative}` : ""}`;
  });
  return [
    "Protective factors (enact as lived resources — do not list as a checklist unless asked):",
    ...lines,
  ].join("\n");
}

export function formatMseForPrompt(mse: MentalStatusExam | null | undefined): string {
  if (!mse) return "";
  const bits = [
    mse.appearance && `Appearance/presentation: ${mse.appearance}`,
    mse.behavior && `Behavioural tone: ${mse.behavior}`,
    mse.speech && `Speech: ${mse.speech}`,
    mse.mood && `Mood: ${mse.mood}`,
    mse.affect && `Affect: ${mse.affect}`,
    mse.thought_process && `Thought process: ${mse.thought_process}`,
    mse.thought_content && `Thought content: ${mse.thought_content}`,
    mse.perception && `Perception: ${mse.perception}`,
    `Insight: enact ${mse.insight} insight — never announce the insight label.`,
    mse.judgement && `Judgement: ${mse.judgement}`,
    mse.cognition && `Cognition: ${mse.cognition}`,
    mse.risk_summary && `Risk teaching note: ${mse.risk_summary}`,
  ].filter(Boolean);
  return [
    "Mental status portrayal (enact — do not recite as an MSE form):",
    ...bits.map((b) => `- ${b}`),
  ].join("\n");
}

export function formatFormulationForPrompt(
  formulation: PatientFormulation | null | undefined,
): string {
  if (!formulation) return "";
  const beliefs = formulation.belief_system.core_beliefs
    .filter((b) => b.salience !== "hidden")
    .slice(0, 4)
    .map(
      (b) =>
        `- Underlying stance (${b.domain}): live as if "${b.statement}" shapes you — do not announce it as a belief label.`,
    );
  const goals = (formulation.patient_goals ?? [])
    .slice(0, 4)
    .map((g) => `- You privately hope for: ${g}`);
  const ats = formulation.automatic_thoughts_seed
    .filter((t) => t.disclosed)
    .slice(0, 2)
    .map((t) => `- A thought that may surface: "${t.content}"`);

  const parts = [
    beliefs.length
      ? ["Core lived stances (never dump as CBT jargon):", ...beliefs].join("\n")
      : "",
    goals.length
      ? ["What you want (patient goals — not trainee session goals):", ...goals].join(
          "\n",
        )
      : "",
    ats.length ? ["Thoughts that may slip out when safe:", ...ats].join("\n") : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatTherapyResponseForPrompt(
  profile: TherapyResponseProfile | null | undefined,
): string {
  if (!profile) return "";
  return [
    `Therapy modality response (${profile.modality}):`,
    `- Engages with: ${profile.engages_with.join("; ")}`,
    `- Resists: ${profile.resists.join("; ")}`,
    `- ${profile.alliance_cue}`,
    profile.response_biases.validation_required
      ? "- Validation before change: without feeling validated, harden or test before cooperating with change talk."
      : "",
    profile.response_biases.advice_sensitivity === "high"
      ? "- Advice-giving feels controlling; respond with ambivalence or polite resistance rather than compliance."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDecisionPlanForPrompt(
  plan: PatientDecisionPlan | null | undefined,
): string {
  if (!plan) return "";
  // Directives only — never announce decision labels.
  const lines: string[] = [
    "Turn behavioural intent (enact — do not name these labels):",
  ];
  if (plan.disclosure === "withhold") {
    lines.push("- Keep answers thin; protect sensitive material.");
  } else if (plan.disclosure === "deflect") {
    lines.push("- Deflect or minimize before offering anything deeper.");
  } else if (plan.disclosure === "partial") {
    lines.push("- Offer a partial opening; watch how they handle it.");
  } else {
    lines.push("- You can open a layer if the therapist earned it.");
  }
  if (plan.cognitive_move === "activate_schema") {
    lines.push("- Old if–then patterns colour how you hear them this turn.");
  } else if (plan.cognitive_move === "ruminate") {
    lines.push("- Thoughts loop; answers may circle the same worry.");
  } else if (plan.cognitive_move === "blank") {
    lines.push("- Mind goes blank or foggy; short answers are OK.");
  }
  if (plan.dissociation === "mild_detachment") {
    lines.push("- Slight detachment / spacing possible near hard material.");
  } else if (plan.dissociation === "marked") {
    lines.push("- Marked detachment; may need grounding before narrative.");
  }
  if (plan.meta.therapy_bias?.includes("resist_advice")) {
    lines.push("- Advice lands poorly; push back or go quiet.");
  }
  if (plan.meta.therapy_bias?.includes("needs_validation")) {
    lines.push("- Change talk without validation feels invalidating — resist or flare.");
  }
  return lines.join("\n");
}
