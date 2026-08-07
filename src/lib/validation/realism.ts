/**
 * Realism Engine — observational clinical realism scoring.
 * Never assigns diagnoses. Never mutates patient state.
 */

import {
  approxCi,
  clamp01to100,
  weightedMean,
} from "@/lib/validation/helpers";
import type {
  ConfidenceInterval,
  DimensionScore,
  RealismDimensionId,
  SessionObservables,
} from "@/lib/validation/types";

const REALISM_WEIGHTS: Record<RealismDimensionId, number> = {
  speech_realism: 5,
  emotion_realism: 6,
  behaviour_realism: 6,
  diagnostic_realism: 7,
  longitudinal_realism: 4,
  therapy_realism: 6,
  memory_realism: 5,
  alliance_realism: 6,
  response_latency: 3,
  conversation_flow: 5,
  naturalness: 6,
  consistency: 5,
  insight: 4,
  defensiveness: 3,
  avoidance: 3,
  motivation: 3,
  hope: 3,
  hopelessness: 3,
  protective_factors: 5,
  risk_behaviour: 6,
  mse_realism: 6,
};

function dim(
  id: RealismDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  notes: string[] = [],
): DimensionScore {
  return {
    id,
    score: clamp01to100(score),
    weight: REALISM_WEIGHTS[id],
    confidence: clamp01to100(confidence),
    evidence,
    notes,
  };
}

function patientTexts(obs: SessionObservables): string[] {
  return obs.messages
    .filter((m) => m.role === "assistant" || m.role === "patient")
    .map((m) => m.content);
}

function therapistTexts(obs: SessionObservables): string[] {
  return obs.messages
    .filter((m) => m.role === "user" || m.role === "therapist")
    .map((m) => m.content);
}

function containsAny(text: string, needles: string[]): boolean {
  const t = text.toLowerCase();
  return needles.some((n) => t.includes(n));
}

/**
 * Score clinical realism from session observables only.
 */
