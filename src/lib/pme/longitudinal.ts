/**
 * Modules 6–7 — Longitudinal therapy + life outside therapy.
 */

import { randomUUID } from "crypto";
import type { LifeEvent, PatientMindState } from "@/lib/pme/types";
import { clamp01to100, nudgeEmotion } from "@/lib/pme/emotion";

const EVENT_POOL: Array<Omit<LifeEvent, "id" | "occurred_at" | "carried_into_session">> = [
  {
    kind: "argument",
    description: "Had a sharp argument at home; still replaying it.",
    valence: "negative",
    impact: { anger: 12, activation: 10, hope: -6, symptom_delta: 4 },
  },
  {
    kind: "sleep_change",
    description: "Sleep got worse this week — tossing until late.",
    valence: "negative",
    impact: { fatigue: 14, activation: -4, symptom_delta: 5 },
  },
  {
    kind: "job_stress",
    description: "Work piled up; worried about performance.",
    valence: "negative",
    impact: { fear: 10, helplessness: 8, symptom_delta: 3 },
  },
  {
    kind: "supportive_contact",
    description: "A friend checked in; felt a bit less alone for a day.",
    valence: "positive",
    impact: { hope: 8, trust: 4, symptom_delta: -3 },
  },
  {
    kind: "family_conflict",
    description: "Family pressure about 'getting over it' already.",
    valence: "negative",
    impact: { shame: 10, anger: 8, symptom_delta: 4 },
  },
  {
    kind: "medication_change",
    description: "Missed a couple of doses / side effects felt stronger.",
    valence: "mixed",
    impact: { fear: 6, fatigue: 6, symptom_delta: 2 },
  },
];

/** Deterministic pick from seed string. */
function pickIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function generateInterSessionLifeEvent(
  mind: PatientMindState,
  seed: string,
): LifeEvent {
  const idx = pickIndex(seed, EVENT_POOL.length);
  const base = EVENT_POOL[idx]!;
  return {
    id: randomUUID(),
    kind: base.kind,
    description: base.description,
    valence: base.valence,
    impact: base.impact,
    occurred_at: new Date().toISOString(),
    carried_into_session: false,
  };
}

/**
 * Apply therapy quality + life events between sessions.
 * Call when opening session N+1 for the same longitudinal mind.
 */
export function applyLongitudinalUpdate(
  mind: PatientMindState,
  opts: {
    priorAllianceMean: number;
    generateEvent?: boolean;
    seed?: string;
    /**
     * When true, skip coarse alliance→symptom deltas.
     * Prefer Therapy Response Engine (`applyTherapyResponseToMind`) instead.
     */
    skipTherapyQualityDelta?: boolean;
  },
): PatientMindState {
  const next: PatientMindState = structuredClone(mind);
  next.therapy.session_index += 1;
  next.therapy.phase = "opening";
  next.therapy.turns_in_phase = 0;
  next.relationship.sessions_together += 1;

  // Coarse trajectory only when TRE is not handling treatment response
  if (!opts.skipTherapyQualityDelta) {
    const quality = opts.priorAllianceMean;
    let symptomDelta = 0;
    if (quality >= 70) symptomDelta = -6;
    else if (quality >= 55) symptomDelta = -2;
    else if (quality < 40) symptomDelta = 5;
    else symptomDelta = 1;

    const slug = next.diagnosis.slug;
    if (/mdd|depress/i.test(slug)) symptomDelta *= 0.7;
    if (/mania|bipolar/i.test(slug)) symptomDelta *= 1.1;
    if (/bpd|borderline/i.test(slug)) symptomDelta *= 0.9;

    next.therapy.symptom_burden = clamp01to100(
      next.therapy.symptom_burden + symptomDelta,
    );
    next.therapy.motivation = clamp01to100(
      next.therapy.motivation + (quality >= 60 ? 4 : -2),
    );
    next.therapy.insight = clamp01to100(
      next.therapy.insight + (quality >= 65 ? 3 : 0),
    );
  }

  if (opts.generateEvent !== false) {
    const event = generateInterSessionLifeEvent(
      next,
      opts.seed ?? `${next.case_instance_id}:${next.therapy.session_index}`,
    );
    next.life_events = [...next.life_events.slice(-8), event];
    const { symptom_delta, ...emo } = event.impact;
    next.emotional_state = nudgeEmotion(next.emotional_state, emo, 0.55);
    if (typeof symptom_delta === "number") {
      next.therapy.symptom_burden = clamp01to100(
        next.therapy.symptom_burden + symptom_delta,
      );
    }
  }

  next.updated_at = new Date().toISOString();
  return next;
}

export function markLifeEventCarried(mind: PatientMindState): {
  mind: PatientMindState;
  carryText: string | null;
} {
  const pending = [...mind.life_events].reverse().find((e) => !e.carried_into_session);
  if (!pending) return { mind, carryText: null };
  const next = structuredClone(mind);
  next.life_events = next.life_events.map((e) =>
    e.id === pending.id ? { ...e, carried_into_session: true } : e,
  );
  return {
    mind: next,
    carryText: `Between-session life: ${pending.description} (affect this opening).`,
  };
}
