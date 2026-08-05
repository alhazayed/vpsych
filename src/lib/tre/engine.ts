/**
 * Therapy Response Engine — apply session treatment → longitudinal outcomes.
 */

import { dynamicsForDisorder } from "@/lib/tre/dynamics";
import { MODALITY_PROFILES } from "@/lib/tre/modalities";
import type {
  SessionTreatmentRecord,
  TrajectoryLabel,
  TreatmentOutcomes,
  TreatmentState,
  TreApplyResult,
  TreSessionInput,
} from "@/lib/tre/types";
import { TRE_VERSION } from "@/lib/tre/types";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n * 10) / 10));
}

export function seedTreatmentState(opts: {
  modality: TreSessionInput["modality"];
  symptom_burden: number;
  insight: number;
  hope: number;
  trust: number;
  medication_adherence: number;
  resilience?: number;
  disorder_slug: string;
  category?: string | null;
}): TreatmentState {
  const dyn = dynamicsForDisorder(opts.disorder_slug, opts.category);
  const symptoms = opts.symptom_burden;
  return {
    tre_version: TRE_VERSION,
    modality: opts.modality,
    resilience: opts.resilience ?? dyn.resilience_prior,
    personality_factor: 1,
    outcomes: {
      symptoms,
      cognition: clamp(100 - symptoms * 0.7),
      emotion_regulation: clamp(55 - symptoms * 0.25),
      insight: opts.insight,
      functioning: clamp(60 - symptoms * 0.35),
      disclosure_openness: clamp(40 + opts.trust * 0.2),
      trust: opts.trust,
      hope: opts.hope,
      relapse_risk: clamp(30 + symptoms * 0.35),
      engagement: clamp(45 + opts.trust * 0.25),
      homework_adherence: clamp(opts.medication_adherence * 0.5 + 20),
    },
    sessions: [],
    trajectory: "plateau",
    updated_at: new Date().toISOString(),
  };
}

function classifyTrajectory(
  sessions: SessionTreatmentRecord[],
  outcomes: TreatmentOutcomes,
): TrajectoryLabel {
  if (outcomes.engagement < 28) return "disengaged";
  if (sessions.length < 2) {
    const d0 = sessions[0]?.deltas.symptoms ?? 0;
    if (d0 <= -3) return "improving";
    if (d0 >= 3) return "worsening";
    return "plateau";
  }
  const recent = sessions.slice(-3);
  const symptomDelta = recent.reduce((a, s) => a + (s.deltas.symptoms ?? 0), 0);
  const priorBest = Math.min(...sessions.map((s) => s.deltas.symptoms ?? 0));
  // Relapse: improvement history then clear worsening
  const hadImprovement = sessions.some((s) => (s.deltas.symptoms ?? 0) <= -3);
  if (hadImprovement && symptomDelta >= 5 && outcomes.relapse_risk >= 55) {
    return "relapse";
  }
  if (symptomDelta <= -5) return "improving";
  if (symptomDelta >= 5) return "worsening";
  if (Math.abs(symptomDelta) < 2 && priorBest > -2) return "plateau";
  return symptomDelta < 0 ? "improving" : symptomDelta > 0 ? "worsening" : "plateau";
}

/**
 * Apply one completed therapy session to the treatment trajectory.
 */
