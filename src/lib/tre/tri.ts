/**
 * Therapy Response Index (TRI) — believable longitudinal therapeutic change.
 */

import type { TreatmentState } from "@/lib/tre/types";
import { TRI_VERSION } from "@/lib/tre/types";

export type TriDimensionId =
  | "symptom_trajectory"
  | "cognitive_change"
  | "emotion_regulation"
  | "insight_growth"
  | "functional_gain"
  | "alliance_trust"
  | "disclosure_evolution"
  | "hope_engagement"
  | "relapse_realism"
  | "modality_fit";

const WEIGHTS: Record<TriDimensionId, number> = {
  symptom_trajectory: 0.14,
  cognitive_change: 0.1,
  emotion_regulation: 0.1,
  insight_growth: 0.1,
  functional_gain: 0.1,
  alliance_trust: 0.12,
  disclosure_evolution: 0.08,
  hope_engagement: 0.08,
  relapse_realism: 0.1,
  modality_fit: 0.08,
};

export type TherapyResponseIndex = {
  overall: number;
  subscores: Array<{
    id: TriDimensionId;
    score: number;
    weight: number;
    weighted_contribution: number;
    evidence: string[];
  }>;
  trajectory: TreatmentState["trajectory"];
  sessions: number;
  version: string;
  computed_at: string;
  recommendations: string[];
  clinical_reasoning: string;
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function sumDelta(
  treatment: TreatmentState,
  key: keyof TreatmentState["outcomes"],
): number {
  return treatment.sessions.reduce(
    (a, s) => a + (Number(s.deltas[key] ?? 0) || 0),
    0,
  );
}

function gradual(treatment: TreatmentState): boolean {
  for (const s of treatment.sessions) {
    const d = Math.abs(s.deltas.symptoms ?? 0);
    if (d > 12) return false; // single-session miracle/collapse
  }
  return true;
}

export function computeTherapyResponseIndex(
  treatment: TreatmentState,
  opts?: { modality_fit_score?: number },
): TherapyResponseIndex {
  const o = treatment.outcomes;
  const n = treatment.sessions.length;
  const symptomSum = sumDelta(treatment, "symptoms");
  const trustSum = sumDelta(treatment, "trust");
  const hopeSum = sumDelta(treatment, "hope");
  const insightSum = sumDelta(treatment, "insight");
  const cogSum = sumDelta(treatment, "cognition");
  const erSum = sumDelta(treatment, "emotion_regulation");
  const funcSum = sumDelta(treatment, "functioning");
  const discSum = sumDelta(treatment, "disclosure_openness");
  const isGradual = gradual(treatment);

  const dims: TherapyResponseIndex["subscores"] = [];

  const push = (
    id: TriDimensionId,
    score: number,
    evidence: string[],
  ) => {
    const weight = WEIGHTS[id];
    const s = clamp(score);
    dims.push({
      id,
      score: s,
      weight,
      weighted_contribution: Math.round(s * weight * 10) / 10,
      evidence,
    });
  };

  // Symptom trajectory — improving courses score high if gradual; worsening OK if poor therapy
  {
    let score = 60;
    if (treatment.trajectory === "improving" && symptomSum < -4) score = 85;
    if (treatment.trajectory === "plateau") score = 70;
    if (treatment.trajectory === "worsening") score = 68; // can be realistic
    if (treatment.trajectory === "relapse") score = 75; // realistic pattern
    if (treatment.trajectory === "disengaged") score = 72;
    if (!isGradual) score -= 25;
    push("symptom_trajectory", score, [
      `trajectory=${treatment.trajectory}`,
      `symptom_delta_sum=${symptomSum.toFixed(1)}`,
      isGradual ? "gradual" : "abrupt_change",
    ]);
  }

  push(
    "cognitive_change",
    clamp(55 + cogSum * 3 + (o.cognition - 50) * 0.2),
    [`cognition=${o.cognition}`, `delta_sum=${cogSum.toFixed(1)}`],
  );
  push(
    "emotion_regulation",
    clamp(55 + erSum * 3 + (o.emotion_regulation - 50) * 0.2),
    [`er=${o.emotion_regulation}`],
  );
  push(
    "insight_growth",
    clamp(50 + insightSum * 4 + o.insight * 0.25),
    [`insight=${o.insight}`],
  );
  push(
    "functional_gain",
    clamp(50 + funcSum * 3 + o.functioning * 0.25),
    [`functioning=${o.functioning}`],
  );
  push(
    "alliance_trust",
    clamp(50 + trustSum * 4 + o.trust * 0.3),
    [`trust=${o.trust}`, `trust_delta_sum=${trustSum.toFixed(1)}`],
  );
  push(
    "disclosure_evolution",
    clamp(50 + discSum * 4 + o.disclosure_openness * 0.2),
    [`disclosure_openness=${o.disclosure_openness}`],
  );
  push(
    "hope_engagement",
    clamp(45 + hopeSum * 3 + o.hope * 0.2 + o.engagement * 0.2),
    [`hope=${o.hope}`, `engagement=${o.engagement}`],
  );

  // Relapse realism — high if relapse_risk moves with stress/adherence notes
  {
    let score = 65;
    if (treatment.trajectory === "relapse" && o.relapse_risk >= 55) score = 88;
    if (treatment.sessions.some((s) => s.life_event_valence === "negative"))
      score += 5;
    if (o.relapse_risk > 90 && treatment.trajectory === "improving") score -= 20;
    push("relapse_realism", score, [`relapse_risk=${o.relapse_risk}`]);
  }

  push(
    "modality_fit",
    opts?.modality_fit_score ?? 75,
    [`modality=${treatment.modality}`],
  );

  const overall = clamp(
    dims.reduce((a, d) => a + d.score * d.weight, 0),
  );

  const recommendations: string[] = [];
  if (!isGradual) {
    recommendations.push(
      "Abrupt symptom jumps detected — tighten per-session effect caps.",
    );
  }
  if (n < 3) {
    recommendations.push(
      "TRI more stable after ≥3 sessions — extend longitudinal packs for psychiatrist review.",
    );
  }
  if (overall < 70) {
    recommendations.push(
      "TRI < 70 — review modality fit and competence→outcome coupling for this disorder.",
    );
  }

  return {
    overall,
    subscores: dims,
    trajectory: treatment.trajectory,
    sessions: n,
    version: TRI_VERSION,
    computed_at: new Date().toISOString(),
    recommendations,
    clinical_reasoning: `TRI ${overall}/100 over ${n} sessions (${treatment.modality}); trajectory=${treatment.trajectory}. Believable progress requires gradual multi-session change a psychiatrist would recognize.`,
  };
}

/** In-memory TRI history for dashboard. */
const TRI_HISTORY: Array<{
  overall: number;
  disorder_slug: string;
  modality: string;
  computed_at: string;
  tri: TherapyResponseIndex;
}> = [];

export function recordTriHistory(row: {
  overall: number;
  disorder_slug: string;
  modality: string;
  tri: TherapyResponseIndex;
}): void {
  TRI_HISTORY.push({
    ...row,
    computed_at: row.tri.computed_at,
  });
  if (TRI_HISTORY.length > 5000) TRI_HISTORY.splice(0, TRI_HISTORY.length - 5000);
}

export function listTriHistory(limit = 500) {
  return TRI_HISTORY.slice(-limit);
}

export function clearTriHistory() {
  TRI_HISTORY.length = 0;
}
