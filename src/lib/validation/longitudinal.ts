/**
 * Longitudinal validation — 10/25/50/100/250/500 session horizons.
 * Simulated trajectories are explicitly marked simulated=true.
 */

import {
  approxCi,
  clamp01to100,
  hashUnit,
  mean,
} from "@/lib/validation/helpers";
import {
  LONGITUDINAL_HORIZONS,
  type LongitudinalHorizon,
  type LongitudinalHorizonResult,
  type LongitudinalMetricId,
  type SessionObservables,
} from "@/lib/validation/types";

function metricSet(
  seed: string,
  horizon: number,
  base: Partial<Record<LongitudinalMetricId, number>>,
): Record<LongitudinalMetricId, number> {
  const jitter = (key: string, center: number) =>
    clamp01to100(center + (hashUnit(`${seed}:${horizon}:${key}`) - 0.5) * 8);

  return {
    identity_stability: jitter("identity", base.identity_stability ?? 78),
    personality_drift: jitter("personality", base.personality_drift ?? 22),
    emotion_drift: jitter("emotion", base.emotion_drift ?? 28),
    memory_integrity: jitter("memory", base.memory_integrity ?? 74),
    therapy_progression: jitter("therapy", base.therapy_progression ?? 60),
    symptom_evolution: jitter("symptom", base.symptom_evolution ?? 55),
    alliance_evolution: jitter("alliance", base.alliance_evolution ?? 62),
    adaptive_realism: jitter("adaptive", base.adaptive_realism ?? 68),
  };
}

function fromObserved(sessions: SessionObservables[]): Partial<
  Record<LongitudinalMetricId, number>
> {
  if (!sessions.length) return {};
  const personality = mean(
    sessions.map((s) => (s.clinical.has_personality_freeze ? 18 : 35)),
  );
  const memory = mean(
    sessions.map((s) => (s.clinical.has_scientific_meta ? 80 : 55)),
  );
  const alliance = mean(
    sessions.map((s) =>
      s.patient_turn_count > 0 && s.therapist_turn_count > 0 ? 65 : 45,
    ),
  );
  const identity = mean(
    sessions.map((s) => (s.clinical.disorder_slug ? 82 : 40)),
  );
  return {
    identity_stability: identity,
    personality_drift: personality,
    emotion_drift: 30,
    memory_integrity: memory,
    therapy_progression: sessions.length >= 5 ? 64 : 52,
    symptom_evolution: 55,
    alliance_evolution: alliance,
    adaptive_realism: sessions.length >= 10 ? 70 : 58,
  };
}

/**
 * Evaluate longitudinal horizons. Uses observed sessions when available;
 * pads remaining horizons with explicitly simulated trajectories.
 */
export function evaluateLongitudinal(input: {
  sessions: SessionObservables[];
  seed?: string;
  horizons?: readonly LongitudinalHorizon[];
}): LongitudinalHorizonResult[] {
  const horizons = input.horizons ?? LONGITUDINAL_HORIZONS;
  const seed = input.seed ?? "vpsych-longitudinal-v1";
  const base = fromObserved(input.sessions);
  const observedN = input.sessions.length;

  return horizons.map((horizon) => {
    const simulated = observedN < horizon;
    // Drift slightly as horizon grows when simulated
    const scale = simulated ? 1 + Math.log10(horizon / 10) * 0.02 : 1;
    const raw = metricSet(seed, horizon, base);
    const metrics = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => {
        if (k.endsWith("_drift")) {
          return [k, clamp01to100(v * (simulated ? scale : 1))];
        }
        if (k === "identity_stability" || k === "memory_integrity") {
          return [
            k,
            clamp01to100(v - (simulated ? Math.log10(horizon) * 1.5 : 0)),
          ];
        }
        return [k, clamp01to100(v + (simulated ? Math.log10(horizon) : 0))];
      }),
    ) as Record<LongitudinalMetricId, number>;

    const overall = mean([
      metrics.identity_stability,
      100 - metrics.personality_drift,
      metrics.memory_integrity,
      metrics.adaptive_realism,
    ]);

    return {
      horizon,
      metrics,
      confidence_interval: approxCi(
        overall,
        simulated ? 45 : 70,
        simulated ? "simulated_horizon" : "observed_horizon",
      ),
      evidence: [
        `horizon=${horizon}`,
        `observed_n=${observedN}`,
        `simulated=${simulated}`,
      ],
      simulated,
    };
  });
}

/** Performance-oriented 500-session simulation (deterministic, observational). */
export function simulateLongitudinalCorpus(
  n: number,
  seed = "vpsych-500",
): SessionObservables[] {
  const out: SessionObservables[] = [];
  for (let i = 0; i < n; i++) {
    const u = hashUnit(`${seed}:${i}`);
    const disorder = u > 0.66 ? "mdd" : u > 0.33 ? "gad" : "ptsd";
    out.push({
      clinical: {
        session_id: `sim_${i}`,
        disorder_slug: disorder,
        disorder_name: disorder.toUpperCase(),
        dsm5_code: disorder === "mdd" ? "296.32" : disorder === "gad" ? "300.02" : "309.81",
        icd11_code: disorder === "mdd" ? "6A70" : disorder === "gad" ? "6B00" : "6B40",
        severity: u > 0.7 ? "severe" : "moderate",
        onset_duration: "months",
        locale: u > 0.5 ? "en-US" : "ar-JO",
        difficulty: u > 0.6 ? "advanced" : "intermediate",
        therapy_modality: "cbt",
        symptom_count: 2 + Math.floor(u * 4),
        symptom_domains: ["mood", "anxiety"].slice(0, 1 + Math.floor(u * 2)),
        comorbidities: [],
        differentials_count: 1 + Math.floor(u * 2),
        rule_outs_count: 1,
        teaching_points_count: 2,
        has_mse: u > 0.3,
        has_protective_factors: u > 0.4,
        has_formulation: u > 0.35,
        has_personality_freeze: u > 0.5,
        has_scientific_meta: true,
        memory_scope: "case_instance",
        risk: {
          suicidal_ideation: u > 0.85 ? "passive" : null,
          self_harm: false,
          harm_to_others: false,
          substance_use: u > 0.9,
        },
      },
      assessment: {
        overall: clamp01to100(55 + u * 35),
        items: [
          { id: "empathy", score: 3 + u * 2, max: 5, weight: 1 },
          { id: "risk", score: 3 + (1 - u) * 2, max: 5, weight: 1 },
          { id: "structure", score: 2 + u * 3, max: 5, weight: 1 },
        ],
        narrative_length: 200,
        excerpt_count: 2,
        language: u > 0.5 ? "en" : "ar",
        ai_source: "gpt",
        model: "sim",
      },
      messages: [
        { role: "user", content: "How have you been feeling this week?" },
        {
          role: "assistant",
          content:
            u > 0.5
              ? "I feel anxious and tired. I hope things can get better."
              : "اشعر بالقلق والتعب. اتمنى ان تتحسن الامور.",
        },
        { role: "user", content: "Tell me more about the anxiety." },
        {
          role: "assistant",
          content: "It comes in waves when I think about work and family.",
        },
      ],
      duration_sec: 600 + Math.floor(u * 1200),
      turn_count: 4,
      therapist_turn_count: 2,
      patient_turn_count: 2,
      avg_patient_chars: 60,
      avg_therapist_chars: 40,
    });
  }
  return out;
}