export function applySessionTreatment(input: TreSessionInput): TreApplyResult {
  const profile = MODALITY_PROFILES[input.modality];
  const dyn = dynamicsForDisorder(input.disorder_slug, input.disorder_category);
  const prior =
    input.prior ??
    seedTreatmentState({
      modality: input.modality,
      symptom_burden: 60,
      insight: 45,
      hope: 35,
      trust: input.alliance_mean,
      medication_adherence: input.medication_adherence,
      resilience: input.resilience,
      disorder_slug: input.disorder_slug,
      category: input.disorder_category,
    });

  const attachment = (input.personality_attachment ?? "").toLowerCase();
  let personality = 1;
  if (attachment.includes("anxious") || attachment.includes("preoccupied"))
    personality = 0.92;
  if (attachment.includes("avoidant")) personality = 0.88;

  const competence = clamp(input.therapist_competence);
  const alliance = clamp(input.alliance_mean);
  const med = clamp(input.medication_adherence);
  const fit =
    profile.category_fit[input.disorder_category ?? ""] ??
    profile.category_fit[
      dyn.category ?? ""
    ] ??
    1;

  // Quality score 0–1
  const quality =
    (competence / 100) * 0.5 + (alliance / 100) * 0.35 + (med / 100) * 0.15;

  const life =
    input.life_event_valence === "negative"
      ? -1
      : input.life_event_valence === "positive"
        ? 0.6
        : input.life_event_valence === "mixed"
          ? -0.3
          : 0;

  const resilienceBuf = (prior.resilience / 100) * 0.15;
  const notes: string[] = [profile.clinical_note, ...dyn.notes.slice(0, 1)];

  const deltas: Partial<TreatmentOutcomes> = {};

  if (quality >= 0.55) {
    const relief =
      profile.max_symptom_relief *
      quality *
      fit *
      dyn.recovery_tempo *
      personality *
      (1 + resilienceBuf) *
      (1 + life * 0.15);
    deltas.symptoms = -relief;
    for (const key of profile.strengths) {
      if (key === "symptoms" || key === "relapse_risk") continue;
      const gain = 3.5 * quality * fit * personality;
      deltas[key] = (deltas[key] ?? 0) + gain;
    }
    deltas.relapse_risk = -(2.5 * quality * fit) + dyn.relapse_drift * 0.3;
    deltas.hope = (deltas.hope ?? 0) + 2.5 * quality;
    deltas.trust = (deltas.trust ?? 0) + 2 * (alliance / 100) * quality;
    notes.push(
      `Adequate ${profile.label} dose: gradual gains expected (${input.disorder_slug}).`,
    );
  } else {
    const harm =
      profile.low_skill_harm *
      (1 - quality) *
      dyn.deterioration_tempo *
      (1 - life * 0.2);
    deltas.symptoms = harm * 0.7;
    deltas.engagement = -4 * (1 - quality);
    deltas.trust = -3 * (1 - alliance / 100);
    deltas.hope = -2.5 * (1 - quality);
    deltas.relapse_risk = harm * 0.5 + dyn.relapse_drift;
    notes.push(
      `Low competence/alliance — risk of plateau, worsening, or disengagement.`,
    );
  }

  // Crisis: allow short-term activation with safety benefit when competence high
  if (input.modality === "crisis_intervention" && quality >= 0.6) {
    deltas.relapse_risk = (deltas.relapse_risk ?? 0) - 6;
    deltas.engagement = (deltas.engagement ?? 0) + 3;
    notes.push("Crisis stabilization: safety/engagement prioritized over deep processing.");
  }

  // Life stress overlay
  if (life < 0) {
    deltas.symptoms = (deltas.symptoms ?? 0) + 2.5;
    deltas.relapse_risk = (deltas.relapse_risk ?? 0) + 3;
    notes.push("Negative between-session life event blunted gains.");
  } else if (life > 0) {
    deltas.hope = (deltas.hope ?? 0) + 1.5;
    deltas.symptoms = (deltas.symptoms ?? 0) - 1;
  }

  // Med adherence
  if (med < 40) {
    deltas.symptoms = (deltas.symptoms ?? 0) + 2;
    deltas.relapse_risk = (deltas.relapse_risk ?? 0) + 4;
    notes.push("Poor medication adherence increased relapse risk.");
  } else if (med >= 75) {
    deltas.relapse_risk = (deltas.relapse_risk ?? 0) - 2;
  }

  // Cap per-session symptom swings (no overnight miracle / collapse)
  if ((deltas.symptoms ?? 0) < -10) deltas.symptoms = -10;
  if ((deltas.symptoms ?? 0) > 10) deltas.symptoms = 10;

  const outcomes: TreatmentOutcomes = { ...prior.outcomes };
  for (const [k, v] of Object.entries(deltas) as Array<
    [keyof TreatmentOutcomes, number]
  >) {
    if (typeof v !== "number") continue;
    outcomes[k] = clamp(outcomes[k] + v);
  }

  // Keep channels coherent: high symptoms ↔ lower functioning/cognition soft link
  outcomes.functioning = clamp(
    outcomes.functioning * 0.85 + (100 - outcomes.symptoms) * 0.15,
  );

  const record: SessionTreatmentRecord = {
    session_index: input.session_index,
    modality: input.modality,
    therapist_competence: competence,
    alliance_mean: alliance,
    medication_adherence: med,
    life_event_valence: input.life_event_valence ?? "none",
    deltas,
    trajectory_after: "plateau",
    notes,
    at: new Date().toISOString(),
  };

  const sessions = [...prior.sessions.slice(-19), record];
  const trajectory = classifyTrajectory(sessions, outcomes);
  record.trajectory_after = trajectory;

  const treatment: TreatmentState = {
    tre_version: TRE_VERSION,
    modality: input.modality,
    resilience: prior.resilience,
    personality_factor: personality,
    outcomes,
    sessions,
    trajectory,
    updated_at: record.at,
  };

  return {
    treatment,
    mind_patch: {
      symptom_burden: outcomes.symptoms,
      insight: outcomes.insight,
      motivation: clamp(outcomes.engagement * 0.6 + outcomes.hope * 0.4),
      medication_adherence: med,
      hope: outcomes.hope,
      trust: outcomes.trust,
      disclosure_readiness_boost: (deltas.disclosure_openness ?? 0) * 0.5,
      clinical_notes: [
        `TRE ${TRE_VERSION}: ${trajectory} after ${profile.label}.`,
        ...notes.slice(0, 3),
      ],
    },
  };
}

/** Multi-session simulation for regression / TRI. */
export function simulateTreatmentCourse(opts: {
  modality: TreSessionInput["modality"];
  disorder_slug: string;
  category?: string | null;
  sessions: number;
  competence: number;
  alliance: number;
  medication_adherence?: number;
  life_pattern?: Array<"negative" | "mixed" | "positive" | "none">;
}): { treatment: TreatmentState; trajectory: TrajectoryLabel } {
  let prior: TreatmentState | null = null;
  let last!: TreApplyResult;
  for (let i = 1; i <= opts.sessions; i++) {
    const life =
      opts.life_pattern?.[(i - 1) % (opts.life_pattern.length || 1)] ?? "none";
    last = applySessionTreatment({
      modality: opts.modality,
      therapist_competence: opts.competence,
      alliance_mean: opts.alliance,
      medication_adherence: opts.medication_adherence ?? 75,
      disorder_slug: opts.disorder_slug,
      disorder_category: opts.category,
      life_event_valence: life,
      prior,
      session_index: i,
    });
    prior = last.treatment;
  }
  return { treatment: last.treatment, trajectory: last.treatment.trajectory };
}