export function scoreRealism(obs: SessionObservables): {
  overall: number;
  dimensions: DimensionScore[];
  confidence_interval: ConfidenceInterval;
} {
  const patient = patientTexts(obs);
  const therapist = therapistTexts(obs);
  const joined = patient.join("\n");
  const c = obs.clinical;
  const dims: DimensionScore[] = [];

  // Speech / naturalness from length variance and turn balance
  const lens = patient.map((t) => t.length);
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const speech =
    patient.length === 0
      ? 35
      : clamp01to100(
          45 +
            Math.min(25, patient.length * 2) +
            (avgLen > 20 && avgLen < 600 ? 15 : 5) +
            (obs.patient_turn_count >= 3 ? 10 : 0),
        );
  dims.push(
    dim("speech_realism", speech, 70, [
      `patient_turns=${obs.patient_turn_count}`,
      `avg_chars=${Math.round(avgLen)}`,
    ]),
  );

  const emotionCue = containsAny(joined, [
    "feel",
    "afraid",
    "anxious",
    "sad",
    "angry",
    "ashamed",
    "guilt",
    "اشعر",
    "خائف",
    "حزين",
    "قلق",
  ]);
  dims.push(
    dim(
      "emotion_realism",
      emotionCue ? 78 : patient.length ? 55 : 30,
      65,
      [emotionCue ? "affective_language_present" : "limited_affective_language"],
    ),
  );

  dims.push(
    dim(
      "behaviour_realism",
      c.has_formulation || c.has_personality_freeze ? 80 : 60,
      70,
      [
        `personality_freeze=${c.has_personality_freeze}`,
        `formulation=${c.has_formulation}`,
      ],
    ),
  );

  // Diagnostic realism = package coherence presence — NOT diagnosis assignment
  let diag = 40;
  if (c.dsm5_code || c.icd11_code) diag += 20;
  if (c.symptom_count >= 2) diag += 15;
  if (c.differentials_count > 0) diag += 10;
  if (c.disorder_slug) diag += 10;
  dims.push(
    dim("diagnostic_realism", diag, 85, [
      `slug=${c.disorder_slug ?? "none"}`,
      `symptoms=${c.symptom_count}`,
      "observational_coherence_only",
    ], ["Never assigns diagnoses — measures package coherence only"]),
  );

  dims.push(
    dim(
      "longitudinal_realism",
      c.memory_scope === "case_instance" ? 72 : 55,
      60,
      [`memory_scope=${c.memory_scope ?? "unset"}`],
    ),
  );

  dims.push(
    dim(
      "therapy_realism",
      c.therapy_modality ? 75 : 50,
      70,
      [`modality=${c.therapy_modality ?? "none"}`],
    ),
  );

  dims.push(
    dim(
      "memory_realism",
      c.has_scientific_meta ? 78 : 58,
      65,
      [`scientific_meta=${c.has_scientific_meta}`],
    ),
  );

  const allianceCue =
    containsAny(joined, ["trust", "here", "listen", "understand", "اثق", "افهم"]) ||
    therapist.some((t) =>
      containsAny(t, ["how are you", "tell me", "sounds like", "كيف حالك"]),
    );
  dims.push(
    dim(
      "alliance_realism",
      allianceCue ? 76 : patient.length ? 58 : 40,
      60,
      [allianceCue ? "alliance_cues_present" : "weak_alliance_cues"],
    ),
  );

  // Latency is not always available — score presence of turn structure
  dims.push(
    dim(
      "response_latency",
      obs.turn_count >= 4 ? 70 : obs.turn_count >= 2 ? 55 : 35,
      50,
      [`turns=${obs.turn_count}`],
      ["Wall-clock latency not instrumented in all paths"],
    ),
  );

  const balance =
    obs.therapist_turn_count > 0 && obs.patient_turn_count > 0
      ? Math.min(
          obs.therapist_turn_count / obs.patient_turn_count,
          obs.patient_turn_count / obs.therapist_turn_count,
        )
      : 0;
  dims.push(
    dim(
      "conversation_flow",
      clamp01to100(40 + balance * 50 + Math.min(10, obs.turn_count)),
      70,
      [`turn_balance=${Math.round(balance * 100) / 100}`],
    ),
  );

  dims.push(
    dim(
      "naturalness",
      clamp01to100((speech + (emotionCue ? 80 : 50)) / 2),
      65,
      ["derived_from_speech_and_affect"],
    ),
  );

  dims.push(
    dim(
      "consistency",
      c.disorder_slug && c.symptom_count > 0 ? 74 : 50,
      70,
      ["snapshot_internal_consistency"],
    ),
  );

  const insightCue = containsAny(joined, [
    "realize",
    "understand myself",
    "pattern",
    "ادرك",
    "افهم نفسي",
  ]);
  dims.push(
    dim("insight", insightCue ? 72 : 52, 55, [
      insightCue ? "insight_language" : "limited_insight_language",
    ]),
  );

  const defensive = containsAny(joined, [
    "fine",
    "nothing wrong",
    "don't want to talk",
    "بخير",
    "ما في مشكلة",
  ]);
  dims.push(
    dim("defensiveness", defensive ? 70 : 55, 50, [
      defensive ? "defensive_markers" : "no_clear_defensive_markers",
    ]),
  );

  const avoid = containsAny(joined, [
    "change the subject",
    "rather not",
    "whatever",
    "ما بدي",
    "مو مهم",
  ]);
  dims.push(
    dim("avoidance", avoid ? 68 : 54, 50, [
      avoid ? "avoidance_markers" : "no_clear_avoidance",
    ]),
  );

  dims.push(
    dim(
      "motivation",
      containsAny(joined, ["want to", "try", "hope", "بدي", "احاول"]) ? 70 : 52,
      50,
      [],
    ),
  );
  dims.push(
    dim(
      "hope",
      containsAny(joined, ["hope", "better", "possible", "امل", "افضل"])
        ? 68
        : 50,
      45,
      [],
    ),
  );
  dims.push(
    dim(
      "hopelessness",
      containsAny(joined, [
        "pointless",
        "never get better",
        "hopeless",
        "ما في امل",
        "فايدة",
      ])
        ? 70
        : 48,
      45,
      [],
    ),
  );

  dims.push(
    dim(
      "protective_factors",
      c.has_protective_factors ? 82 : 45,
      80,
      [`protective_on_core=${c.has_protective_factors}`],
    ),
  );

  const riskPresent =
    Boolean(c.risk.suicidal_ideation) ||
    Boolean(c.risk.self_harm) ||
    Boolean(c.risk.harm_to_others);
  dims.push(
    dim(
      "risk_behaviour",
      riskPresent ? 78 : 62,
      75,
      [
        `risk_flags=${riskPresent}`,
        "observational_presence_only",
      ],
    ),
  );

  dims.push(
    dim(
      "mse_realism",
      c.has_mse ? 84 : 42,
      85,
      [`mse_on_core=${c.has_mse}`],
    ),
  );

  const overall = weightedMean(
    dims.map((d) => ({ score: d.score, weight: d.weight })),
  );
  const avgConf = weightedMean(
    dims.map((d) => ({ score: d.confidence, weight: d.weight })),
  );

  return {
    overall,
    dimensions: dims,
    confidence_interval: approxCi(overall, avgConf, "realism_dimension_uncertainty"),
  };
}

export { REALISM_WEIGHTS };
