/**
 * Patient Authenticity Benchmark (PAB) — Workstream C.
 * Compares PME vs SP / human transcript / legacy engine on structural axes.
 */

import { PAB_VERSION } from "@/lib/validation/types";
import type { BlindArm } from "@/lib/validation/types";
import {
  computeHumanConversationFidelityIndex,
  type HcfiComputeInput,
} from "@/lib/hcfi";
import {
  computePatientMindFidelityIndex,
  type PmfiComputeInput,
} from "@/lib/pmfi";

export type PabDimensionId =
  | "dialogue_realism"
  | "disclosure_timing"
  | "alliance_development"
  | "symptom_evolution"
  | "session_continuity"
  | "emotional_consistency"
  | "therapeutic_realism";

export type PabArmScore = {
  arm: BlindArm;
  overall: number;
  dimensions: Record<PabDimensionId, number>;
  evidence: string[];
};

export type PatientAuthenticityBenchmark = {
  version: string;
  computed_at: string;
  arms: PabArmScore[];
  /** PME advantage vs best non-PME comparator (points). */
  pme_delta_vs_best_comparator: number | null;
  winner: BlindArm | "tie" | null;
  recommendations: string[];
};

const DIM_WEIGHTS: Record<PabDimensionId, number> = {
  dialogue_realism: 0.18,
  disclosure_timing: 0.14,
  alliance_development: 0.14,
  symptom_evolution: 0.12,
  session_continuity: 0.12,
  emotional_consistency: 0.14,
  therapeutic_realism: 0.16,
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export type PabArmInput = {
  arm: BlindArm;
  hcfiInput?: HcfiComputeInput | null;
  pmfiInput?: PmfiComputeInput | null;
  /** Optional expert overlay means 0–100 when available. */
  expert_overlays?: Partial<Record<PabDimensionId, number>>;
};

function scoreArm(input: PabArmInput): PabArmScore {
  const hcfi = input.hcfiInput
    ? computeHumanConversationFidelityIndex(input.hcfiInput)
    : null;
  const pmfi = input.pmfiInput
    ? computePatientMindFidelityIndex(input.pmfiInput)
    : null;

  const natural = hcfi?.subscores.find((s) => s.id === "natural_language")?.score;
  const alliance = hcfi?.subscores.find((s) => s.id === "therapeutic_alliance")?.score
    ?? pmfi?.subscores.find((s) => s.id === "relationship_continuity")?.score;
  const disclosure = pmfi?.subscores.find((s) => s.id === "disclosure_realism")?.score
    ?? hcfi?.subscores.find((s) => s.id === "conversational_flow")?.score;
  const emotion = pmfi?.subscores.find((s) => s.id === "emotional_continuity")?.score
    ?? hcfi?.subscores.find((s) => s.id === "emotional_authenticity")?.score;
  const session = pmfi?.subscores.find((s) => s.id === "session_continuity")?.score;
  const behavior = pmfi?.subscores.find((s) => s.id === "behavior_realism")?.score;
  const therapy = pmfi?.subscores.find((s) => s.id === "therapy_realism")?.score;

  // Arm priors: SP / human transcripts are reference-high when no overlays;
  // legacy prompt is structurally weaker without PME.
  const prior =
    input.arm === "standardized_patient"
      ? 88
      : input.arm === "human_transcript"
        ? 85
        : input.arm === "legacy_prompt"
          ? 58
          : 72;

  const dimensions: Record<PabDimensionId, number> = {
    dialogue_realism: clamp(input.expert_overlays?.dialogue_realism ?? natural ?? prior),
    disclosure_timing: clamp(
      input.expert_overlays?.disclosure_timing ?? disclosure ?? prior - 5,
    ),
    alliance_development: clamp(
      input.expert_overlays?.alliance_development ?? alliance ?? prior - 3,
    ),
    symptom_evolution: clamp(
      input.expert_overlays?.symptom_evolution ?? behavior ?? prior - 8,
    ),
    session_continuity: clamp(
      input.expert_overlays?.session_continuity ?? session ?? prior - 6,
    ),
    emotional_consistency: clamp(
      input.expert_overlays?.emotional_consistency ?? emotion ?? prior - 4,
    ),
    therapeutic_realism: clamp(
      input.expert_overlays?.therapeutic_realism ?? therapy ?? prior - 5,
    ),
  };

  const overall = clamp(
    Object.entries(DIM_WEIGHTS).reduce(
      (a, [k, w]) => a + dimensions[k as PabDimensionId] * w,
      0,
    ),
  );

  const evidence = [
    `arm=${input.arm}`,
    hcfi ? `hcfi=${hcfi.overall}` : "hcfi=n/a",
    pmfi ? `pmfi=${pmfi.overall}` : "pmfi=n/a",
  ];

  return { arm: input.arm, overall, dimensions, evidence };
}

export function computePatientAuthenticityBenchmark(
  arms: PabArmInput[],
): PatientAuthenticityBenchmark {
  const scored = arms.map(scoreArm);
  const pme = scored.find((a) => a.arm === "pme_v1");
  const comparators = scored.filter((a) => a.arm !== "pme_v1");
  const bestComp = comparators.sort((a, b) => b.overall - a.overall)[0];
  const delta =
    pme && bestComp
      ? Math.round((pme.overall - bestComp.overall) * 10) / 10
      : null;

  let winner: PatientAuthenticityBenchmark["winner"] = null;
  if (scored.length) {
    const top = [...scored].sort((a, b) => b.overall - a.overall);
    if (top.length >= 2 && Math.abs(top[0]!.overall - top[1]!.overall) < 1.5) {
      winner = "tie";
    } else {
      winner = top[0]!.arm;
    }
  }

  const recommendations: string[] = [];
  if (delta != null && delta < 0) {
    recommendations.push(
      "PME trails best comparator on PAB — run blinded PAS before claiming superiority.",
    );
  }
  if (!arms.some((a) => a.arm === "standardized_patient")) {
    recommendations.push(
      "Include SP arm in next PAB run for criterion validity.",
    );
  }
  recommendations.push(
    "PAB structural scores are scaffolding; expert overlays from Mission 22 studies are authoritative.",
  );

  return {
    version: PAB_VERSION,
    computed_at: new Date().toISOString(),
    arms: scored,
    pme_delta_vs_best_comparator: delta,
    winner,
    recommendations,
  };
}
