/**
 * Bridge TRE ↔ Patient Mind Engine.
 */

import type { PatientMindState } from "@/lib/pme/types";
import { clamp01to100, nudgeEmotion } from "@/lib/pme/emotion";
import { competenceFromTurnCues } from "@/lib/tre/competence";
import { applySessionTreatment, seedTreatmentState } from "@/lib/tre/engine";
import { normalizeModality } from "@/lib/tre/modalities";
import type { TreatmentState, TreModality } from "@/lib/tre/types";
import { computeTherapyResponseIndex, recordTriHistory } from "@/lib/tre/tri";

/** Alias — treatment lives on PatientMindState.treatment. */
export type MindWithTreatment = PatientMindState;

export function ensureTreatmentState(
  mind: MindWithTreatment,
  modality?: string | null,
): TreatmentState {
  if (mind.treatment) return mind.treatment;
  return seedTreatmentState({
    modality: normalizeModality(modality),
    symptom_burden: mind.therapy.symptom_burden,
    insight: mind.therapy.insight,
    hope: mind.emotional_state.hope,
    trust: mind.relationship.trust,
    medication_adherence: mind.therapy.medication_adherence,
    disorder_slug: mind.diagnosis.slug,
    category: mind.diagnosis.category,
  });
}

/**
 * Close out a session: apply TRE using alliance/competence from traces,
 * sync outcomes into PME mind for the next encounter.
 */
export function applyTherapyResponseToMind(
  mind: MindWithTreatment,
  opts?: {
    modality?: string | null;
    life_event_valence?: "negative" | "mixed" | "positive" | "none";
  },
): {
  mind: MindWithTreatment;
  treatment: TreatmentState;
  tri: ReturnType<typeof computeTherapyResponseIndex>;
  expressionNotes: string[];
} {
  const modality: TreModality = normalizeModality(
    opts?.modality ?? mind.treatment?.modality ?? "supportive",
  );
  const prior = ensureTreatmentState(mind, modality);
  const allianceMean =
    mind.turn_traces.length > 0
      ? mind.turn_traces.reduce((a, t) => a + t.alliance, 0) /
        mind.turn_traces.length
      : mind.relationship.alliance;
  const competence = competenceFromTurnCues(
    mind.turn_traces.map((t) => t.therapist_cues),
    allianceMean,
    mind.relationship.rupture_count,
  );

  const life =
    opts?.life_event_valence ??
    (mind.life_events.filter((e) => !e.carried_into_session).slice(-1)[0]
      ?.valence === "negative"
      ? "negative"
      : mind.life_events.filter((e) => !e.carried_into_session).slice(-1)[0]
            ?.valence === "positive"
        ? "positive"
        : mind.life_events.filter((e) => !e.carried_into_session).slice(-1)[0]
              ?.valence === "mixed"
          ? "mixed"
          : "none");

  const result = applySessionTreatment({
    modality,
    therapist_competence: competence,
    alliance_mean: allianceMean,
    medication_adherence: mind.therapy.medication_adherence,
    disorder_slug: mind.diagnosis.slug,
    disorder_category: mind.diagnosis.category,
    personality_attachment: mind.personality.attachment,
    life_event_valence: life,
    prior,
    session_index: mind.therapy.session_index,
  });

  const next: MindWithTreatment = structuredClone(mind);
  next.treatment = result.treatment;
  next.therapy.symptom_burden = result.mind_patch.symptom_burden;
  next.therapy.insight = result.mind_patch.insight;
  next.therapy.motivation = result.mind_patch.motivation;
  next.therapy.medication_adherence = result.mind_patch.medication_adherence;
  next.relationship.trust = clamp01to100(
    next.relationship.trust * 0.5 + result.mind_patch.trust * 0.5,
  );
  next.emotional_state = nudgeEmotion(
    next.emotional_state,
    {
      hope: result.mind_patch.hope - next.emotional_state.hope,
      trust: result.mind_patch.trust - next.emotional_state.trust,
    },
    0.5,
  );

  if (result.mind_patch.disclosure_readiness_boost !== 0) {
    next.disclosure = next.disclosure.map((d) => ({
      ...d,
      readiness: clamp01to100(
        d.readiness + result.mind_patch.disclosure_readiness_boost,
      ),
    }));
  }

  next.memory.salient_facts = [
    ...next.memory.salient_facts.slice(-10),
    `Treatment trajectory: ${result.treatment.trajectory} (${modality}).`,
  ];
  next.updated_at = new Date().toISOString();

  const tri = computeTherapyResponseIndex(result.treatment);
  recordTriHistory({
    overall: tri.overall,
    disorder_slug: mind.diagnosis.slug,
    modality,
    tri,
  });

  return {
    mind: next,
    treatment: result.treatment,
    tri,
    expressionNotes: result.mind_patch.clinical_notes,
  };
}

export function formatTreExpressionBlock(
  treatment: TreatmentState,
  notes: string[],
): string {
  const o = treatment.outcomes;
  return [
    "──────────────────────────────────────────────",
    `MODULE TRE — THERAPY RESPONSE (v${treatment.tre_version})`,
    "──────────────────────────────────────────────",
    `Modality: ${treatment.modality}`,
    `Trajectory: ${treatment.trajectory} (${treatment.sessions.length} sessions applied)`,
    `Outcomes — symptoms ${o.symptoms}, cognition ${o.cognition}, emotion_reg ${o.emotion_regulation},`,
    `insight ${o.insight}, functioning ${o.functioning}, hope ${o.hope}, trust ${o.trust},`,
    `disclosure_openness ${o.disclosure_openness}, relapse_risk ${o.relapse_risk}, engagement ${o.engagement}.`,
    "Express gradual change only — no overnight cures or sudden collapse unless trajectory is relapse/crisis.",
    ...notes.map((n) => `- ${n}`),
  ].join("\n");
}
